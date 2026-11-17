import { Test } from '@nestjs/testing';
import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@autoclipr/emails';
import { SubscriptionsService } from './subscriptions.service';
import { DodoService } from './dodo.service';
import { SupabaseAdminService } from '../../database/supabase-admin.service';
import { UsersRepository } from '../users/users.repository';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { RetentionService } from '../retention/retention.service';
import { CouponsService } from '../coupons/coupons.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { createQueryBuilderMock, createSupabaseAdminServiceMock } from '../../test-utils/supabase-mock';

/**
 * A subscription as Dodo would report it for a real, completed payment.
 * Only the fields the verification reads are populated — the SDK's full
 * Subscription type has ~25 more that are irrelevant here.
 */
function paidSubscription(
  planId: string,
  billingPeriod: 'monthly' | 'yearly' = 'yearly',
  userId = 'user-1',
): any {
  return {
    subscription_id: 'sub_1',
    status: 'active',
    metadata: { user_id: userId, plan_id: planId, billing_period: billingPeriod },
  };
}

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let dodo: jest.Mocked<DodoService>;
  let supabaseMock: ReturnType<typeof createSupabaseAdminServiceMock>;
  let config: jest.Mocked<ConfigService>;
  let email: jest.Mocked<EmailService>;
  let usersRepo: jest.Mocked<UsersRepository>;
  let affiliates: jest.Mocked<AffiliatesService>;
  let retention: jest.Mocked<RetentionService>;
  let coupons: jest.Mocked<CouponsService>;
  let campaigns: jest.Mocked<CampaignsService>;

  beforeEach(async () => {
    dodo = {
      createCheckoutUrl: jest.fn(),
      getSubscription: jest.fn().mockResolvedValue(paidSubscription('creator')),
    } as unknown as jest.Mocked<DodoService>;

    supabaseMock = createSupabaseAdminServiceMock();
    // Default: every `.from()` call returns a fresh success-shaped builder unless a
    // test overrides it with mockReturnValueOnce for specific call sequences.
    supabaseMock.__client.from.mockImplementation(() => createQueryBuilderMock({ data: null, error: null }));

    config = { get: jest.fn() } as unknown as jest.Mocked<ConfigService>;

    email = {
      sendSubscriptionConfirmed: jest.fn().mockResolvedValue(undefined),
      sendInvoice: jest.fn().mockResolvedValue(undefined),
      sendSubscriptionEnded: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmailService>;

    usersRepo = {
      ensureProfile: jest.fn().mockResolvedValue(undefined),
      refundCredits: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UsersRepository>;

    affiliates = {
      awardCommission: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AffiliatesService>;

    retention = {
      clearWarningsForUser: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RetentionService>;

    coupons = {
      validate: jest.fn(),
      redeem: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<CouponsService>;

    campaigns = {
      recordRedemption: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CampaignsService>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: DodoService, useValue: dodo },
        { provide: SupabaseAdminService, useValue: supabaseMock },
        { provide: ConfigService, useValue: config },
        { provide: EmailService, useValue: email },
        { provide: UsersRepository, useValue: usersRepo },
        { provide: AffiliatesService, useValue: affiliates },
        { provide: RetentionService, useValue: retention },
        { provide: CouponsService, useValue: coupons },
        { provide: CampaignsService, useValue: campaigns },
      ],
    }).compile();

    service = moduleRef.get(SubscriptionsService);
    // Silence expected logger.warn/error noise from intentionally-failing sub-paths in tests.
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
  });

  describe('createCheckoutUrl', () => {
    it('builds success/cancel URLs from the configured web app URL and delegates to DodoService', async () => {
      config.get.mockReturnValue('https://app.autoclipr.com');
      dodo.createCheckoutUrl.mockResolvedValue('https://pay.dodo/session');

      const url = await service.createCheckoutUrl('user-1', 'jane@example.com', 'creator', 'yearly');

      expect(dodo.createCheckoutUrl).toHaveBeenCalledWith({
        planId: 'creator',
        billingPeriod: 'yearly',
        userId: 'user-1',
        email: 'jane@example.com',
        successUrl: 'https://app.autoclipr.com/dashboard?payment=success&plan=creator&billing=yearly',
        cancelUrl: 'https://app.autoclipr.com/pricing?payment=cancelled',
        discountCode: null,
        trialPeriodDays: null,
      });
      expect(url).toBe('https://pay.dodo/session');
    });

    it('passes a validated percentage coupon through as a Dodo discount code', async () => {
      coupons.validate.mockResolvedValue({
        id: 'c1', code: 'CREATOR15', type: 'percentage', value: 15,
        discountPaise: 6282, description: '15% off',
      } as never);
      dodo.createCheckoutUrl.mockResolvedValue('https://pay.dodo/session');

      await service.createCheckoutUrl('user-1', 'a@b.com', 'creator', 'monthly', 'CREATOR15');

      // Dodo's hosted page has no discount field, so this is the only moment
      // the code can affect what the customer is charged.
      expect(dodo.createCheckoutUrl).toHaveBeenCalledWith(
        expect.objectContaining({ discountCode: 'CREATOR15', trialPeriodDays: null }),
      );
    });

    it('turns a free_trial coupon into trial days, not a discount code', async () => {
      coupons.validate.mockResolvedValue({
        id: 'c2', code: 'TRY30', type: 'free_trial', value: 30,
        discountPaise: 0, description: '30 days free',
      } as never);

      await service.createCheckoutUrl('user-1', 'a@b.com', 'creator', 'monthly', 'TRY30');

      expect(dodo.createCheckoutUrl).toHaveBeenCalledWith(
        expect.objectContaining({ discountCode: null, trialPeriodDays: 30 }),
      );
    });

    it('sends neither for a free_credits coupon — Dodo knows nothing about those', async () => {
      coupons.validate.mockResolvedValue({
        id: 'c3', code: 'BONUS500', type: 'free_credits', value: 500,
        discountPaise: 0, description: '500 bonus credits',
      } as never);

      await service.createCheckoutUrl('user-1', 'a@b.com', 'creator', 'monthly', 'BONUS500');

      expect(dodo.createCheckoutUrl).toHaveBeenCalledWith(
        expect.objectContaining({ discountCode: null, trialPeriodDays: null }),
      );
    });

    it('re-validates the code rather than trusting the request', async () => {
      coupons.validate.mockRejectedValue(new BadRequestException('That coupon has expired.'));

      // Better to fail here than send the user to a checkout that silently
      // charges full price.
      await expect(
        service.createCheckoutUrl('user-1', 'a@b.com', 'creator', 'monthly', 'STALE'),
      ).rejects.toThrow('That coupon has expired.');
      expect(dodo.createCheckoutUrl).not.toHaveBeenCalled();
    });

    it('ignores a blank coupon code', async () => {
      await service.createCheckoutUrl('user-1', 'a@b.com', 'creator', 'monthly', '   ');

      expect(coupons.validate).not.toHaveBeenCalled();
    });

    it('falls back to the default web app URL when unconfigured', async () => {
      config.get.mockReturnValue(undefined);
      dodo.createCheckoutUrl.mockResolvedValue('https://pay.dodo/session');

      await service.createCheckoutUrl('user-1', 'jane@example.com', 'creator');

      expect(dodo.createCheckoutUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          billingPeriod: 'yearly',
          successUrl: 'https://autoclipr.com/dashboard?payment=success&plan=creator&billing=yearly',
        }),
      );
    });
  });

  describe('activatePlanForUser', () => {
    it('rejects a subscription whose plan is not one we sell', async () => {
      dodo.getSubscription.mockResolvedValue(paidSubscription('nonexistent'));

      await expect(service.activatePlanForUser('user-1', 'nonexistent', '', 'sub_1')).rejects.toThrow(
        'This subscription is not for a known plan.',
      );
      expect(usersRepo.ensureProfile).not.toHaveBeenCalled();
    });

    it.each([
      ['starter', 30],
      ['creator', 500],
      ['business', 1200],
    ])('activates the %s plan with %d credits and sends confirmation emails', async (planId, credits) => {
      const profileBuilder = createQueryBuilderMock({
        data: { email: 'jane@example.com', full_name: 'Jane' },
        error: null,
      });
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createQueryBuilderMock({ data: null, error: null });
      });

      dodo.getSubscription.mockResolvedValue(paidSubscription(planId, 'monthly'));

      await service.activatePlanForUser('user-1', planId, 'jane@example.com', 'sub_1', 'monthly');

      expect(usersRepo.ensureProfile).toHaveBeenCalledWith('user-1', 'jane@example.com');
      // Two separate `.update({ credits, subscription_tier })` calls touch 'profiles':
      // the activation update and (inside sendSubscriptionEmails) the profile lookup.
      const profileUpdateCall = profileBuilder.update.mock.calls.find((c: any[]) => 'credits' in c[0]);
      expect(profileUpdateCall[0]).toEqual(expect.objectContaining({ credits, subscription_tier: expect.any(String) }));
      expect(email.sendSubscriptionConfirmed).toHaveBeenCalled();
      expect(email.sendInvoice).toHaveBeenCalled();
    });

    it('maps each plan id to its subscription tier', async () => {
      const profileBuilder = createQueryBuilderMock({ data: { email: 'jane@example.com' }, error: null });
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createQueryBuilderMock({ data: null, error: null });
      });

      dodo.getSubscription.mockResolvedValue(paidSubscription('business'));

      await service.activatePlanForUser('user-1', 'business', 'jane@example.com', 'sub_1');

      const profileUpdateCall = profileBuilder.update.mock.calls.find((c: any[]) => 'credits' in c[0]);
      expect(profileUpdateCall[0].subscription_tier).toBe('business');
    });

    it('sets a ~30-day period end for monthly billing and ~365-day for yearly', async () => {
      const subBuilder = createQueryBuilderMock({ data: null, error: null });
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') return subBuilder;
        return createQueryBuilderMock({ data: { email: 'jane@example.com' }, error: null });
      });
      const before = Date.now();

      dodo.getSubscription.mockResolvedValue(paidSubscription('creator', 'monthly'));

      await service.activatePlanForUser('user-1', 'creator', 'jane@example.com', 'sub_1', 'monthly');

      const upsertArg = subBuilder.upsert.mock.calls[0][0];
      const periodEndMs = new Date(upsertArg.current_period_end).getTime();
      const diffDays = (periodEndMs - before) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThan(31);
    });

    it('logs but does not throw when the profile update fails', async () => {
      const profileBuilder = createQueryBuilderMock({ data: { email: 'jane@example.com' }, error: null });
      profileBuilder.update.mockImplementation(() => {
        const b = createQueryBuilderMock({ data: null, error: { message: 'profile update failed' } });
        return b;
      });
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createQueryBuilderMock({ data: null, error: null });
      });

      await expect(
        service.activatePlanForUser('user-1', 'creator', 'jane@example.com', 'sub_1'),
      ).resolves.toBeUndefined();
    });

    it('logs but does not throw when recording the billing transaction fails', async () => {
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'billing_transactions') {
          return { insert: jest.fn().mockRejectedValue(new Error('insert failed')) } as any;
        }
        if (table === 'profiles') return createQueryBuilderMock({ data: { email: 'jane@example.com' }, error: null });
        return createQueryBuilderMock({ data: null, error: null });
      });

      await expect(
        service.activatePlanForUser('user-1', 'creator', 'jane@example.com', 'sub_1'),
      ).resolves.toBeUndefined();
    });

    it('logs but does not throw when awarding the affiliate commission fails', async () => {
      affiliates.awardCommission.mockRejectedValue(new Error('commission failed'));
      supabaseMock.__client.from.mockImplementation(() =>
        createQueryBuilderMock({ data: { email: 'jane@example.com' }, error: null }),
      );

      await expect(
        service.activatePlanForUser('user-1', 'creator', 'jane@example.com', 'sub_1'),
      ).resolves.toBeUndefined();
    });

    // These pin the fix for the activation bypass: a signed-in user could POST
    // {"planId":"business"} and be granted a paid plan, because nothing checked
    // with Dodo that a payment had happened.
    describe('coupons', () => {
      function arrangeActivation() {
        const profileBuilder = createQueryBuilderMock({ data: { email: 'a@b.com' }, error: null });
        supabaseMock.__client.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileBuilder;
          return createQueryBuilderMock({ data: null, error: null });
        });
        return profileBuilder;
      }

      it('claims the coupon Dodo recorded, not one from the request', async () => {
        arrangeActivation();
        dodo.getSubscription.mockResolvedValue({
          ...paidSubscription('creator'),
          metadata: {
            user_id: 'user-1',
            plan_id: 'creator',
            billing_period: 'yearly',
            coupon_code: 'CREATOR20',
          },
        } as never);
        coupons.validate.mockResolvedValue({
          id: 'c1', code: 'CREATOR20', type: 'percentage', value: 20,
          discountPaise: 83_760, description: '20% off',
        } as never);

        await service.activatePlanForUser('user-1', 'creator', 'a@b.com', 'sub_1');

        expect(coupons.redeem).toHaveBeenCalledWith('c1', 'user-1', 'creator', 83_760);
      });

      it('grants bonus credits for a free_credits coupon', async () => {
        arrangeActivation();
        dodo.getSubscription.mockResolvedValue({
          ...paidSubscription('creator'),
          metadata: {
            user_id: 'user-1', plan_id: 'creator', billing_period: 'yearly', coupon_code: 'BONUS',
          },
        } as never);
        coupons.validate.mockResolvedValue({
          id: 'c2', code: 'BONUS', type: 'free_credits', value: 500,
          discountPaise: 0, description: '500 bonus credits',
        } as never);

        await service.activatePlanForUser('user-1', 'creator', 'a@b.com', 'sub_1');

        expect(usersRepo.refundCredits).toHaveBeenCalledWith(
          'user-1', 500, 'coupon_bonus', undefined,
        );
      });

      it('does not grant credits when the claim was refused', async () => {
        arrangeActivation();
        dodo.getSubscription.mockResolvedValue({
          ...paidSubscription('creator'),
          metadata: {
            user_id: 'user-1', plan_id: 'creator', billing_period: 'yearly', coupon_code: 'BONUS',
          },
        } as never);
        coupons.validate.mockResolvedValue({
          id: 'c2', code: 'BONUS', type: 'free_credits', value: 500,
          discountPaise: 0, description: '500 bonus credits',
        } as never);
        coupons.redeem.mockResolvedValue(false);

        await service.activatePlanForUser('user-1', 'creator', 'a@b.com', 'sub_1');

        expect(usersRepo.refundCredits).not.toHaveBeenCalled();
      });

      it('still activates the plan when the coupon fails', async () => {
        arrangeActivation();
        dodo.getSubscription.mockResolvedValue({
          ...paidSubscription('creator'),
          metadata: {
            user_id: 'user-1', plan_id: 'creator', billing_period: 'yearly', coupon_code: 'GONE',
          },
        } as never);
        coupons.validate.mockRejectedValue(new Error('coupon exhausted'));

        // The payment already succeeded — coupon bookkeeping must never undo
        // the plan the user paid for.
        await expect(
          service.activatePlanForUser('user-1', 'creator', 'a@b.com', 'sub_1'),
        ).resolves.toBeUndefined();
        expect(email.sendSubscriptionConfirmed).toHaveBeenCalled();
      });

      it('skips coupon handling entirely when none was used', async () => {
        arrangeActivation();

        await service.activatePlanForUser('user-1', 'creator', 'a@b.com', 'sub_1');

        expect(coupons.redeem).not.toHaveBeenCalled();
      });
    });

    describe('checkout with a coupon', () => {
      it('passes a percentage code to Dodo as a discount', async () => {
        coupons.validate.mockResolvedValue({
          id: 'c1', code: 'CREATOR20', type: 'percentage', value: 20,
          discountPaise: 83_760, description: '20% off',
        } as never);

        await service.createCheckoutUrl('u1', 'a@b.com', 'creator', 'yearly', 'CREATOR20');

        expect(dodo.createCheckoutUrl).toHaveBeenCalledWith(
          expect.objectContaining({ discountCode: 'CREATOR20', trialPeriodDays: null }),
        );
      });

      it('passes a trial coupon as trial days, not a discount', async () => {
        coupons.validate.mockResolvedValue({
          id: 'c3', code: 'TRIAL30', type: 'free_trial', value: 30,
          discountPaise: 0, description: '30 days free',
        } as never);

        await service.createCheckoutUrl('u1', 'a@b.com', 'creator', 'yearly', 'TRIAL30');

        expect(dodo.createCheckoutUrl).toHaveBeenCalledWith(
          expect.objectContaining({ discountCode: null, trialPeriodDays: 30 }),
        );
      });

      it('sends neither for a credits coupon', async () => {
        coupons.validate.mockResolvedValue({
          id: 'c2', code: 'BONUS', type: 'free_credits', value: 500,
          discountPaise: 0, description: '500 bonus credits',
        } as never);

        await service.createCheckoutUrl('u1', 'a@b.com', 'creator', 'yearly', 'BONUS');

        expect(dodo.createCheckoutUrl).toHaveBeenCalledWith(
          expect.objectContaining({ discountCode: null, trialPeriodDays: null }),
        );
      });

      it('refuses checkout when the coupon is invalid', async () => {
        coupons.validate.mockRejectedValue(new BadRequestException('That coupon has expired.'));

        // Better to tell the user now than send them to a checkout that
        // silently charges full price.
        await expect(
          service.createCheckoutUrl('u1', 'a@b.com', 'creator', 'yearly', 'OLD'),
        ).rejects.toThrow('That coupon has expired.');
        expect(dodo.createCheckoutUrl).not.toHaveBeenCalled();
      });

      it('ignores a blank coupon code', async () => {
        await service.createCheckoutUrl('u1', 'a@b.com', 'creator', 'yearly', '   ');

        expect(coupons.validate).not.toHaveBeenCalled();
      });
    });

    describe('payment verification', () => {
      it('refuses to activate without a subscription id', async () => {
        await expect(
          service.activatePlanForUser('attacker', 'business', 'a@b.com'),
        ).rejects.toThrow('A subscription id is required to activate a plan.');

        expect(dodo.getSubscription).not.toHaveBeenCalled();
        expect(usersRepo.ensureProfile).not.toHaveBeenCalled();
      });

      it('refuses a subscription belonging to a different user', async () => {
        dodo.getSubscription.mockResolvedValue(paidSubscription('business', 'yearly', 'victim'));

        await expect(
          service.activatePlanForUser('attacker', 'business', 'a@b.com', 'sub_1'),
        ).rejects.toThrow('This payment does not belong to your account.');

        expect(usersRepo.ensureProfile).not.toHaveBeenCalled();
      });

      it.each(['pending', 'cancelled', 'failed', 'expired', 'on_hold'])(
        'refuses a subscription in %s status',
        async (status) => {
          dodo.getSubscription.mockResolvedValue({ ...paidSubscription('business'), status });

          await expect(
            service.activatePlanForUser('user-1', 'business', 'a@b.com', 'sub_1'),
          ).rejects.toThrow('This subscription is not active.');
        },
      );

      it('fails closed when Dodo cannot be reached', async () => {
        dodo.getSubscription.mockRejectedValue(new Error('dodo timeout'));

        await expect(
          service.activatePlanForUser('user-1', 'creator', 'a@b.com', 'sub_1'),
        ).rejects.toThrow('Could not verify this payment.');

        expect(usersRepo.ensureProfile).not.toHaveBeenCalled();
      });

      it('grants the plan Dodo reports, not the one the request claimed', async () => {
        // The attack: ask for business, having only paid for creator.
        dodo.getSubscription.mockResolvedValue(paidSubscription('creator', 'monthly'));
        const profileBuilder = createQueryBuilderMock({ data: { email: 'a@b.com' }, error: null });
        supabaseMock.__client.from.mockImplementation((table: string) => {
          if (table === 'profiles') return profileBuilder;
          return createQueryBuilderMock({ data: null, error: null });
        });

        await service.activatePlanForUser('user-1', 'business', 'a@b.com', 'sub_1', 'yearly');

        const update = profileBuilder.update.mock.calls.find((c: any[]) => 'credits' in c[0]);
        expect(update[0].subscription_tier).toBe('creator');
        expect(update[0].credits).toBe(500);
      });

      it('looks the subscription up by the id the caller supplied', async () => {
        await service.activatePlanForUser('user-1', 'creator', 'a@b.com', 'sub_xyz');

        expect(dodo.getSubscription).toHaveBeenCalledWith('sub_xyz');
      });
    });

    it('skips subscription emails when no email can be resolved', async () => {
      supabaseMock.__client.from.mockImplementation(() => createQueryBuilderMock({ data: { email: null }, error: null }));

      await service.activatePlanForUser('user-1', 'creator', '', 'sub_1');

      expect(email.sendSubscriptionConfirmed).not.toHaveBeenCalled();
      expect(email.sendInvoice).not.toHaveBeenCalled();
    });
  });

  describe('campaign attribution', () => {
    it('credits the campaign email that drove a coupon redemption', async () => {
      coupons.validate.mockResolvedValue({
        id: 'c1', code: 'SATURDAY25', type: 'percentage', value: 25,
        discountPaise: 9975, description: '25% off',
      } as never);
      dodo.getSubscription.mockResolvedValue({
        ...paidSubscription('creator'),
        metadata: { user_id: 'user-1', plan_id: 'creator', billing_period: 'yearly', coupon_code: 'SATURDAY25' },
      });

      await service.activatePlanForUser('user-1', 'creator', 'a@b.com', 'sub_1');

      // Without this a campaign's redeemed/converted counts stay at zero no
      // matter how well it performed.
      expect(campaigns.recordRedemption).toHaveBeenCalledWith('user-1');
    });

    it('does not credit a campaign when no coupon was used', async () => {
      await service.activatePlanForUser('user-1', 'creator', 'a@b.com', 'sub_1');

      expect(campaigns.recordRedemption).not.toHaveBeenCalled();
    });
  });

  describe('getTransactions', () => {
    it('returns the ordered transaction list', async () => {
      const rows = [{ id: 'tx-1' }];
      supabaseMock.__client.from.mockImplementation(() => createQueryBuilderMock({ data: rows, error: null }));

      const result = await service.getTransactions('user-1');

      expect(result).toEqual(rows);
    });

    it('returns an empty array when data is null', async () => {
      supabaseMock.__client.from.mockImplementation(() => createQueryBuilderMock({ data: null, error: null }));

      const result = await service.getTransactions('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('handleWebhookEvent', () => {
    const baseData = {
      metadata: { user_id: 'user-1', plan_id: 'creator' },
      subscription_id: 'sub_123',
      customer: { email: 'jane@example.com' },
    };

    function setupUpsertMocks() {
      const subBuilder = createQueryBuilderMock({ data: null, error: null });
      const profileBuilder = createQueryBuilderMock({ data: { email: 'jane@example.com' }, error: null });
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') return subBuilder;
        if (table === 'profiles') return profileBuilder;
        return createQueryBuilderMock({ data: null, error: null });
      });
      return { subBuilder, profileBuilder };
    }

    it.each(['subscription.active', 'subscription.created'])(
      'activates the subscription on %s',
      async (eventType) => {
        const { subBuilder, profileBuilder } = setupUpsertMocks();

        await service.handleWebhookEvent({ event_type: eventType, data: baseData });

        expect(subBuilder.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ user_id: 'user-1', plan_id: 'creator', status: 'active' }),
          { onConflict: 'user_id' },
        );
        const profileUpdateArg = profileBuilder.update.mock.calls[0][0];
        expect(profileUpdateArg).toEqual(
          expect.objectContaining({ subscription_tier: 'creator', credits: 500 }),
        );
        expect(affiliates.awardCommission).toHaveBeenCalledWith('user-1', 'creator', 'monthly', 'sub_123');
        expect(email.sendSubscriptionConfirmed).toHaveBeenCalled();
      },
    );

    it('activates on subscription.renewed', async () => {
      const { subBuilder } = setupUpsertMocks();

      await service.handleWebhookEvent({ event_type: 'subscription.renewed', data: baseData });

      expect(subBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }), {
        onConflict: 'user_id',
      });
    });

    it('activates on subscription.plan_changed', async () => {
      const { subBuilder } = setupUpsertMocks();

      await service.handleWebhookEvent({ event_type: 'subscription.plan_changed', data: baseData });

      expect(subBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }), {
        onConflict: 'user_id',
      });
    });

    it('ends access immediately on subscription.cancelled when no paid period is left', async () => {
      const { subBuilder, profileBuilder } = setupUpsertMocks();
      subBuilder.__setResult({ data: [{ user_id: 'user-1' }], error: null });

      await service.handleWebhookEvent({ event_type: 'subscription.cancelled', data: baseData });

      expect(subBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled', cancel_at_period_end: false }));
      const profileUpdateArg = profileBuilder.update.mock.calls[0][0];
      expect(profileUpdateArg.subscription_tier).toBe('starter');
      expect(profileUpdateArg).not.toHaveProperty('credits');
      expect(affiliates.awardCommission).not.toHaveBeenCalled();
      expect(email.sendSubscriptionConfirmed).not.toHaveBeenCalled();
    });

    it('keeps access on subscription.cancelled while the paid period is still running', async () => {
      const { subBuilder, profileBuilder } = setupUpsertMocks();
      const future = new Date(Date.now() + 10 * 86400000).toISOString();

      await service.handleWebhookEvent({
        event_type: 'subscription.cancelled',
        data: { ...baseData, next_billing_date: future },
      });

      expect(subBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled', cancel_at_period_end: true, cancellation_effective_at: future }),
      );
      expect(profileBuilder.update).not.toHaveBeenCalled();
    });

    it('marks the subscription expired and removes access on subscription.expired', async () => {
      const { subBuilder, profileBuilder } = setupUpsertMocks();
      subBuilder.__setResult({ data: [{ user_id: 'user-1' }], error: null });

      await service.handleWebhookEvent({ event_type: 'subscription.expired', data: baseData });

      expect(subBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }));
      expect(profileBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ subscription_tier: 'starter' }));
      expect(email.sendSubscriptionEnded).toHaveBeenCalledWith('jane@example.com', expect.objectContaining({ planName: 'Creator' }));
    });

    it.each(['subscription.on_hold', 'subscription.failed'])('marks the subscription on_hold on %s', async (eventType) => {
      const { subBuilder } = setupUpsertMocks();

      await service.handleWebhookEvent({ event_type: eventType, data: baseData });

      expect(subBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'on_hold' }), {
        onConflict: 'user_id',
      });
    });

    it('logs payment.succeeded without touching the database', async () => {
      await service.handleWebhookEvent({ event_type: 'payment.succeeded', data: { payment_id: 'pay_1' } });

      expect(supabaseMock.__client.from).not.toHaveBeenCalled();
    });

    it('ignores unknown event types entirely', async () => {
      await service.handleWebhookEvent({ event_type: 'something.unrecognized', data: baseData });

      expect(supabaseMock.__client.from).not.toHaveBeenCalled();
    });

    it('treats an event with neither event_type nor type as unrecognized', async () => {
      await service.handleWebhookEvent({ data: baseData });

      expect(supabaseMock.__client.from).not.toHaveBeenCalled();
    });

    it('falls back to `type` when `event_type` is absent', async () => {
      const { subBuilder } = setupUpsertMocks();

      await service.handleWebhookEvent({ type: 'subscription.active', data: baseData });

      expect(subBuilder.upsert).toHaveBeenCalled();
    });

    it('does nothing when the event has no data payload', async () => {
      await service.handleWebhookEvent({ event_type: 'subscription.active', data: undefined });

      expect(supabaseMock.__client.from).not.toHaveBeenCalled();
    });

    it('skips the upsert and warns when the event is missing a user id in metadata/customer', async () => {
      const { subBuilder } = setupUpsertMocks();

      await service.handleWebhookEvent({
        event_type: 'subscription.active',
        data: { metadata: {}, customer: {} },
      });

      expect(subBuilder.upsert).not.toHaveBeenCalled();
    });

    it('falls back to customer.id when metadata.user_id is absent', async () => {
      const { subBuilder } = setupUpsertMocks();

      await service.handleWebhookEvent({
        event_type: 'subscription.active',
        data: { ...baseData, metadata: { plan_id: 'creator' }, customer: { id: 'cust-1', email: 'jane@example.com' } },
      });

      expect(subBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'cust-1' }), {
        onConflict: 'user_id',
      });
    });

    it('defaults to the starter plan when metadata.plan_id is absent', async () => {
      const { subBuilder, profileBuilder } = setupUpsertMocks();

      await service.handleWebhookEvent({
        event_type: 'subscription.active',
        data: { ...baseData, metadata: { user_id: 'user-1' } },
      });

      expect(subBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ plan_id: 'starter' }), {
        onConflict: 'user_id',
      });
      const profileUpdateArg = profileBuilder.update.mock.calls[0][0];
      expect(profileUpdateArg.credits).toBe(30);
    });

    it('stops before updating the profile when the subscription upsert fails', async () => {
      const failingSubBuilder = createQueryBuilderMock({ data: null, error: { message: 'upsert failed' } });
      const profileBuilder = createQueryBuilderMock({ data: { email: 'jane@example.com' }, error: null });
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') return failingSubBuilder;
        if (table === 'profiles') return profileBuilder;
        return createQueryBuilderMock({ data: null, error: null });
      });

      await service.handleWebhookEvent({ event_type: 'subscription.active', data: baseData });

      expect(profileBuilder.update).not.toHaveBeenCalled();
    });

    it('logs but does not throw when the profile update fails', async () => {
      const subBuilder = createQueryBuilderMock({ data: null, error: null });
      const profileBuilder = createQueryBuilderMock({ data: null, error: { message: 'profile update failed' } });
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') return subBuilder;
        if (table === 'profiles') return profileBuilder;
        return createQueryBuilderMock({ data: null, error: null });
      });

      await expect(
        service.handleWebhookEvent({ event_type: 'subscription.active', data: baseData }),
      ).resolves.toBeUndefined();
    });

    it('logs but does not throw when awarding the affiliate commission fails', async () => {
      setupUpsertMocks();
      affiliates.awardCommission.mockRejectedValue(new Error('commission failed'));

      await expect(
        service.handleWebhookEvent({ event_type: 'subscription.active', data: baseData }),
      ).resolves.toBeUndefined();
    });

    it('uses monthly billing_period from the event data when provided', async () => {
      setupUpsertMocks();

      await service.handleWebhookEvent({
        event_type: 'subscription.active',
        data: { ...baseData, billing_period: 'yearly' },
      });

      expect(affiliates.awardCommission).toHaveBeenCalledWith('user-1', 'creator', 'yearly', 'sub_123');
    });

    it('falls back to the starter tier and 30 credits for a plan id absent from PLAN_TIER/PLAN_CREDITS', async () => {
      const { subBuilder, profileBuilder } = setupUpsertMocks();

      await service.handleWebhookEvent({
        event_type: 'subscription.active',
        data: { ...baseData, metadata: { user_id: 'user-1', plan_id: 'enterprise' } },
      });

      expect(subBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ plan_id: 'enterprise' }), {
        onConflict: 'user_id',
      });
      const profileUpdateArg = profileBuilder.update.mock.calls[0][0];
      expect(profileUpdateArg.subscription_tier).toBe('starter');
      expect(profileUpdateArg.credits).toBe(30);
    });

    it('formats a numeric data.amount (in paise) into the confirmation email amount', async () => {
      setupUpsertMocks();

      await service.handleWebhookEvent({
        event_type: 'subscription.active',
        data: { ...baseData, amount: 39900 },
      });

      expect(email.sendSubscriptionConfirmed).toHaveBeenCalledWith(
        'jane@example.com',
        expect.objectContaining({ amount: '₹399.00' }),
      );
    });

    it('formats next_billing_date into the renewal date shown in the confirmation email', async () => {
      setupUpsertMocks();

      await service.handleWebhookEvent({
        event_type: 'subscription.active',
        data: { ...baseData, next_billing_date: '2027-03-15T00:00:00.000Z' },
      });

      expect(email.sendSubscriptionConfirmed).toHaveBeenCalledWith(
        'jane@example.com',
        expect.objectContaining({ renewalDate: expect.not.stringContaining('N/A') }),
      );
    });

    it('skips subscription emails when no email is resolvable for the user', async () => {
      const subBuilder = createQueryBuilderMock({ data: null, error: null });
      const profileBuilder = createQueryBuilderMock({ data: { email: null }, error: null });
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') return subBuilder;
        if (table === 'profiles') return profileBuilder;
        return createQueryBuilderMock({ data: null, error: null });
      });

      await service.handleWebhookEvent({
        event_type: 'subscription.active',
        data: { ...baseData, customer: {} },
      });

      expect(email.sendSubscriptionConfirmed).not.toHaveBeenCalled();
    });
  });

  // ─── Cancellation ────────────────────────────────────────────────────────

  describe('cancellation', () => {
    const periodEnd = '2026-12-01T00:00:00.000Z';
    const activeRow = {
      user_id: 'user-1',
      plan_id: 'creator',
      status: 'active',
      current_period_end: periodEnd,
      stripe_subscription_id: 'sub_1',
      cancel_at_period_end: false,
      cancellation_requested_at: null,
      cancellation_effective_at: null,
      cancelled_at: null,
      last_webhook_at: null,
    };

    /**
     * user_subscriptions builder: reads (maybeSingle) return `row`, and the
     * lock-claiming update (awaited directly) returns `claimed` rows.
     */
    function mockTables(row: any, claimed = true) {
      const subBuilder = createQueryBuilderMock({ data: claimed ? [{ user_id: 'user-1' }] : [], error: null });
      subBuilder.maybeSingle = jest.fn(() => Promise.resolve({ data: row, error: null }));
      const profileBuilder = createQueryBuilderMock({ data: { email: 'jane@example.com', full_name: 'Jane Doe' }, error: null });
      const webhookBuilder = createQueryBuilderMock({ data: null, error: null });
      supabaseMock.__client.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') return subBuilder;
        if (table === 'profiles') return profileBuilder;
        if (table === 'processed_webhook_events') return webhookBuilder;
        return createQueryBuilderMock({ data: null, error: null });
      });
      return { subBuilder, profileBuilder, webhookBuilder };
    }

    beforeEach(() => {
      (dodo as any).scheduleCancellation = jest.fn().mockResolvedValue({
        cancel_at_next_billing_date: true,
        next_billing_date: periodEnd,
      });
      (dodo as any).resumeSubscription = jest.fn().mockResolvedValue({ cancel_at_next_billing_date: false });
      (email as any).sendSubscriptionCancelled = jest.fn().mockResolvedValue(undefined);
      (email as any).sendCancellationFailed = jest.fn().mockResolvedValue(undefined);
      (email as any).sendSubscriptionEnded = jest.fn().mockResolvedValue(undefined);
    });

    it('schedules cancellation at period end with Dodo and keeps access until then', async () => {
      const { subBuilder, profileBuilder } = mockTables(activeRow);

      const result = await service.cancelSubscription('user-1', { reason: 'too_expensive' });

      expect(dodo.getSubscription).toHaveBeenCalledWith('sub_1');
      expect((dodo as any).scheduleCancellation).toHaveBeenCalledWith('sub_1', { feedback: 'too_expensive', comment: null });
      expect(subBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ cancel_at_period_end: true, cancellation_effective_at: periodEnd, cancellation_reason: 'too_expensive' }),
      );
      // Access is not removed now.
      expect(profileBuilder.update).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ cancel_at_period_end: true }));
      expect((email as any).sendSubscriptionCancelled).toHaveBeenCalledWith(
        'jane@example.com',
        expect.objectContaining({ planName: 'Creator', accessUntil: 'December 1, 2026' }),
      );
    });

    it('returns the existing state without calling Dodo when already scheduled', async () => {
      mockTables({ ...activeRow, cancel_at_period_end: true, cancellation_effective_at: periodEnd });

      const result = await service.cancelSubscription('user-1');

      expect((dodo as any).scheduleCancellation).not.toHaveBeenCalled();
      expect((email as any).sendSubscriptionCancelled).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ cancel_at_period_end: true, access_until: periodEnd }));
    });

    it('rejects users without a paid subscription', async () => {
      mockTables({ ...activeRow, plan_id: 'starter' });
      await expect(service.cancelSubscription('user-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a subscription that is no longer active', async () => {
      mockTables({ ...activeRow, status: 'cancelled' });
      await expect(service.cancelSubscription('user-1')).rejects.toBeInstanceOf(BadRequestException);
      expect((dodo as any).scheduleCancellation).not.toHaveBeenCalled();
    });

    it("refuses to cancel a subscription Dodo says belongs to someone else", async () => {
      const { subBuilder } = mockTables(activeRow);
      dodo.getSubscription.mockResolvedValueOnce(paidSubscription('creator', 'yearly', 'someone-else'));

      await expect(service.cancelSubscription('user-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect((dodo as any).scheduleCancellation).not.toHaveBeenCalled();
      // Lock released.
      expect(subBuilder.update).toHaveBeenCalledWith({ cancellation_requested_at: null });
    });

    it('releases the lock, emails a failure notice and reports an error when Dodo fails', async () => {
      const { subBuilder } = mockTables(activeRow);
      (dodo as any).scheduleCancellation.mockRejectedValueOnce(new Error('Dodo 500'));

      await expect(service.cancelSubscription('user-1')).rejects.toBeInstanceOf(BadGatewayException);
      expect(subBuilder.update).toHaveBeenCalledWith({ cancellation_requested_at: null });
      expect((email as any).sendCancellationFailed).toHaveBeenCalledWith('jane@example.com', expect.objectContaining({ planName: 'Creator' }));
      expect((email as any).sendSubscriptionCancelled).not.toHaveBeenCalled();
    });

    it('rejects a second request while one is already in progress', async () => {
      mockTables(activeRow, false);

      await expect(service.cancelSubscription('user-1')).rejects.toBeInstanceOf(ConflictException);
      expect((dodo as any).scheduleCancellation).not.toHaveBeenCalled();
    });

    it('still succeeds when the confirmation email fails', async () => {
      mockTables(activeRow);
      // EmailService swallows send errors; a resolved no-op models a failed send.
      (email as any).sendSubscriptionCancelled.mockResolvedValueOnce(undefined);

      await expect(service.cancelSubscription('user-1')).resolves.toEqual(
        expect.objectContaining({ cancel_at_period_end: true }),
      );
    });

    it('undoes a scheduled cancellation with Dodo', async () => {
      const future = new Date(Date.now() + 5 * 86400000).toISOString();
      const { subBuilder } = mockTables({ ...activeRow, cancel_at_period_end: true, cancellation_effective_at: future });

      await service.resumeSubscription('user-1');

      expect((dodo as any).resumeSubscription).toHaveBeenCalledWith('sub_1');
      expect(subBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ cancel_at_period_end: false, status: 'active' }));
    });

    it('skips a duplicate webhook delivery', async () => {
      const { webhookBuilder, subBuilder } = mockTables(activeRow);
      webhookBuilder.__setResult({ data: null, error: { message: 'duplicate', code: '23505' } });

      await service.handleWebhookEvent({ event_type: 'subscription.expired', data: { metadata: { user_id: 'user-1' } } }, 'wh_1');

      expect(subBuilder.update).not.toHaveBeenCalled();
      expect((email as any).sendSubscriptionEnded).not.toHaveBeenCalled();
    });

    it('ignores a webhook older than the last one applied', async () => {
      const { subBuilder } = mockTables({ ...activeRow, last_webhook_at: '2026-11-18T10:00:00Z' });

      await service.handleWebhookEvent(
        { event_type: 'subscription.active', timestamp: '2026-11-18T09:00:00Z', data: { metadata: { user_id: 'user-1', plan_id: 'creator' }, subscription_id: 'sub_1' } },
        'wh_2',
      );

      expect(subBuilder.upsert).not.toHaveBeenCalled();
    });

    it('syncs a scheduled cancellation from subscription.updated without resetting credits', async () => {
      const { subBuilder, profileBuilder } = mockTables(activeRow);

      await service.handleWebhookEvent({
        event_type: 'subscription.updated',
        data: { metadata: { user_id: 'user-1' }, cancel_at_next_billing_date: true, next_billing_date: periodEnd },
      });

      expect(subBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ cancel_at_period_end: true, cancellation_effective_at: periodEnd }),
      );
      expect(profileBuilder.update).not.toHaveBeenCalled();
    });

    it('the sweep removes access once a cancelled period has ended', async () => {
      const { subBuilder, profileBuilder } = mockTables(activeRow);
      subBuilder.__setResult({ data: [{ user_id: 'user-1', plan_id: 'creator' }], error: null });

      const ended = await service.endExpiredCancellations();

      expect(ended).toBe(1);
      expect(profileBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ subscription_tier: 'starter' }));
      expect((email as any).sendSubscriptionEnded).toHaveBeenCalledTimes(1);
    });
  });
});
