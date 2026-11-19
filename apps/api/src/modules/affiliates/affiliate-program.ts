/**
 * Affiliate program rules — the single source the API, emails and web page use.
 * Changing a value here changes the program for everyone.
 */
export const COMMISSION_TIERS = [
  { id: 'starter', name: 'Starter', min_conversions: 0, max_conversions: 5, rate: 30 },
  { id: 'growth', name: 'Growth', min_conversions: 6, max_conversions: 20, rate: 35 },
  { id: 'elite', name: 'Elite', min_conversions: 21, max_conversions: null, rate: 40 },
] as const;

/** Minimum payout, in paise (₹1,000). */
export const MIN_PAYOUT_PAISE = 100000;

/** Commissions clear for withdrawal this many days after the payment. */
export const COMMISSION_HOLD_DAYS = 30;

export const PAYOUT_METHODS = [
  { id: 'paypal', label: 'PayPal' },
  { id: 'bank_transfer', label: 'Bank transfer (IMPS/NEFT)' },
  { id: 'upi', label: 'UPI' },
] as const;

export const PAYOUT_METHOD_IDS = PAYOUT_METHODS.map((m) => m.id) as string[];

/** Payout statuses that no longer hold money (the request was turned down). */
const RELEASED_PAYOUT_STATUSES = new Set(['rejected', 'failed', 'cancelled']);

export function rateForConversions(conversions: number): number {
  for (let i = COMMISSION_TIERS.length - 1; i >= 0; i--) {
    if (conversions >= COMMISSION_TIERS[i].min_conversions) return COMMISSION_TIERS[i].rate;
  }
  return COMMISSION_TIERS[0].rate;
}

type CommissionLike = { amount_paise: number; status: string; created_at: string };
type PayoutLike = { amount_paise: number; status: string };

/**
 * Money split for an affiliate.
 * - cleared: approved/paid commissions, plus pending ones past the hold period
 * - pending: commissions still inside the hold period
 * - committed: payouts requested or paid (anything not rejected)
 * - available: cleared minus committed — never includes pending commissions
 */
export function affiliateBalances(
  commissions: CommissionLike[],
  payouts: PayoutLike[],
  now: Date = new Date(),
) {
  const holdMs = COMMISSION_HOLD_DAYS * 24 * 60 * 60 * 1000;
  let cleared = 0;
  let pending = 0;
  for (const c of commissions) {
    if (c.status === 'rejected') continue;
    const pastHold = now.getTime() - new Date(c.created_at).getTime() >= holdMs;
    if (c.status === 'approved' || c.status === 'paid' || (c.status === 'pending' && pastHold)) cleared += c.amount_paise;
    else if (c.status === 'pending') pending += c.amount_paise;
  }
  let committed = 0;
  let paidOut = 0;
  let requested = 0;
  for (const p of payouts) {
    if (RELEASED_PAYOUT_STATUSES.has(p.status)) continue;
    committed += p.amount_paise;
    if (p.status === 'paid') paidOut += p.amount_paise;
    else requested += p.amount_paise;
  }
  return {
    cleared_paise: cleared,
    pending_paise: pending,
    paid_out_paise: paidOut,
    requested_paise: requested,
    available_paise: Math.max(0, cleared - committed),
  };
}
