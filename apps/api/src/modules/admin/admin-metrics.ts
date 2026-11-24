/**
 * Executive-dashboard metric definitions. Every number on the dashboard is
 * computed here from real rows, with one documented formula each, so the UI
 * can show exactly what a metric means (DEFINITIONS) and tests can pin it.
 *
 * Reporting periods are whole UTC days: "last N days" is the N days ending
 * today (UTC), compared with the N days before that.
 */

export const DAY_MS = 24 * 3600 * 1000;

export const DEFINITIONS: Record<string, string> = {
  totalUsers: 'All signed-up accounts.',
  paidUsers: 'Accounts whose current plan is Creator, Pro or Business (profiles.subscription_tier).',
  freeUsers: 'Total users minus paid users.',
  conversionRate: 'Paid users ÷ total users.',
  activeSubscriptions: 'Paid-plan subscriptions with status "active" whose period has not ended. Free Starter plans are excluded.',
  onlineUsers: 'Accounts seen in the last 5 minutes.',
  newUsers: 'Sign-ups in the selected period.',
  mrr: 'Monthly recurring revenue: for each active paid subscription, its latest paid charge — monthly as is, yearly ÷ 12.',
  arr: 'MRR × 12.',
  revenue: 'Paid billing transactions in the selected period (cash collected).',
  totalRevenue: 'All paid billing transactions, all time.',
  arpu: 'MRR ÷ active paid subscriptions.',
  churnRate: 'Paid subscriptions that ended or were cancelled in the last 30 days ÷ (active paid subscriptions + those churned).',
  refundRate: 'Refunded transactions ÷ (paid + refunded) transactions, all time.',
  videos: 'Videos added in the selected period.',
  clips: 'Clips generated in the selected period.',
  creditsUsed: 'Credits spent (credit ledger debits) in the selected period; refunds are not subtracted.',
  storage: 'Total size of stored source videos.',
  hooks: 'Clips rendered with an AI hook or headline (all time).',
  queue: 'Generation jobs waiting to start right now.',
  processing: 'Generation jobs running right now.',
  failedJobs: 'Generation jobs that failed in the last 24 hours.',
  avgProcessing: 'Average time from start to finish of jobs completed in the last 24 hours.',
  apiCpu: 'CPU load of the API server process host (1-minute load ÷ cores).',
  apiMemory: 'Memory used by the API server process (RSS) ÷ host memory.',
};

/** Start (UTC midnight) of the current and previous N-day windows. */
export function windows(days: number, now = Date.now()) {
  const todayStart = Math.floor(now / DAY_MS) * DAY_MS;
  const curStart = todayStart - (days - 1) * DAY_MS;
  const prevStart = curStart - days * DAY_MS;
  return { curStart, prevStart, end: now };
}

/** Daily totals for the current window plus current/previous sums and % change. */
export function trend(points: { at: string; v: number }[], days: number, now = Date.now()) {
  const { curStart, prevStart } = windows(days, now);
  const series = Array.from({ length: days }, (_, i) => ({ date: new Date(curStart + i * DAY_MS).toISOString().slice(0, 10), value: 0 }));
  let current = 0;
  let previous = 0;
  for (const p of points) {
    const t = new Date(p.at).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= curStart) {
      current += p.v;
      const i = Math.floor((t - curStart) / DAY_MS);
      if (series[i]) series[i].value += p.v;
    } else if (t >= prevStart) previous += p.v;
  }
  return { current, previous, changePct: pctChange(current, previous), series };
}

/** % change, or null when there is no previous value to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type PaidSub = {
  status: string;
  periodEnd: string | null;
  cancelledAt: string | null;
  lastCharge: { paise: number; period: string } | null;
};

/** Active = status active and the paid period hasn't ended. */
export const isActive = (s: PaidSub, now = Date.now()) => s.status === 'active' && (!s.periodEnd || new Date(s.periodEnd).getTime() > now);

/** MRR in paise from active paid subscriptions' latest charges. */
export function mrrPaise(subs: PaidSub[], now = Date.now()): number {
  return subs.filter((s) => isActive(s, now) && s.lastCharge).reduce((sum, s) => {
    const c = s.lastCharge!;
    return sum + (c.period === 'yearly' ? c.paise / 12 : c.paise);
  }, 0);
}

/** 30-day churn %, or null with no paid subscriptions to measure. */
export function churnRate(subs: PaidSub[], now = Date.now()): number | null {
  const since = now - 30 * DAY_MS;
  const active = subs.filter((s) => isActive(s, now)).length;
  const churned = subs.filter((s) => {
    if (isActive(s, now)) return false;
    const at = s.cancelledAt ?? s.periodEnd;
    return !!at && new Date(at).getTime() >= since && new Date(at).getTime() <= now;
  }).length;
  const base = active + churned;
  return base ? Math.round((churned / base) * 1000) / 10 : null;
}
