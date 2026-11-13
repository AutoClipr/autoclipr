import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import DodoPayments from 'dodopayments';

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
  }): Promise<string> {
    const planProducts = PRODUCT_IDS[opts.planId];
    if (!planProducts) throw new Error(`Unknown plan: ${opts.planId}`);
    const productId = planProducts[opts.billingPeriod];
    if (!productId) throw new Error(`No product configured for ${opts.planId} ${opts.billingPeriod}`);

    // A checkout session, not subscriptions.create: the latter requires a
    // billing address up front, and it used to be hardcoded to India. That
    // routed every buyer through an INR, India-recurring mandate, which
    // foreign cards are declined for (PAYMENT_METHOD_UNSUPPORTED). Leaving
    // billing_address out lets Dodo's hosted page collect the buyer's real
    // country, so the price, currency and payment methods match their card.
    // On redirect Dodo appends subscription_id and status to return_url,
    // which the dashboard's activation fallback already reads.
    const session = await this.client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
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

  verifyWebhook(payload: string, headers: Record<string, string>): any {
    const webhookSecret = this.config.get<string>('DODO_WEBHOOK_SECRET') ?? '';
    return this.client.webhooks.unwrap(payload, { headers, key: webhookSecret });
  }
}
