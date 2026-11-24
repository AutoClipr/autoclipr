import { DAY_MS, churnRate, isActive, mrrPaise, pctChange, trend, windows } from './admin-metrics';

const NOW = Date.UTC(2026, 10, 25, 12); // 25 Nov 2026 12:00 UTC

describe('admin metrics', () => {
  it('builds UTC day windows', () => {
    const w = windows(7, NOW);
    expect(new Date(w.curStart).toISOString()).toBe('2026-11-19T00:00:00.000Z');
    expect(new Date(w.prevStart).toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });

  it('splits points into current and previous periods with a daily series', () => {
    const t = trend(
      [
        { at: '2026-11-25T01:00:00Z', v: 2 },
        { at: '2026-11-19T00:00:00Z', v: 1 },
        { at: '2026-11-15T00:00:00Z', v: 4 },
        { at: '2026-10-01T00:00:00Z', v: 9 }, // outside both windows
        { at: 'not a date', v: 5 },
      ],
      7,
      NOW,
    );
    expect(t).toMatchObject({ current: 3, previous: 4, changePct: -25 });
    expect(t.series[0]).toEqual({ date: '2026-11-19', value: 1 });
    expect(t.series[6]).toEqual({ date: '2026-11-25', value: 2 });
  });

  it('reports no % change without a previous value', () => {
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(15, 10)).toBe(50);
  });

  it('normalises MRR and measures 30-day churn', () => {
    const subs = [
      { status: 'active', periodEnd: null, cancelledAt: null, lastCharge: { paise: 60000, period: 'monthly' } },
      { status: 'active', periodEnd: new Date(NOW + DAY_MS).toISOString(), cancelledAt: null, lastCharge: { paise: 120000, period: 'yearly' } },
      { status: 'active', periodEnd: new Date(NOW - DAY_MS).toISOString(), cancelledAt: null, lastCharge: { paise: 99900, period: 'monthly' } }, // lapsed
      { status: 'cancelled', periodEnd: null, cancelledAt: new Date(NOW - 40 * DAY_MS).toISOString(), lastCharge: null }, // too old
      { status: 'active', periodEnd: null, cancelledAt: null, lastCharge: null }, // no charge yet
    ];
    expect(isActive(subs[2], NOW)).toBe(false);
    expect(mrrPaise(subs, NOW)).toBe(60000 + 10000);
    // Active 3, churned in 30 days 1 (the lapsed one).
    expect(churnRate(subs, NOW)).toBe(25);
    expect(churnRate([], NOW)).toBeNull();
  });
});
