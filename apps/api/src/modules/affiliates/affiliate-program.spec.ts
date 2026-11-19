import { affiliateBalances, COMMISSION_TIERS, PAYOUT_METHOD_IDS, rateForConversions } from './affiliate-program';

describe('affiliate program', () => {
  it.each([
    [0, 30],
    [5, 30],
    [6, 35],
    [20, 35],
    [21, 40],
    [500, 40],
  ])('%i conversions earn %i%%', (conversions, rate) => {
    expect(rateForConversions(conversions)).toBe(rate);
  });

  it('falls back to the first tier for negative counts', () => {
    expect(rateForConversions(-1)).toBe(COMMISSION_TIERS[0].rate);
  });

  it('only allows PayPal, bank transfer and UPI', () => {
    expect(PAYOUT_METHOD_IDS).toEqual(['paypal', 'bank_transfer', 'upi']);
  });

  describe('affiliateBalances', () => {
    const now = new Date('2026-11-20T00:00:00Z');
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

    it('clears pending commissions only after 30 days', () => {
      const b = affiliateBalances(
        [
          { amount_paise: 100, status: 'pending', created_at: daysAgo(29) },
          { amount_paise: 200, status: 'pending', created_at: daysAgo(30) },
        ],
        [],
        now,
      );
      expect(b).toMatchObject({ pending_paise: 100, cleared_paise: 200, available_paise: 200 });
    });

    it('counts approved and paid commissions as cleared and ignores rejected ones', () => {
      const b = affiliateBalances(
        [
          { amount_paise: 100, status: 'approved', created_at: daysAgo(1) },
          { amount_paise: 50, status: 'paid', created_at: daysAgo(1) },
          { amount_paise: 999, status: 'rejected', created_at: daysAgo(60) },
        ],
        [],
        now,
      );
      expect(b.cleared_paise).toBe(150);
    });

    it('subtracts requested and paid payouts, but not rejected ones', () => {
      const b = affiliateBalances(
        [{ amount_paise: 1000, status: 'approved', created_at: daysAgo(1) }],
        [
          { amount_paise: 300, status: 'paid' },
          { amount_paise: 200, status: 'processing' },
          { amount_paise: 400, status: 'rejected' },
          { amount_paise: 100, status: 'failed' },
        ],
        now,
      );
      expect(b).toMatchObject({ paid_out_paise: 300, requested_paise: 200, available_paise: 500 });
    });

    it('never goes below zero', () => {
      const b = affiliateBalances([], [{ amount_paise: 500, status: 'paid' }], now);
      expect(b.available_paise).toBe(0);
    });

    it('uses the current time by default', () => {
      expect(affiliateBalances([], []).available_paise).toBe(0);
    });
  });
});
