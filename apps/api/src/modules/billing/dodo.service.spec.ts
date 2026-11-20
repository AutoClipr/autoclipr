const mockSubscriptionsCreate = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();
const mockSubscriptionsUpdate = jest.fn();
const mockSubscriptionsChangePlan = jest.fn();
const mockWebhooksUnwrap = jest.fn();
const mockDiscountsCreate = jest.fn();
const mockCustomersList = jest.fn();
const mockSubscriptionsList = jest.fn();
const mockDiscountsUpdate = jest.fn();
const mockDiscountsDelete = jest.fn();

const mockCheckoutSessionsCreate = jest.fn();

const MockDodoPayments = jest.fn().mockImplementation(() => ({
  checkoutSessions: {
    create: mockCheckoutSessionsCreate,
  },
  subscriptions: {
    create: mockSubscriptionsCreate,
    retrieve: mockSubscriptionsRetrieve,
    update: mockSubscriptionsUpdate,
    changePlan: mockSubscriptionsChangePlan,
    list: mockSubscriptionsList,
  },
  customers: {
    list: mockCustomersList,
  },
  webhooks: {
    unwrap: mockWebhooksUnwrap,
  },
  discounts: {
    create: mockDiscountsCreate,
    update: mockDiscountsUpdate,
    delete: mockDiscountsDelete,
  },
}));

jest.mock('dodopayments', () => MockDodoPayments);

// dodo.service.ts computes its PRODUCT_IDS map from process.env at *module load* time,
// so these must be set before the module is first require()'d below (TypeScript's
// CommonJS emit preserves source order between plain statements and import declarations).
process.env.DODO_PRODUCT_CREATOR_MONTHLY = 'prod_creator_monthly';
process.env.DODO_PRODUCT_CREATOR_YEARLY = 'prod_creator_yearly';
process.env.DODO_PRODUCT_BUSINESS_MONTHLY = 'prod_business_monthly';
process.env.DODO_PRODUCT_BUSINESS_YEARLY = 'prod_business_yearly';
process.env.DODO_PRODUCT_PRO_MONTHLY = 'prod_pro_monthly';

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DodoService } from './dodo.service';

describe('DodoService', () => {
  let service: DodoService;
  let config: jest.Mocked<ConfigService>;

  const configValues: Record<string, string> = {
    DODO_API_KEY: 'test-key',
    DODO_LIVE_MODE: 'false',
    DODO_WEBHOOK_SECRET: 'whsec_test',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    config = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as jest.Mocked<ConfigService>;

    const moduleRef = await Test.createTestingModule({
      providers: [DodoService, { provide: ConfigService, useValue: config }],
    }).compile();

    service = moduleRef.get(DodoService);
  });

  it('constructs the Dodo client in test_mode when DODO_LIVE_MODE is not "true"', () => {
    expect(MockDodoPayments).toHaveBeenCalledWith({ bearerToken: 'test-key', environment: 'test_mode' });
  });

  it('constructs the Dodo client in live_mode when DODO_LIVE_MODE is "true"', async () => {
    configValues.DODO_LIVE_MODE = 'true';
    const moduleRef = await Test.createTestingModule({
      providers: [DodoService, { provide: ConfigService, useValue: config }],
    }).compile();
    moduleRef.get(DodoService);

    expect(MockDodoPayments).toHaveBeenCalledWith({ bearerToken: 'test-key', environment: 'live_mode' });
    configValues.DODO_LIVE_MODE = 'false';
  });

  it('defaults bearerToken to an empty string when DODO_API_KEY is unset', async () => {
    const sparseConfig = { get: jest.fn(() => undefined) } as unknown as jest.Mocked<ConfigService>;
    const moduleRef = await Test.createTestingModule({
      providers: [DodoService, { provide: ConfigService, useValue: sparseConfig }],
    }).compile();
    moduleRef.get(DodoService);

    expect(MockDodoPayments).toHaveBeenCalledWith({ bearerToken: '', environment: 'test_mode' });
  });

  describe('changePlan', () => {
    it('updates the metadata, then moves the subscription to the monthly product, prorated', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({});
      mockSubscriptionsChangePlan.mockResolvedValue(undefined);

      await service.changePlan('sub_1', 'pro', { user_id: 'u1', plan_id: 'creator' });

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
        metadata: { user_id: 'u1', plan_id: 'pro', billing_period: 'monthly' },
      });
      expect(mockSubscriptionsChangePlan).toHaveBeenCalledWith('sub_1', {
        product_id: 'prod_pro_monthly',
        quantity: 1,
        proration_billing_mode: 'prorated_immediately',
      });
    });

    it('restores the metadata when the plan change fails', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({});
      mockSubscriptionsChangePlan.mockRejectedValue(new Error('declined'));

      await expect(service.changePlan('sub_1', 'business', { user_id: 'u1', plan_id: 'creator' })).rejects.toThrow('declined');
      expect(mockSubscriptionsUpdate).toHaveBeenLastCalledWith('sub_1', { metadata: { user_id: 'u1', plan_id: 'creator' } });
    });

    it('refuses a plan without a monthly product', async () => {
      await expect(service.changePlan('sub_1', 'starter')).rejects.toThrow('No product configured');
      expect(mockSubscriptionsChangePlan).not.toHaveBeenCalled();
    });

    it('defaults to empty metadata', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({});
      mockSubscriptionsChangePlan.mockResolvedValue(undefined);
      await service.changePlan('sub_1', 'pro');
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', { metadata: { plan_id: 'pro', billing_period: 'monthly' } });
    });
  });

  describe('hasProduct', () => {
    it('reports whether a product id is configured', () => {
      expect(service.hasProduct('pro', 'monthly')).toBe(true);
      expect(service.hasProduct('starter', 'monthly')).toBe(false);
      expect(service.hasProduct('pro', 'yearly')).toBe(false);
      expect(service.hasProduct('nope', 'monthly')).toBe(false);
    });
  });

  describe('createCheckoutUrl', () => {
    it('throws for an unknown plan id', async () => {
      await expect(
        service.createCheckoutUrl({
          planId: 'nonexistent',
          billingPeriod: 'yearly',
          userId: 'user-1',
          email: 'jane@example.com',
          successUrl: 'https://app/success',
          cancelUrl: 'https://app/cancel',
        }),
      ).rejects.toThrow('Unknown plan: nonexistent');
    });

    it('throws for the starter plan, which has no configured product ids', async () => {
      await expect(
        service.createCheckoutUrl({
          planId: 'starter',
          billingPeriod: 'yearly',
          userId: 'user-1',
          email: 'jane@example.com',
          successUrl: 'https://app/success',
          cancelUrl: 'https://app/cancel',
        }),
      ).rejects.toThrow('No product configured for starter yearly');
    });

    const baseOpts = {
      planId: 'creator',
      billingPeriod: 'yearly' as const,
      userId: 'user-1',
      email: 'jane@example.com',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    };

    it('creates a checkout session and returns its checkout url', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({
        session_id: 'cks_1',
        checkout_url: 'https://pay.dodo/session/cks_1',
      });

      const url = await service.createCheckoutUrl(baseOpts);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          product_cart: [{ product_id: 'prod_creator_yearly', quantity: 1 }],
          customer: { email: 'jane@example.com', name: 'jane@example.com' },
          return_url: 'https://app/success',
          metadata: { user_id: 'user-1', plan_id: 'creator', billing_period: 'yearly' },
          feature_flags: expect.objectContaining({ allow_discount_code: false }),
        }),
      );
      // The old subscriptions.create path forced billing to India.
      expect(mockSubscriptionsCreate).not.toHaveBeenCalled();
      expect(url).toBe('https://pay.dodo/session/cks_1');
    });

    it('leaves the billing address for the buyer to fill when no country is known', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ checkout_url: 'https://pay.dodo/s' });

      await service.createCheckoutUrl(baseOpts);

      expect(mockCheckoutSessionsCreate.mock.calls[0][0]).not.toHaveProperty('billing_address');
    });

    it('prefills the detected country and keeps it editable', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ checkout_url: 'https://pay.dodo/s' });

      await service.createCheckoutUrl({ ...baseOpts, country: 'be' });

      const body = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(body.billing_address).toEqual({ country: 'BE' });
      expect(body.feature_flags.allow_customer_editing_country).toBe(true);
    });

    it('ignores a malformed country instead of sending it to Dodo', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ checkout_url: 'https://pay.dodo/s' });

      await service.createCheckoutUrl({ ...baseOpts, country: 'Belgium' });

      expect(mockCheckoutSessionsCreate.mock.calls[0][0]).not.toHaveProperty('billing_address');
    });

    it('passes the coupon and trial through to the session', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ checkout_url: 'https://pay.dodo/s' });

      await service.createCheckoutUrl({ ...baseOpts, discountCode: 'ILIAS20', trialPeriodDays: 7 });

      const body = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(body.discount_code).toBe('ILIAS20');
      expect(body.metadata.coupon_code).toBe('ILIAS20');
      expect(body.subscription_data).toEqual({ trial_period_days: 7 });
    });

    it('throws when Dodo does not return a checkout URL', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ session_id: 'cks_2' });

      await expect(
        service.createCheckoutUrl({
          planId: 'creator',
          billingPeriod: 'monthly',
          userId: 'user-1',
          email: 'jane@example.com',
          successUrl: 'https://app/success',
          cancelUrl: 'https://app/cancel',
        }),
      ).rejects.toThrow('Dodo did not return a checkout URL');
    });
  });

  describe('getSubscription', () => {
    it('retrieves the subscription by id', async () => {
      mockSubscriptionsRetrieve.mockResolvedValue({ id: 'sub_123', status: 'active' });

      const result = await service.getSubscription('sub_123');

      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_123');
      expect(result).toEqual({ id: 'sub_123', status: 'active' });
    });
  });

  describe('cancelSubscription', () => {
    it('updates the subscription status to cancelled', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_123', status: 'cancelled' });

      const result = await service.cancelSubscription('sub_123');

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', { status: 'cancelled' });
      expect(result).toEqual({ id: 'sub_123', status: 'cancelled' });
    });
  });

  describe('discounts', () => {
    it('creates a percentage discount, defaulting optional limits to null', async () => {
      await service.createDiscount({ code: 'SAVE20', amount: 2000 });
      expect(mockDiscountsCreate).toHaveBeenCalledWith({
        code: 'SAVE20',
        amount: 2000,
        type: 'percentage',
        expires_at: null,
        usage_limit: null,
      });
    });

    it('passes expiry and usage limit through when set', async () => {
      await service.createDiscount({ code: 'SAVE20', amount: 2000, expiresAt: '2027-01-01', usageLimit: 5 });
      expect(mockDiscountsCreate).toHaveBeenCalledWith(expect.objectContaining({ expires_at: '2027-01-01', usage_limit: 5 }));
    });

    it('sends only the changed fields on update', async () => {
      await service.updateDiscount('d1', { amount: 1500 });
      expect(mockDiscountsUpdate).toHaveBeenCalledWith('d1', { amount: 1500 });

      await service.updateDiscount('d1', { expiresAt: null, usageLimit: 3 });
      expect(mockDiscountsUpdate).toHaveBeenLastCalledWith('d1', { expires_at: null, usage_limit: 3 });
    });

    it('deletes a discount', async () => {
      await service.deleteDiscount('d1');
      expect(mockDiscountsDelete).toHaveBeenCalledWith('d1');
    });
  });

  describe('scheduleCancellation', () => {
    it('schedules a period-end cancellation with the feedback and comment', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({ cancel_at_next_billing_date: true });

      await service.scheduleCancellation('sub_1', { feedback: 'too_expensive', comment: 'pricey' });

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
        cancel_at_next_billing_date: true,
        cancel_reason: 'cancelled_by_customer',
        cancellation_feedback: 'too_expensive',
        cancellation_comment: 'pricey',
      });
    });

    it('omits feedback and comment when not given', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({});

      await service.scheduleCancellation('sub_1');

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
        cancel_at_next_billing_date: true,
        cancel_reason: 'cancelled_by_customer',
      });
    });
  });

  describe('findActiveSubscriptionId', () => {
    async function* items<T>(list: T[]) {
      for (const x of list) yield x;
    }

    it('returns the active subscription whose metadata names the user', async () => {
      mockCustomersList.mockReturnValue(items([{ customer_id: 'cus_1' }]));
      mockSubscriptionsList.mockReturnValue(
        items([
          { subscription_id: 'sub_other', metadata: { user_id: 'someone-else' } },
          { subscription_id: 'sub_mine', metadata: { user_id: 'user-1' } },
        ]),
      );

      await expect(service.findActiveSubscriptionId('a@b.com', 'user-1')).resolves.toBe('sub_mine');
      expect(mockCustomersList).toHaveBeenCalledWith({ email: 'a@b.com' });
      expect(mockSubscriptionsList).toHaveBeenCalledWith({ customer_id: 'cus_1', status: 'active' });
    });

    it('returns null when nothing matches', async () => {
      mockCustomersList.mockReturnValue(items([{ customer_id: 'cus_1' }]));
      mockSubscriptionsList.mockReturnValue(items([{ subscription_id: 'sub_x', metadata: {} }]));
      await expect(service.findActiveSubscriptionId('a@b.com', 'user-1')).resolves.toBeNull();
    });

    it('returns null without an email', async () => {
      await expect(service.findActiveSubscriptionId('', 'user-1')).resolves.toBeNull();
      expect(mockCustomersList).not.toHaveBeenCalled();
    });
  });

  describe('resumeSubscription', () => {
    it('clears the scheduled cancellation', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({ cancel_at_next_billing_date: false });

      await service.resumeSubscription('sub_1');

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', { cancel_at_next_billing_date: false });
    });
  });

  describe('verifyWebhook', () => {
    it('unwraps the webhook payload using the configured secret', () => {
      mockWebhooksUnwrap.mockReturnValue({ event_type: 'subscription.active' });

      const result = service.verifyWebhook('{"raw":"body"}', { 'webhook-signature': 'sig' });

      expect(mockWebhooksUnwrap).toHaveBeenCalledWith('{"raw":"body"}', {
        headers: { 'webhook-signature': 'sig' },
        key: 'whsec_test',
      });
      expect(result).toEqual({ event_type: 'subscription.active' });
    });

    it('defaults the webhook key to an empty string when DODO_WEBHOOK_SECRET is unset', async () => {
      const sparseConfig = { get: jest.fn(() => undefined) } as unknown as jest.Mocked<ConfigService>;
      const moduleRef = await Test.createTestingModule({
        providers: [DodoService, { provide: ConfigService, useValue: sparseConfig }],
      }).compile();
      const sparseService = moduleRef.get(DodoService);
      mockWebhooksUnwrap.mockReturnValue({ event_type: 'subscription.active' });

      sparseService.verifyWebhook('{"raw":"body"}', {});

      expect(mockWebhooksUnwrap).toHaveBeenCalledWith('{"raw":"body"}', { headers: {}, key: '' });
    });
  });
});
