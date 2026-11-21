import { PAID_PLAN_IDS, PLANS, formatInr, formatMinutes, isPlanId, planFor, planPricePaise } from './plans';

describe('plans config', () => {
  it('defines the four tiers with the agreed limits', () => {
    expect(Object.values(PLANS).map((p) => [p.id, p.monthlyPaise, p.creditsPerMonth, p.maxVideoSeconds, p.watermark])).toEqual([
      ['starter', 0, 30, 300, true],
      ['creator', 59_900, 200, 600, false],
      ['pro', 99_900, 500, 900, false],
      ['business', 199_900, 1200, 1800, false],
    ]);
    expect(PAID_PLAN_IDS).toEqual(['creator', 'pro', 'business']);
    expect(PLANS.starter.platforms).toEqual(['youtube', 'instagram']);
    expect(PLANS.starter.analytics || PLANS.starter.scheduling).toBe(false);
  });

  it('falls back to Starter for unknown or legacy tiers', () => {
    expect(planFor('free').id).toBe('starter');
    expect(planFor(null).id).toBe('starter');
    expect(planFor('pro').id).toBe('pro');
    expect(isPlanId('enterprise')).toBe(false);
  });

  it('prices yearly from the configured yearly product', () => {
    expect(planPricePaise('creator', 'yearly')).toBe(625_200);
    expect(planPricePaise('pro', 'yearly')).toBe(1_042_800);
    expect(planPricePaise('business', 'yearly')).toBe(2_098_800);
    expect(planPricePaise('starter', 'yearly')).toBe(0);
    expect(planPricePaise('pro', 'monthly')).toBe(99_900);
  });

  it('formats prices and durations', () => {
    expect(formatInr(0)).toBe('Free');
    expect(formatInr(59_900)).toBe('₹599.00');
    expect(formatInr(199_900)).toBe('₹1,999.00');
    expect(formatMinutes(900)).toBe('15 minutes');
  });
});
