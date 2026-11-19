import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@autoclipr/emails';
import { SupabaseAdminService } from '../../database/supabase-admin.service';
import { UsersRepository } from '../users/users.repository';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { DodoService, type DodoCancellationFeedback } from './dodo.service';
import { RetentionService } from '../retention/retention.service';
import { CouponsService } from '../coupons/coupons.service';
import { CampaignsService } from '../campaigns/campaigns.service';

const PLAN_TIER: Record<string, string> = {
  starter: 'starter',
  creator: 'creator',
  business: 'business',
};

/** Reasons offered in the "why are you leaving" step, mapped to Dodo's enum. */
export const CANCELLATION_REASONS: Record<string, DodoCancellationFeedback> = {
  too_expensive: 'too_expensive',
  not_using: 'unused',
  missing_features: 'missing_features',
  found_alternative: 'switched_service',
  technical_issues: 'low_quality',
  other: 'other',
};

/** A cancel request older than this is treated as abandoned and may be retried. */
const CANCEL_LOCK_MS = 2 * 60 * 1000;

type SubscriptionRow = {
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean | null;
  cancellation_requested_at: string | null;
  cancellation_effective_at: string | null;
  cancelled_at: string | null;
  last_webhook_at: string | null;
};

const SUBSCRIPTION_COLUMNS =
  'user_id, plan_id, status, current_period_end, stripe_subscription_id, cancel_at_period_end, cancellation_requested_at, cancellation_effective_at, cancelled_at, last_webhook_at';

const PLAN_CREDITS: Record<string, number> = {
  starter: 30,
  creator: 500,
  business: 1200,
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly dodo: DodoService,
    private readonly supabase: SupabaseAdminService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly usersRepo: UsersRepository,
    private readonly affiliates: AffiliatesService,
    private readonly retention: RetentionService,
    @Inject(forwardRef(() => CouponsService))
    private readonly coupons: CouponsService,
    @Inject(forwardRef(() => CampaignsService))
    private readonly campaigns: CampaignsService,
  ) {}

  /**
   * Confirm with Dodo that this subscription is real, paid, and belongs to
   * this user — then report what was actually bought.
   *
   * The ownership check is the load-bearing one. Without it a user could
   * replay somebody else's subscription id (they appear in redirect URLs) and
   * inherit their plan. `user_id` is stamped into the subscription metadata by
   * createCheckoutUrl, so Dodo is the one telling us who paid.
   */
  private async verifyPaidSubscription(
    userId: string,
    subscriptionId: string,
  ): Promise<{ planId: string; billingPeriod: 'monthly' | 'yearly'; couponCode: string | null }> {
    if (!subscriptionId) {
      throw new BadRequestException('A subscription id is required to activate a plan.');
    }

    let subscription: {
      status?: string;
      metadata?: Record<string, string>;
      subscription_id?: string;
    };
    try {
      subscription = (await this.dodo.getSubscription(subscriptionId)) as typeof subscription;
    } catch (err) {
      // Fail closed: an unverifiable subscription grants nothing.
      this.logger.error(
        `Dodo lookup failed for subscription ${subscriptionId} (userId=${userId}): ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ForbiddenException('Could not verify this payment.');
    }

    const metadata = subscription?.metadata ?? {};

    if (metadata.user_id !== userId) {
      this.logger.warn(
        `Rejected activation: subscription ${subscriptionId} belongs to ${metadata.user_id ?? 'unknown'}, not ${userId}`,
      );
      throw new ForbiddenException('This payment does not belong to your account.');
    }

    if (subscription?.status !== 'active') {
      this.logger.warn(
        `Rejected activation: subscription ${subscriptionId} has status ${subscription?.status ?? 'unknown'}`,
      );
      throw new ForbiddenException('This subscription is not active.');
    }

    const planId = metadata.plan_id ?? '';
    if (!PLAN_TIER[planId]) {
      throw new ForbiddenException('This subscription is not for a known plan.');
    }

    const billingPeriod = metadata.billing_period === 'monthly' ? 'monthly' : 'yearly';
    // Read back from Dodo rather than the request, so a user cannot claim a
    // coupon they never actually checked out with.
    return { planId, billingPeriod, couponCode: metadata.coupon_code ?? null };
  }

  async createCheckoutUrl(
    userId: string,
    email: string,
    planId: string,
    billingPeriod: 'monthly' | 'yearly' = 'yearly',
    couponCode?: string,
    country?: string,
  ): Promise<string> {
    const appUrl = this.config.get<string>('WEB_APP_URL') ?? 'https://autoclipr.com';

    // Re-validated here rather than trusting whatever the client validated
    // earlier: the coupon may have been exhausted or paused in between, and
    // the request body is attacker-controlled either way. An invalid code
    // throws, so the user is told before being sent to a checkout that would
    // silently charge full price.
    let discountCode: string | null = null;
    let trialPeriodDays: number | null = null;
    if (couponCode?.trim()) {
      const coupon = await this.coupons.validate(couponCode, planId, billingPeriod, userId);
      if (coupon.type === 'percentage') discountCode = coupon.code;
      if (coupon.type === 'free_trial') trialPeriodDays = coupon.value;
    }

    return this.dodo.createCheckoutUrl({
      planId,
      billingPeriod,
      userId,
      email,
      discountCode,
      trialPeriodDays,
      country,
      successUrl: `${appUrl}/dashboard?payment=success&plan=${planId}&billing=${billingPeriod}`,
      cancelUrl: `${appUrl}/pricing?payment=cancelled`,
    });
  }

  /**
   * Called on the payment-success redirect as a fallback when the webhook is
   * delayed or missing.
   *
   * Everything that decides what the user gets is read back from Dodo, never
   * from the caller. The request only supplies a subscription id; the plan,
   * the billing period and the fact that money changed hands all come from
   * `verifyPaidSubscription`. Trusting a `planId` in the request body here
   * would let any signed-in user hand themselves a paid plan.
   */
  async activatePlanForUser(userId: string, planId: string, userEmail = '', transactionId = '', billingPeriod: 'monthly' | 'yearly' = 'yearly'): Promise<void> {
    this.logger.log(`activatePlanForUser: userId=${userId} email=${userEmail} claimedPlan=${planId} txId=${transactionId}`);

    const verified = await this.verifyPaidSubscription(userId, transactionId);
    // The claimed values are logged for diagnostics but never used.
    if (verified.planId !== planId || verified.billingPeriod !== billingPeriod) {
      this.logger.warn(
        `Claimed plan/period did not match Dodo for userId=${userId}: claimed=${planId}/${billingPeriod} actual=${verified.planId}/${verified.billingPeriod}`,
      );
    }
    planId = verified.planId;
    billingPeriod = verified.billingPeriod;

    const tier = PLAN_TIER[planId];
    if (!tier) throw new Error(`Unknown plan: ${planId}`);

    // Ensure profile exists for OAuth users who skipped sync
    await this.usersRepo.ensureProfile(userId, userEmail);

    const periodEnd = billingPeriod === 'yearly'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await this.supabase.getClient()
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        // The activation id is the Dodo subscription id; cancellation needs it.
        stripe_subscription_id: transactionId,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        cancellation_requested_at: null,
        cancellation_effective_at: null,
        cancelled_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    const { error: profileErr } = await this.supabase.getClient()
      .from('profiles')
      .update({
        subscription_tier: tier,
        credits: PLAN_CREDITS[planId] ?? 30,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (profileErr) this.logger.error(`Profile update failed: ${profileErr.message}`);
    else this.logger.log(`Profile updated: userId=${userId} tier=${tier} credits=${PLAN_CREDITS[planId]}`);

    // Now paying — cancel any pending Starter deletion warnings.
    if (tier !== 'starter') {
      await this.retention.clearWarningsForUser(userId);
    }

    // Claim the coupon only now, with the payment confirmed. Claiming at
    // checkout would burn a use for every abandoned cart, and a popular code
    // would show as exhausted while having earned nothing.
    if (verified.couponCode) {
      await this.applyCoupon(userId, verified.couponCode, planId, billingPeriod);
    }

    // Compute amount based on plan + billing period
    const PLAN_AMOUNTS: Record<string, { monthly: string; yearly: string }> = {
      creator:  { monthly: '₹399.00',   yearly: '₹4,188.00' },
      business: { monthly: '₹1,999.00', yearly: '₹20,988.00' },
      starter:  { monthly: 'Free',      yearly: 'Free' },
    };
    const amountPaid = PLAN_AMOUNTS[planId]?.[billingPeriod as 'monthly' | 'yearly'] ?? 'Free';

    // Record transaction
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    const internalTxId = `TRN${Date.now().toString().slice(-9).padStart(9, '0')}`;
    try {
      await this.supabase.getClient().from('billing_transactions').insert({
        user_id: userId,
        invoice_number: invoiceNumber,
        plan_id: planId,
        amount: amountPaid,
        status: 'paid',
        transaction_id: internalTxId,
        payment_date: new Date().toISOString(),
        period_end: periodEnd,
        billing_period: billingPeriod,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to record transaction: ${e.message}`);
    }

    // Award referral commission if this user was referred by an affiliate
    try {
      await this.affiliates.awardCommission(userId, planId, billingPeriod, internalTxId);
    } catch (e: any) {
      this.logger.warn(`Failed to award affiliate commission: ${e.message}`);
    }

    // Pass email directly so it works even when profile email is empty (OAuth users)
    await this.sendSubscriptionEmails(userId, planId, internalTxId, { payment_id: internalTxId, billing_period: billingPeriod, amount_override: amountPaid }, userEmail);
    this.logger.log(`Plan activated via success redirect: userId=${userId} plan=${planId}`);
  }

  /**
   * Record the redemption and grant anything the coupon adds on our side.
   *
   * Never throws: the payment has already succeeded and the plan is already
   * active, so a coupon bookkeeping failure must not fail the activation the
   * user paid for. It is logged instead.
   */
  private async applyCoupon(
    userId: string,
    code: string,
    planId: string,
    billingPeriod: 'monthly' | 'yearly',
  ): Promise<void> {
    try {
      const coupon = await this.coupons.validate(code, planId, billingPeriod, userId);
      const redeemed = await this.coupons.redeem(
        coupon.id,
        userId,
        planId,
        coupon.discountPaise,
      );

      if (!redeemed) {
        this.logger.warn(`Coupon ${code} could not be claimed for ${userId} after payment`);
        return;
      }

      // Credit the campaign email that drove this, if there was one. Without
      // it a campaign's redeemed/converted counts stay at zero however well it
      // performed.
      await this.campaigns.recordRedemption(userId);

      // Bonus credits are ours to grant — Dodo knows nothing about them.
      if (coupon.type === 'free_credits') {
        await this.usersRepo.refundCredits(userId, coupon.value, 'coupon_bonus', undefined);
        this.logger.log(`Granted ${coupon.value} bonus credits to ${userId} from ${code}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to apply coupon ${code} for ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** One of the user's own payments, or null — used to build its receipt. */
  async getTransaction(userId: string, id: string) {
    const { data } = await this.supabase.getClient()
      .from('billing_transactions')
      .select('id, invoice_number, plan_id, amount, status, transaction_id, payment_date, period_end, billing_period')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();
    return data ?? null;
  }

  async getTransactions(userId: string) {
    const { data } = await this.supabase.getClient()
      .from('billing_transactions')
      .select('id, invoice_number, plan_id, amount, status, transaction_id, payment_date, period_end, billing_period')
      .eq('user_id', userId)
      .order('payment_date', { ascending: false });
    return data ?? [];
  }

  /**
   * Apply a verified Dodo webhook.
   *
   * `webhookId` (the `webhook-id` header) makes this idempotent: Dodo retries
   * deliver the same id, and an id we have already processed is skipped, so a
   * duplicate cannot re-grant credits or re-send emails.
   */
  async handleWebhookEvent(event: any, webhookId?: string): Promise<void> {
    const type: string = event.event_type ?? event.type ?? '';
    this.logger.log(`Dodo webhook: ${type}${webhookId ? ` (${webhookId})` : ''}`);

    if (webhookId) {
      const { error } = await this.supabase.getClient()
        .from('processed_webhook_events')
        .insert({ webhook_id: webhookId, event_type: type });
      if (error?.code === '23505') {
        this.logger.log(`Skipping duplicate webhook ${webhookId}`);
        return;
      }
      if (error) this.logger.warn(`Could not record webhook ${webhookId}: ${error.message}`);
    }

    try {
      await this.applyWebhookEvent(type, event);
    } catch (err) {
      // Forget the id so Dodo's retry is processed rather than skipped.
      if (webhookId) {
        await this.supabase.getClient().from('processed_webhook_events').delete().eq('webhook_id', webhookId);
      }
      throw err;
    }
  }

  private async applyWebhookEvent(type: string, event: any): Promise<void> {
    const data = event.data;
    const eventAt: string | undefined = event.timestamp;

    if (type.startsWith('subscription.') && (await this.isStaleEvent(data, eventAt))) {
      this.logger.log(`Ignoring out-of-order ${type} from ${eventAt}`);
      return;
    }

    if (type === 'subscription.active' || type === 'subscription.created') {
      await this.upsertSubscription(data, 'active', eventAt);
    } else if (type === 'subscription.renewed') {
      await this.upsertSubscription(data, 'active', eventAt);
    } else if (type === 'subscription.plan_changed') {
      await this.upsertSubscription(data, 'active', eventAt);
    } else if (type === 'subscription.updated') {
      await this.syncSubscriptionFields(data, eventAt);
    } else if (type === 'subscription.cancelled' || type === 'subscription.expired') {
      await this.handleSubscriptionEnded(data, type === 'subscription.expired' ? 'expired' : 'cancelled', eventAt);
    } else if (type === 'subscription.on_hold' || type === 'subscription.failed') {
      await this.upsertSubscription(data, 'on_hold', eventAt);
    } else if (type === 'payment.succeeded') {
      this.logger.log(`Payment succeeded: ${data?.payment_id}`);
    }
  }

  /** True when a newer webhook has already been applied to this subscription. */
  private async isStaleEvent(data: any, eventAt?: string): Promise<boolean> {
    const userId: string = data?.metadata?.user_id ?? '';
    if (!userId || !eventAt) return false;
    const row = await this.getSubscriptionRow(userId);
    if (!row?.last_webhook_at) return false;
    // Only compare events about the same Dodo subscription.
    const subscriptionId: string = data.subscription_id ?? '';
    if (row.stripe_subscription_id && subscriptionId && row.stripe_subscription_id !== subscriptionId) return false;
    return new Date(eventAt).getTime() < new Date(row.last_webhook_at).getTime();
  }

  private async getSubscriptionRow(userId: string): Promise<SubscriptionRow | null> {
    const { data } = await this.supabase.getClient()
      .from('user_subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    return (data as SubscriptionRow | null) ?? null;
  }

  /**
   * `subscription.updated`: mirror the cancel flag and period end without
   * touching credits (that only happens on activation and renewal).
   */
  private async syncSubscriptionFields(data: any, eventAt?: string): Promise<void> {
    const userId: string = data?.metadata?.user_id ?? '';
    if (!userId) return;
    const scheduled = data.cancel_at_next_billing_date === true;
    const periodEnd: string | null = data.next_billing_date ?? null;
    const update: Record<string, unknown> = {
      cancel_at_period_end: scheduled,
      cancellation_effective_at: scheduled ? periodEnd : null,
      updated_at: new Date().toISOString(),
      ...(eventAt ? { last_webhook_at: eventAt } : {}),
      ...(periodEnd ? { current_period_end: periodEnd } : {}),
    };
    if (!scheduled) update.cancellation_requested_at = null;
    const { error } = await this.supabase.getClient()
      .from('user_subscriptions')
      .update(update)
      .eq('user_id', userId);
    if (error) this.logger.error(`Failed to sync subscription for ${userId}: ${error.message}`);
  }

  /**
   * `subscription.cancelled` / `subscription.expired`.
   *
   * If the paid period is still running (a scheduled cancellation), the plan
   * stays usable and only the status is recorded; the daily sweep removes
   * access once the period ends. Otherwise access is removed now.
   */
  private async handleSubscriptionEnded(data: any, status: 'cancelled' | 'expired', eventAt?: string): Promise<void> {
    const userId: string = data?.metadata?.user_id ?? '';
    if (!userId) {
      this.logger.warn('Webhook missing user_id in metadata');
      return;
    }
    const row = await this.getSubscriptionRow(userId);
    const periodEnd: string | null =
      row?.cancellation_effective_at ?? data.next_billing_date ?? row?.current_period_end ?? null;
    const stillPaid = status === 'cancelled' && !!periodEnd && new Date(periodEnd).getTime() > Date.now();

    await this.supabase.getClient()
      .from('user_subscriptions')
      .update({
        status,
        stripe_subscription_id: data.subscription_id ?? row?.stripe_subscription_id ?? null,
        cancel_at_period_end: stillPaid,
        cancellation_effective_at: periodEnd,
        updated_at: new Date().toISOString(),
        ...(eventAt ? { last_webhook_at: eventAt } : {}),
      })
      .eq('user_id', userId);

    if (!stillPaid) await this.endSubscriptionAccess(userId, row?.plan_id ?? data.metadata?.plan_id ?? 'starter');
  }

  /**
   * Drop the user to Starter and send the "subscription ended" email, once.
   * `cancelled_at` is the guard: it is set the first time, so a duplicate
   * event or a later sweep does nothing.
   */
  private async endSubscriptionAccess(userId: string, planId: string): Promise<void> {
    const now = new Date().toISOString();
    const { data: claimed } = await this.supabase.getClient()
      .from('user_subscriptions')
      .update({ cancelled_at: now, cancel_at_period_end: false, updated_at: now })
      .eq('user_id', userId)
      .is('cancelled_at', null)
      .select('user_id');
    if (!claimed?.length) return;

    const { error } = await this.supabase.getClient()
      .from('profiles')
      .update({ subscription_tier: 'starter', updated_at: now })
      .eq('id', userId);
    if (error) this.logger.error(`Failed to downgrade ${userId}: ${error.message}`);
    else this.logger.log(`Subscription ended: userId=${userId} plan=${planId}`);

    const profile = await this.getProfileContact(userId);
    if (profile && PLAN_TIER[planId] && planId !== 'starter') {
      await this.email.sendSubscriptionEnded(profile.email, {
        userName: profile.name,
        planName: this.planName(planId),
        endedAt: this.formatDate(now),
      });
    }
  }

  /**
   * Safety net for a missed or delayed webhook: end every scheduled
   * cancellation whose period is over.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'end-cancelled-subscriptions' })
  async endExpiredCancellations(): Promise<number> {
    const { data } = await this.supabase.getClient()
      .from('user_subscriptions')
      .select('user_id, plan_id')
      .eq('cancel_at_period_end', true)
      .is('cancelled_at', null)
      .lt('cancellation_effective_at', new Date().toISOString());
    for (const row of data ?? []) {
      await this.supabase.getClient()
        .from('user_subscriptions')
        .update({ status: 'expired' })
        .eq('user_id', row.user_id);
      await this.endSubscriptionAccess(row.user_id, row.plan_id);
    }
    return data?.length ?? 0;
  }

  /**
   * Schedule cancellation of the caller's own subscription for the end of the
   * billing period.
   *
   * The Dodo subscription id always comes from our database row for this
   * user, never from the request, and Dodo's metadata must name the same
   * user. A short lock on the row makes double clicks and parallel requests
   * safe, and the call is idempotent: an already-scheduled cancellation is
   * returned as-is.
   */
  async cancelSubscription(
    userId: string,
    opts: { reason?: string | null; comment?: string | null } = {},
  ) {
    const row = await this.getSubscriptionRow(userId);
    if (!row || !PLAN_TIER[row.plan_id] || row.plan_id === 'starter') {
      throw new BadRequestException('You do not have a paid subscription to cancel.');
    }
    if (row.cancel_at_period_end) return this.cancellationState(row);
    if (row.status !== 'active') {
      throw new BadRequestException('This subscription is not active, so there is nothing to cancel.');
    }
    if (!row.stripe_subscription_id) {
      row.stripe_subscription_id = await this.recoverSubscriptionId(userId);
      if (!row.stripe_subscription_id) {
        throw new BadRequestException(
          'We could not find the payment record for this subscription. Please contact support to cancel.',
        );
      }
    }

    const reason = opts.reason && CANCELLATION_REASONS[opts.reason] ? opts.reason : null;
    const comment = opts.comment?.trim().slice(0, 500) || null;

    // Claim the row. Only one request can flip an unset (or stale) lock.
    const now = new Date();
    const staleBefore = new Date(now.getTime() - CANCEL_LOCK_MS).toISOString();
    const { data: claimed } = await this.supabase.getClient()
      .from('user_subscriptions')
      .update({ cancellation_requested_at: now.toISOString() })
      .eq('user_id', userId)
      .eq('cancel_at_period_end', false)
      .or(`cancellation_requested_at.is.null,cancellation_requested_at.lt.${staleBefore}`)
      .select('user_id');
    if (!claimed?.length) {
      throw new ConflictException('A cancellation request is already in progress.');
    }

    const subscriptionId = row.stripe_subscription_id;
    let result: { cancel_at_next_billing_date?: boolean; next_billing_date?: string; metadata?: Record<string, string> };
    try {
      const current = (await this.dodo.getSubscription(subscriptionId)) as { metadata?: Record<string, string> };
      if (current?.metadata?.user_id !== userId) {
        this.logger.warn(`Cancel refused: subscription ${subscriptionId} is not owned by ${userId}`);
        throw new ForbiddenException('This subscription does not belong to your account.');
      }
      result = (await this.dodo.scheduleCancellation(subscriptionId, {
        feedback: reason ? CANCELLATION_REASONS[reason] : null,
        comment,
      })) as typeof result;
    } catch (err) {
      await this.supabase.getClient()
        .from('user_subscriptions')
        .update({ cancellation_requested_at: null })
        .eq('user_id', userId);
      if (err instanceof ForbiddenException) throw err;
      this.logger.error(
        `Dodo cancellation failed for userId=${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      const profile = await this.getProfileContact(userId);
      if (profile) {
        await this.email.sendCancellationFailed(profile.email, {
          userName: profile.name,
          planName: this.planName(row.plan_id),
        });
      }
      throw new BadGatewayException('We could not cancel your subscription right now. Please try again.');
    }

    if (result?.cancel_at_next_billing_date !== true) {
      // Dodo accepted the call but did not schedule it; do not claim success.
      await this.supabase.getClient()
        .from('user_subscriptions')
        .update({ cancellation_requested_at: null })
        .eq('user_id', userId);
      throw new BadGatewayException('We could not cancel your subscription right now. Please try again.');
    }

    const accessUntil = result.next_billing_date ?? row.current_period_end;
    await this.supabase.getClient()
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: true,
        cancellation_effective_at: accessUntil,
        ...(accessUntil ? { current_period_end: accessUntil } : {}),
        cancellation_reason: reason,
        cancellation_comment: comment,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    this.logger.log(`Cancellation scheduled: userId=${userId} until=${accessUntil ?? 'unknown'} reason=${reason ?? '-'}`);

    // Never throws (EmailService swallows send errors), so a mail outage
    // cannot undo a cancellation that Dodo has already accepted.
    const profile = await this.getProfileContact(userId);
    if (profile) {
      await this.email.sendSubscriptionCancelled(profile.email, {
        userName: profile.name,
        planName: this.planName(row.plan_id),
        cancellationDate: this.formatDate(new Date().toISOString()),
        accessUntil: accessUntil ? this.formatDate(accessUntil) : 'the end of your billing period',
      });
    }

    return this.cancellationState({ ...row, cancel_at_period_end: true, cancellation_effective_at: accessUntil });
  }

  /**
   * Look up and store the Dodo subscription id for a user whose row lacks it.
   * Returns null when Dodo has no matching active subscription.
   */
  private async recoverSubscriptionId(userId: string): Promise<string | null> {
    const profile = await this.getProfileContact(userId);
    if (!profile) return null;
    let subscriptionId: string | null = null;
    try {
      subscriptionId = await this.dodo.findActiveSubscriptionId(profile.email, userId);
    } catch (err) {
      this.logger.error(`Dodo subscription lookup failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    if (subscriptionId) {
      await this.supabase.getClient()
        .from('user_subscriptions')
        .update({ stripe_subscription_id: subscriptionId })
        .eq('user_id', userId);
      this.logger.log(`Recovered Dodo subscription id for ${userId}`);
    }
    return subscriptionId;
  }

  /** Undo a scheduled cancellation before the period ends. */
  async resumeSubscription(userId: string) {
    const row = await this.getSubscriptionRow(userId);
    if (!row?.cancel_at_period_end || !row.stripe_subscription_id) {
      throw new BadRequestException('There is no scheduled cancellation to undo.');
    }
    if (row.cancellation_effective_at && new Date(row.cancellation_effective_at).getTime() <= Date.now()) {
      throw new BadRequestException('This subscription has already ended. Please choose a new plan.');
    }

    try {
      const current = (await this.dodo.getSubscription(row.stripe_subscription_id)) as { metadata?: Record<string, string> };
      if (current?.metadata?.user_id !== userId) {
        throw new ForbiddenException('This subscription does not belong to your account.');
      }
      const result = (await this.dodo.resumeSubscription(row.stripe_subscription_id)) as {
        cancel_at_next_billing_date?: boolean;
      };
      if (result?.cancel_at_next_billing_date !== false) throw new Error('Dodo did not clear the cancellation');
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.error(`Dodo resume failed for userId=${userId}: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadGatewayException('We could not resume your subscription right now. Please try again.');
    }

    await this.supabase.getClient()
      .from('user_subscriptions')
      .update({
        status: 'active',
        cancel_at_period_end: false,
        cancellation_requested_at: null,
        cancellation_effective_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    this.logger.log(`Cancellation undone: userId=${userId}`);
    return this.cancellationState({ ...row, status: 'active', cancel_at_period_end: false, cancellation_effective_at: null });
  }

  private cancellationState(row: Pick<SubscriptionRow, 'plan_id' | 'status' | 'cancel_at_period_end' | 'cancellation_effective_at' | 'current_period_end'>) {
    return {
      plan_id: row.plan_id,
      status: row.status,
      cancel_at_period_end: !!row.cancel_at_period_end,
      access_until: row.cancellation_effective_at ?? row.current_period_end,
    };
  }

  private async getProfileContact(userId: string): Promise<{ email: string; name: string } | null> {
    const { data } = await this.supabase.getClient()
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle();
    if (!data?.email) return null;
    return { email: data.email, name: data.full_name || data.email.split('@')[0] };
  }

  private planName(planId: string): string {
    return planId.charAt(0).toUpperCase() + planId.slice(1);
  }

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  private async upsertSubscription(data: any, status: string, eventAt?: string): Promise<void> {
    if (!data) return;

    const userId: string = data.metadata?.user_id ?? data.customer?.id ?? '';
    const planId: string = data.metadata?.plan_id ?? 'starter';
    const subscriptionId: string = data.subscription_id ?? data.id ?? '';
    const periodEnd = data.next_billing_date ?? data.current_period_end ?? null;
    const tier = PLAN_TIER[planId] ?? 'starter';

    if (!userId) {
      this.logger.warn('Webhook missing user_id in metadata');
      return;
    }

    // Upsert subscription record
    const { error: subError } = await this.supabase.getClient()
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_id: planId,
        status,
        stripe_subscription_id: subscriptionId, // reusing this column for dodo subscription id
        current_period_start: data.created_at ?? new Date().toISOString(),
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
        ...(eventAt ? { last_webhook_at: eventAt } : {}),
        // A (re)activation or renewal means it is no longer ending.
        ...(status === 'active'
          ? {
              cancel_at_period_end: data.cancel_at_next_billing_date === true,
              cancellation_effective_at: data.cancel_at_next_billing_date === true ? periodEnd : null,
              cancelled_at: null,
            }
          : {}),
      }, { onConflict: 'user_id' });

    if (subError) {
      this.logger.error(`Failed to upsert subscription: ${subError.message}`);
      return;
    }

    // Update profile subscription_tier and credits on activation
    const profileTier = status === 'active' ? tier : 'starter';
    const profileUpdate: Record<string, any> = {
      subscription_tier: profileTier,
      updated_at: new Date().toISOString(),
    };
    if (status === 'active') {
      profileUpdate.credits = PLAN_CREDITS[planId] ?? 30;
    }
    const { error: profileError } = await this.supabase.getClient()
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);

    if (profileError) {
      this.logger.error(`Failed to update profile tier: ${profileError.message}`);
    }

    // Paying now: drop any pending Starter deletion warnings. Leaving them
    // stamped would mean a later downgrade deletes their videos off a stale
    // notice instead of starting a fresh window with a fresh warning.
    if (status === 'active' && profileTier !== 'starter') {
      await this.retention.clearWarningsForUser(userId);
    }

    // Award referral commission on every activation (new signup or renewal)
    if (status === 'active') {
      const billingPeriod: 'monthly' | 'yearly' = data.billing_period ?? 'monthly';
      try {
        await this.affiliates.awardCommission(userId, planId, billingPeriod, subscriptionId);
      } catch (e: any) {
        this.logger.warn(`Affiliate commission error: ${e.message}`);
      }
      const webhookEmail: string = data.customer?.email ?? '';
      await this.sendSubscriptionEmails(userId, planId, subscriptionId, data, webhookEmail);
    }
  }

  private async sendSubscriptionEmails(
    userId: string,
    planId: string,
    subscriptionId: string,
    data: any,
    fallbackEmail = '',
  ): Promise<void> {
    // Fetch user email + name from profiles
    const { data: profile } = await this.supabase.getClient()
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    const toEmail = profile?.email || fallbackEmail;
    if (!toEmail) {
      this.logger.warn(`No email found for userId=${userId}, skipping subscription emails`);
      return;
    }

    const appUrl = this.config.get<string>('WEB_APP_URL') ?? 'https://autoclipr.com';
    const planName = planId.charAt(0).toUpperCase() + planId.slice(1);
    const billingPeriod: string = data.billing_period ?? 'yearly';
    const billingCycleLabel = billingPeriod === 'monthly' ? 'Monthly' : 'Yearly';
    const renewalDate = data.next_billing_date
      ? new Date(data.next_billing_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A';
    const paymentDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const PLAN_AMOUNTS: Record<string, { monthly: string; yearly: string }> = {
      creator:  { monthly: '₹399.00',   yearly: '₹4,188.00' },
      business: { monthly: '₹1,999.00', yearly: '₹20,988.00' },
      starter:  { monthly: 'Free',      yearly: 'Free' },
    };
    const amountPaid = data.amount_override
      ?? (data.amount ? `₹${(data.amount / 100).toFixed(2)}` : (PLAN_AMOUNTS[planId]?.[billingPeriod as 'monthly' | 'yearly'] ?? 'Free'));
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    const transactionId = `TRN${Date.now().toString().slice(-9).padStart(9, '0')}`;

    // 1. Subscription confirmation email
    await this.email.sendSubscriptionConfirmed(toEmail, {
      userName: profile?.full_name ?? toEmail.split('@')[0],
      planName,
      amount: amountPaid,
      billingCycle: billingCycleLabel,
      renewalDate,
      subscriptionId,
      dashboardUrl: `${appUrl}/dashboard`,
    });

    // 2. Invoice email (with PDF attachment — also include download link)
    const userName = profile?.full_name ?? toEmail.split('@')[0];
    const invoiceDownloadUrl = `${this.config.get<string>('API_URL') ?? 'https://api.autoclipr.com'}/api/v1/billing/invoice/download?invoiceNumber=${invoiceNumber}&plan=${encodeURIComponent(planName)}&amount=${encodeURIComponent(amountPaid)}&date=${encodeURIComponent(paymentDate)}&name=${encodeURIComponent(userName)}&txId=${encodeURIComponent(transactionId)}`;
    await this.email.sendInvoice(toEmail, {
      userName: profile?.full_name ?? toEmail.split('@')[0],
      invoiceNumber,
      transactionId,
      paymentDate,
      amount: amountPaid,
      planName,
      invoiceUrl: invoiceDownloadUrl,
    });
  }
}
