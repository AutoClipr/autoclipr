// jwt-auth.guard.ts (transitively imported via BillingController's @UseGuards) pulls in the
// ESM-only `jose` package, which Jest's CommonJS transform can't parse from node_modules.
// We never exercise real JWT verification in this unit test, so stub the module out.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvoicePdfService } from '@autoclipr/emails';
import { BillingController } from './billing.controller';
import { DodoService } from './dodo.service';
import { SubscriptionsService } from './subscriptions.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard, AuthUser } from '../../common/guards/jwt-auth.guard';

describe('BillingController', () => {
  let controller: BillingController;
  let usersService: jest.Mocked<UsersService>;
  let dodo: jest.Mocked<DodoService>;
  let subscriptions: jest.Mocked<SubscriptionsService>;
  let invoicePdf: jest.Mocked<InvoicePdfService>;

  const user: AuthUser = { sub: 'user-1', email: 'jane@example.com' };

  beforeEach(async () => {
    usersService = {
      getBilling: jest.fn(),
      listPlans: jest.fn(),
      getMe: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    dodo = { verifyWebhook: jest.fn(), hasProduct: jest.fn((id: string) => id !== 'pro') } as unknown as jest.Mocked<DodoService>;

    subscriptions = {
      createCheckoutUrl: jest.fn(),
      getTransactions: jest.fn(),
      activatePlanForUser: jest.fn(),
      handleWebhookEvent: jest.fn(),
      cancelSubscription: jest.fn(),
      resumeSubscription: jest.fn(),
      logger: { log: jest.fn() },
    } as unknown as jest.Mocked<SubscriptionsService>;

    invoicePdf = { generate: jest.fn() } as unknown as jest.Mocked<InvoicePdfService>;

    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: DodoService, useValue: dodo },
        { provide: SubscriptionsService, useValue: subscriptions },
        { provide: InvoicePdfService, useValue: invoicePdf },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(BillingController);
  });

  describe('subscription', () => {
    it('returns the wrapped billing info for the current user', async () => {
      const billing = { profile: {}, subscription: null, credits: 10 };
      usersService.getBilling.mockResolvedValue(billing as any);

      const result = await controller.subscription(user);

      expect(usersService.getBilling).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true, data: billing, meta: undefined });
    });
  });

  describe('plans', () => {
    it('returns the wrapped plan list', async () => {
      usersService.listPlans.mockResolvedValue([{ id: 'creator', features: ['x'] }] as any);

      const result = await controller.plans();

      expect(result.data!.map((p) => p.id)).toEqual(['starter', 'creator', 'pro', 'business']);
      const creator = result.data!.find((p) => p.id === 'creator')!;
      expect(creator).toEqual(expect.objectContaining({
        price_cents: 59_900, credits_per_month: 200, max_video_seconds: 600, watermark: false, checkout_available: true, features: ['x'],
      }));
      expect(result.data!.find((p) => p.id === 'starter')).toEqual(expect.objectContaining({ watermark: true, checkout_available: true, features: [] }));
      expect(result.data!.find((p) => p.id === 'pro')!.checkout_available).toBe(false);
    });

    it('still serves plans when the feature lookup fails', async () => {
      usersService.listPlans.mockRejectedValue(new Error('db'));
      const result = await controller.plans();
      expect(result.data).toHaveLength(4);
    });
  });

  describe('changePlan', () => {
    it('switches the caller\'s plan', async () => {
      (subscriptions as any).changePlan = jest.fn().mockResolvedValue({ plan_id: 'pro', status: 'pending' });
      const result = await controller.changePlan(user, { planId: 'pro' });
      expect((subscriptions as any).changePlan).toHaveBeenCalledWith(user.sub, 'pro');
      expect(result).toEqual({ success: true, data: { plan_id: 'pro', status: 'pending' }, meta: undefined });
    });
  });

  describe('checkout', () => {
    it('uses the email from the JWT when present', async () => {
      subscriptions.createCheckoutUrl.mockResolvedValue('https://pay.dodo/session');

      const result = await controller.checkout(user, { planId: 'creator', billingPeriod: 'yearly' });

      expect(usersService.getMe).not.toHaveBeenCalled();
      expect(subscriptions.createCheckoutUrl).toHaveBeenCalledWith('user-1', 'jane@example.com', 'creator', 'yearly', undefined, undefined);
      expect(result).toEqual({ success: true, data: { url: 'https://pay.dodo/session' }, meta: undefined });
    });

    it('defaults billingPeriod to yearly when omitted', async () => {
      subscriptions.createCheckoutUrl.mockResolvedValue('https://pay.dodo/session');

      await controller.checkout(user, { planId: 'creator' } as any);

      expect(subscriptions.createCheckoutUrl).toHaveBeenCalledWith('user-1', 'jane@example.com', 'creator', 'yearly', undefined, undefined);
    });

    it('falls back to the profile email when the JWT has none', async () => {
      const userWithoutEmail: AuthUser = { sub: 'user-2' };
      usersService.getMe.mockResolvedValue({ email: 'profile@example.com' } as any);
      subscriptions.createCheckoutUrl.mockResolvedValue('https://pay.dodo/session');

      await controller.checkout(userWithoutEmail, { planId: 'creator', billingPeriod: 'monthly' });

      expect(usersService.getMe).toHaveBeenCalledWith('user-2');
      expect(subscriptions.createCheckoutUrl).toHaveBeenCalledWith(
        'user-2',
        'profile@example.com',
        'creator',
        'monthly',
        undefined,
        undefined,
      );
    });

    it('throws BadRequestException when no email can be resolved at all', async () => {
      const userWithoutEmail: AuthUser = { sub: 'user-2' };
      usersService.getMe.mockRejectedValue(new Error('not found'));

      await expect(
        controller.checkout(userWithoutEmail, { planId: 'creator', billingPeriod: 'monthly' }),
      ).rejects.toThrow(BadRequestException);
      expect(subscriptions.createCheckoutUrl).not.toHaveBeenCalled();
    });
  });

  describe('transactions', () => {
    it('returns the wrapped transaction list', async () => {
      subscriptions.getTransactions.mockResolvedValue([{ id: 'tx-1' }] as any);

      const result = await controller.transactions(user);

      expect(subscriptions.getTransactions).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true, data: [{ id: 'tx-1' }], meta: undefined });
    });
  });

  describe('receipt', () => {
    const tx = {
      id: 'tx-1',
      invoice_number: 'INV-1',
      plan_id: 'creator',
      amount: '₹399.00',
      status: 'paid',
      transaction_id: 'TRN1',
      payment_date: '2026-11-18T00:00:00Z',
    };

    it("builds the PDF from the user's stored payment, not from the request", async () => {
      (subscriptions as any).getTransaction = jest.fn().mockResolvedValue(tx);
      (usersService as any).getMe = jest.fn().mockResolvedValue({ email: 'a@b.com', full_name: 'Ada' });
      invoicePdf.generate.mockResolvedValue(Buffer.from('pdf'));
      const res = { set: jest.fn(), end: jest.fn() } as any;

      await controller.receipt(user, 'tx-1', res);

      expect((subscriptions as any).getTransaction).toHaveBeenCalledWith('user-1', 'tx-1');
      expect(invoicePdf.generate).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceNumber: 'INV-1', amount: '₹399.00', planName: 'Creator', userName: 'Ada', userEmail: 'a@b.com' }),
      );
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store' }));
      expect(res.end).toHaveBeenCalledWith(Buffer.from('pdf'));
    });

    it("returns 404 for a payment that isn't the user's", async () => {
      (subscriptions as any).getTransaction = jest.fn().mockResolvedValue(null);
      const res = { set: jest.fn(), end: jest.fn() } as any;
      await expect(controller.receipt(user, 'someone-elses', res)).rejects.toThrow('Receipt not found');
      expect(invoicePdf.generate).not.toHaveBeenCalled();
    });

    it('falls back to the token email when the profile cannot be loaded', async () => {
      (subscriptions as any).getTransaction = jest.fn().mockResolvedValue({ ...tx, transaction_id: null });
      (usersService as any).getMe = jest.fn().mockRejectedValue(new Error('x'));
      invoicePdf.generate.mockResolvedValue(Buffer.from('pdf'));
      const res = { set: jest.fn(), end: jest.fn() } as any;
      await controller.receipt({ ...user, email: 'tok@x.com' } as any, 'tx-1', res);
      expect(invoicePdf.generate).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: 'tok@x.com', userName: 'tok', transactionId: '-' }),
      );
    });
  });

  describe('downloadInvoice', () => {
    it('generates a PDF and streams it with the correct headers', async () => {
      const pdfBuffer = Buffer.from('pdf-bytes');
      invoicePdf.generate.mockResolvedValue(pdfBuffer);
      const res = { set: jest.fn(), end: jest.fn() } as any;

      await controller.downloadInvoice(
        'INV-1',
        'Creator',
        '₹399.00',
        '1 Jan 2026',
        'Jane Doe',
        'TXN-1',
        res,
      );

      expect(invoicePdf.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: 'INV-1',
          transactionId: 'TXN-1',
          planName: 'Creator',
          amount: '₹399.00',
          userName: 'Jane Doe',
        }),
      );
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="autoclipr-invoice-INV-1.pdf"',
          'Content-Length': pdfBuffer.length,
        }),
      );
      expect(res.end).toHaveBeenCalledWith(pdfBuffer);
    });

    it('applies fallback defaults for missing query params', async () => {
      invoicePdf.generate.mockResolvedValue(Buffer.from('x'));
      const res = { set: jest.fn(), end: jest.fn() } as any;

      await controller.downloadInvoice(undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, res);

      expect(invoicePdf.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: 'N/A',
          transactionId: '-',
          planName: 'Creator',
          amount: '₹349.00',
          userName: 'Customer',
        }),
      );
    });
  });

  describe('cancelSubscription', () => {
    it('cancels the current user\'s subscription with the optional reason', async () => {
      const state = { plan_id: 'creator', status: 'active', cancel_at_period_end: true, access_until: '2026-12-01' };
      subscriptions.cancelSubscription.mockResolvedValue(state as never);

      const result = await controller.cancelSubscription(user, { reason: 'too_expensive' });

      expect(subscriptions.cancelSubscription).toHaveBeenCalledWith(user.sub, { reason: 'too_expensive' });
      expect(result).toEqual(expect.objectContaining({ success: true, data: state }));
    });
  });

  describe('resumeSubscription', () => {
    it('resumes the current user\'s subscription', async () => {
      subscriptions.resumeSubscription.mockResolvedValue({ cancel_at_period_end: false } as never);

      const result = await controller.resumeSubscription(user);

      expect(subscriptions.resumeSubscription).toHaveBeenCalledWith(user.sub);
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });

  describe('activatePlan', () => {
    it('activates the plan for the current user', async () => {
      subscriptions.activatePlanForUser.mockResolvedValue(undefined);

      const result = await controller.activatePlan(user, {
        planId: 'creator',
        transactionId: 'txn-1',
        billingPeriod: 'yearly',
      });

      expect(subscriptions.activatePlanForUser).toHaveBeenCalledWith(
        'user-1',
        'creator',
        'jane@example.com',
        'txn-1',
        'yearly',
      );
      expect(result).toEqual({ success: true, data: { activated: true }, meta: undefined });
    });

    it('defaults billingPeriod to yearly when omitted', async () => {
      subscriptions.activatePlanForUser.mockResolvedValue(undefined);

      await controller.activatePlan(user, { planId: 'creator' } as any);

      expect(subscriptions.activatePlanForUser).toHaveBeenCalledWith(
        'user-1',
        'creator',
        'jane@example.com',
        undefined,
        'yearly',
      );
    });

    it('propagates errors from the service', async () => {
      subscriptions.activatePlanForUser.mockRejectedValue(new Error('unknown plan'));

      await expect(controller.activatePlan(user, { planId: 'bogus' } as any)).rejects.toThrow('unknown plan');
    });
  });

  describe('dodoWebhook', () => {
    function makeRequest(body: any, rawBody?: string) {
      return {
        rawBody: rawBody !== undefined ? Buffer.from(rawBody) : undefined,
        body,
        headers: { 'webhook-signature': 'sig', 'content-length': 123 as any },
      } as any;
    }

    it('verifies the webhook signature and processes the parsed event', async () => {
      const req = makeRequest({ event_type: 'subscription.active' }, '{"event_type":"subscription.active"}');
      dodo.verifyWebhook.mockReturnValue({ event_type: 'subscription.active', data: {} });

      const result = await controller.dodoWebhook(req);

      expect(dodo.verifyWebhook).toHaveBeenCalledWith(
        '{"event_type":"subscription.active"}',
        expect.objectContaining({ 'webhook-signature': 'sig' }),
      );
      expect(subscriptions.handleWebhookEvent).toHaveBeenCalledWith({ event_type: 'subscription.active', data: {} }, undefined);
      expect(result).toEqual({ received: true });
    });

    it('only forwards string-valued headers to verifyWebhook', async () => {
      const req = makeRequest({}, '{}');
      dodo.verifyWebhook.mockReturnValue({ event_type: 'x' });

      await controller.dodoWebhook(req);

      const headersArg = dodo.verifyWebhook.mock.calls[0][1];
      expect(headersArg).toEqual({ 'webhook-signature': 'sig' });
      expect(headersArg).not.toHaveProperty('content-length');
    });

    it('rejects the request with 401 when signature verification throws, instead of trusting the unverified body', async () => {
      const req = makeRequest({ event_type: 'subscription.active', data: { metadata: { plan_id: 'business' } } }, 'forged-payload');
      dodo.verifyWebhook.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(controller.dodoWebhook(req)).rejects.toThrow('Invalid webhook signature');
      expect(subscriptions.handleWebhookEvent).not.toHaveBeenCalled();
    });

    it('stringifies req.body when rawBody is unavailable', async () => {
      const req = makeRequest({ event_type: 'subscription.active' }, undefined);
      dodo.verifyWebhook.mockReturnValue({ event_type: 'subscription.active' });

      await controller.dodoWebhook(req);

      expect(dodo.verifyWebhook).toHaveBeenCalledWith(
        JSON.stringify({ event_type: 'subscription.active' }),
        expect.anything(),
      );
    });
  });
});
