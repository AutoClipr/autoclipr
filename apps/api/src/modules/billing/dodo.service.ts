import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import DodoPayments from 'dodopayments';

type DodoCountryCode = NonNullable<
  Parameters<DodoPayments['checkoutSessions']['create']>[0]['billing_address']
>['country'];

export type DodoCancellationFeedback = NonNullable<
  Parameters<DodoPayments['subscriptions']['update']>[1]['cancellation_feedback']
>;

const PRODUCT_IDS: Record<string, { monthly: string; yearly: string }> = {
  starter: { monthly: '', yearly: '' },
  creator: {
    monthly: process.env.DODO_PRODUCT_CREATOR_MONTHLY ?? process.env.DODO_PRODUCT_CREATOR ?? '',
    yearly: process.env.DODO_PRODUCT_CREATOR_YEARLY ?? process.env.DODO_PRODUCT_CREATOR ?? '',
  },
  business: {
    monthly: process.env.DODO_PRODUCT_BUSINESS_MONTHLY ?? process.env.DODO_PRODUCT_BUSINESS ?? '',
    yearly: process.env.DODO_PRODUCT_BUSINESS_YEARLY ?? process.env.DODO_PRODUCT_BUSINESS ?? '',
  },
};

@Injectable()
export class DodoService {
  private readonly client: DodoPayments;
  private readonly logger = new Logger(DodoService.name);

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('DODO_API_KEY') ?? '';
    const isLive = this.config.get<string>('DODO_LIVE_MODE') === 'true';
    this.client = new DodoPayments({ bearerToken: apiKey, environment: isLive ? 'live_mode' : 'test_mode' });
    this.logger.log(`Dodo Payments running in ${isLive ? 'LIVE' : 'TEST'} mode`);
  }

  async createCheckoutUrl(opts: {
    planId: string;
    billingPeriod: 'monthly' | 'yearly';
    userId: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
    /** Validated coupon code, mirrored to a Dodo discount. */
    discountCode?: string | null;
    /** Trial days from a free_trial coupon. */
    trialPeriodDays?: number | null;
    /** ISO 3166-1 alpha-2 country from the buyer's IP, used only as a prefill. */
    country?: string | null;
  }): Promise<string> {
    const planProducts = PRODUCT_IDS[opts.planId];
    if (!planProducts) throw new Error(`Unknown plan: ${opts.planId}`);
    const productId = planProducts[opts.billingPeriod];
    if (!productId) throw new Error(`No product configured for ${opts.planId} ${opts.billingPeriod}`);

    // A checkout session, not subscriptions.create: the latter requires a
    // billing address up front, and it used to be hardcoded to India. That
    // routed every buyer through an INR, India-recurring mandate, which
    // foreign cards are declined for (PAYMENT_METHOD_UNSUPPORTED). Now the
    // country is prefilled from the buyer's IP when we have it, and always
    // left editable: IP location is not always the card's country (VPNs,
    // travellers), and a wrong country locked in would reproduce the decline.
    // On redirect Dodo appends subscription_id and status to return_url,
    // which the dashboard's activation fallback already reads.
    const country = opts.country?.toUpperCase();
    const session = await this.client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      ...(country && /^[A-Z]{2}$/.test(country)
        ? { billing_address: { country: country as DodoCountryCode } }
        : {}),
      customer: { email: opts.email, name: opts.email },
      return_url: opts.successUrl,
      metadata: {
        user_id: opts.userId,
        plan_id: opts.planId,
        billing_period: opts.billingPeriod,
        // Carried through checkout so the activation path knows which coupon
        // to claim once the payment is confirmed.
        ...(opts.discountCode ? { coupon_code: opts.discountCode } : {}),
      },
      ...(opts.discountCode ? { discount_code: opts.discountCode } : {}),
      ...(opts.trialPeriodDays
        ? { subscription_data: { trial_period_days: opts.trialPeriodDays } }
        : {}),
      feature_flags: {
        // Coupons are validated and claimed by our own coupon service; a code
        // typed straight into Dodo's page would skip those checks.
        allow_discount_code: false,
        // The prefilled country is only a guess; the buyer must be able to fix it.
        allow_customer_editing_country: true,
      },
    });

    if (!session.checkout_url) throw new Error('Dodo did not return a checkout URL');
    return session.checkout_url;
  }

  /**
   * Register a percentage discount with Dodo.
   *
   * Dodo is the only place a discount can actually reduce what a customer is
   * charged — the price comes from the product at its hosted checkout — so a
   * percentage coupon has to exist on both sides.
   *
   * `amount` is in basis points (2000 = 20%), and codes are capped at 16
   * characters; both are the caller's responsibility.
   */
  async createDiscount(opts: {
    code: string;
    amount: number;
    expiresAt?: string | null;
    usageLimit?: number | null;
  }) {
    return this.client.discounts.create({
      code: opts.code,
      amount: opts.amount,
      type: 'percentage',
      expires_at: opts.expiresAt ?? null,
      usage_limit: opts.usageLimit ?? null,
    });
  }

  /**
   * Update a mirrored discount. Only the fields that change are sent, so a
   * partial edit does not silently reset the others.
   */
  async updateDiscount(
    discountId: string,
    patch: { amount?: number; expiresAt?: string | null; usageLimit?: number | null },
  ) {
    return this.client.discounts.update(discountId, {
      ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.expiresAt !== undefined ? { expires_at: patch.expiresAt } : {}),
      ...(patch.usageLimit !== undefined ? { usage_limit: patch.usageLimit } : {}),
    });
  }

  async deleteDiscount(discountId: string) {
    return this.client.discounts.delete(discountId);
  }

  async getSubscription(subscriptionId: string) {
    return this.client.subscriptions.retrieve(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string) {
    return this.client.subscriptions.update(subscriptionId, { status: 'cancelled' });
  }

  /**
   * Schedule cancellation for the end of the current billing period. Dodo
   * keeps the subscription active until then and does not renew it
   * (`cancel_at_next_billing_date`, PATCH /subscriptions/{id}).
   */
  async scheduleCancellation(
    subscriptionId: string,
    opts: { feedback?: DodoCancellationFeedback | null; comment?: string | null } = {},
  ) {
    return this.client.subscriptions.update(subscriptionId, {
      cancel_at_next_billing_date: true,
      cancel_reason: 'cancelled_by_customer',
      ...(opts.feedback ? { cancellation_feedback: opts.feedback } : {}),
      ...(opts.comment ? { cancellation_comment: opts.comment } : {}),
    });
  }

  /**
   * Find a user's active subscription in Dodo when we never stored its id
   * (plans activated through the payment-success redirect before the id was
   * saved). Customers are matched by email, then the subscription must carry
   * our `user_id` in its metadata, so an email collision cannot match
   * someone else's subscription.
   */
  async findActiveSubscriptionId(email: string, userId: string): Promise<string | null> {
    if (!email) return null;
    for await (const customer of this.client.customers.list({ email })) {
      for await (const sub of this.client.subscriptions.list({ customer_id: customer.customer_id, status: 'active' })) {
        if (sub.metadata?.user_id === userId) return sub.subscription_id;
      }
    }
    return null;
  }

  /** Undo a scheduled cancellation while the period is still running. */
  async resumeSubscription(subscriptionId: string) {
    return this.client.subscriptions.update(subscriptionId, { cancel_at_next_billing_date: false });
  }

  verifyWebhook(payload: string, headers: Record<string, string>): any {
    const webhookSecret = this.config.get<string>('DODO_WEBHOOK_SECRET') ?? '';
    return this.client.webhooks.unwrap(payload, { headers, key: webhookSecret });
  }
}
