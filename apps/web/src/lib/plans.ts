/**
 * Plan display data for the web app.
 *
 * The API (apps/api/src/common/plans.ts, served at GET /api/v1/plans) is the
 * authority for prices and entitlements and enforces them server-side. The
 * numbers below are only a fallback so the page still renders if that request
 * fails; `mergeLivePlans` overwrites them with the API's values.
 */

export type PlanId = "starter" | "creator" | "pro" | "business";

export type PlanNumbers = {
  id: PlanId;
  name: string;
  /** Monthly price in paise. 0 = free. */
  price_cents: number;
  /** Yearly price in paise (Dodo yearly product). null = no yearly option. */
  yearly_price_cents: number | null;
  credits_per_month: number;
  estimated_clips: [number, number];
  max_video_seconds: number;
  watermark: boolean;
  platforms: string[];
  scheduling: boolean;
  analytics: boolean;
  /** False when no Dodo product is configured yet. */
  checkout_available: boolean;
  checkout_available_yearly: boolean;
};

const ALL_PLATFORMS = ["youtube", "instagram", "tiktok", "facebook", "linkedin", "x", "threads"];

export const FALLBACK_PLANS: PlanNumbers[] = [
  { id: "starter", name: "Starter", price_cents: 0, yearly_price_cents: null, checkout_available_yearly: false, credits_per_month: 30, estimated_clips: [6, 10], max_video_seconds: 300, watermark: true, platforms: ["youtube", "instagram"], scheduling: false, analytics: false, checkout_available: true },
  { id: "creator", name: "Creator", price_cents: 59_900, yearly_price_cents: 625_200, checkout_available_yearly: true, credits_per_month: 200, estimated_clips: [60, 80], max_video_seconds: 600, watermark: false, platforms: ALL_PLATFORMS, scheduling: true, analytics: true, checkout_available: true },
  { id: "pro", name: "Pro", price_cents: 99_900, yearly_price_cents: 1_042_800, checkout_available_yearly: true, credits_per_month: 500, estimated_clips: [120, 150], max_video_seconds: 900, watermark: false, platforms: ALL_PLATFORMS, scheduling: true, analytics: true, checkout_available: true },
  { id: "business", name: "Business", price_cents: 199_900, yearly_price_cents: 2_098_800, checkout_available_yearly: true, credits_per_month: 1200, estimated_clips: [240, 300], max_video_seconds: 1800, watermark: false, platforms: ALL_PLATFORMS, scheduling: true, analytics: true, checkout_available: true },
];

/** Overlay whatever the API returned on top of the fallback, by plan id. */
export function mergeLivePlans(live: Partial<PlanNumbers>[] | null | undefined): PlanNumbers[] {
  const byId = new Map((live ?? []).filter((p) => p?.id).map((p) => [p.id, p]));
  return FALLBACK_PLANS.map((p) => {
    const l = byId.get(p.id);
    if (!l) return p;
    // An API that predates yearly billing omits this — never offer yearly then,
    // or a "yearly" click would check out monthly.
    return { ...p, checkout_available_yearly: false, ...l } as PlanNumbers;
  });
}

/** Paid tiers, for UI gates (the API enforces the same rules). */
export const PAID_PLAN_IDS: PlanId[] = ["creator", "pro", "business"];
export const isPaidTier = (tier?: string | null) => PAID_PLAN_IDS.includes((tier ?? "") as PlanId);

/** Max source length for a tier, for upload hints (the worker enforces it). */
export function maxVideoSecondsFor(tier?: string | null): number {
  return (FALLBACK_PLANS.find((p) => p.id === tier) ?? FALLBACK_PLANS[0]).max_video_seconds;
}

/** Platforms with a working publish integration today. */
export const LIVE_PUBLISH_PLATFORMS = ["youtube", "instagram"];

export const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  threads: "Threads",
};

export const formatInr = (paise: number) =>
  paise <= 0 ? "Free" : `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** Whole-percent saving of yearly vs 12× monthly (0 when none). */
export function yearlySavingPct(p: Pick<PlanNumbers, "price_cents" | "yearly_price_cents">): number {
  if (!p.price_cents || !p.yearly_price_cents) return 0;
  return Math.max(0, Math.round((1 - p.yearly_price_cents / (p.price_cents * 12)) * 100));
}

export const formatMinutes = (seconds: number) => `${Math.round(seconds / 60)} min`;
