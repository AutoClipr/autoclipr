/**
 * Single source of truth for subscription plans and what each one unlocks.
 *
 * Billing, credits, coupons, affiliates, campaigns, the scheduler, video
 * submission and the render pipeline all read from here, and GET /plans
 * serves it to the web app. Entitlements are always resolved server-side from
 * the user's profile tier — never from anything the client sends.
 *
 * Prices are display/accounting values in paise. What a customer is actually
 * charged is the Dodo product's price; keep the two in sync when a product
 * changes.
 */

export type PlanId = 'starter' | 'creator' | 'pro' | 'business';
export type PublishPlatform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'linkedin' | 'x' | 'threads';

export interface PlanConfig {
  id: PlanId;
  name: string;
  currency: 'INR';
  /** Monthly price in paise. 0 = free. */
  monthlyPaise: number;
  /** Yearly price in paise (the Dodo yearly product's price). null = no yearly option. */
  yearlyPaise: number | null;
  creditsPerMonth: number;
  /** Shown as an estimate only — credits are the real limit. */
  estimatedClips: [number, number];
  /** Longest source video accepted, in seconds. */
  maxVideoSeconds: number;
  watermark: boolean;
  /** Platforms this plan may publish to (only those with a live integration work). */
  platforms: PublishPlatform[];
  scheduling: boolean;
  analytics: boolean;
  /** Brand kits (logo, colours, captions, intro/outro). */
  brandKits: boolean;
  /** How many brand kits the plan may keep. 0 when brandKits is false. */
  maxBrandKits: number;
  /** Output aspect ratios this plan may render. */
  aspectRatios: string[];
}

const ALL_RATIOS = ['9:16', '16:9', '1:1', '4:5'];

const ALL_PLATFORMS: PublishPlatform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'linkedin', 'x', 'threads'];

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    currency: 'INR',
    monthlyPaise: 0,
    yearlyPaise: null,
    creditsPerMonth: 30,
    estimatedClips: [6, 10],
    maxVideoSeconds: 5 * 60,
    watermark: true,
    platforms: ['youtube', 'instagram'],
    scheduling: false,
    analytics: false,
    brandKits: false,
    maxBrandKits: 0,
    aspectRatios: ['9:16'],
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    currency: 'INR',
    monthlyPaise: 59_900,
    yearlyPaise: 625_200,
    creditsPerMonth: 200,
    estimatedClips: [60, 80],
    maxVideoSeconds: 10 * 60,
    watermark: false,
    platforms: ALL_PLATFORMS,
    scheduling: true,
    analytics: true,
    brandKits: true,
    maxBrandKits: 3,
    aspectRatios: ALL_RATIOS,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    currency: 'INR',
    monthlyPaise: 99_900,
    yearlyPaise: 1_042_800,
    creditsPerMonth: 500,
    estimatedClips: [120, 150],
    maxVideoSeconds: 15 * 60,
    watermark: false,
    platforms: ALL_PLATFORMS,
    scheduling: true,
    analytics: true,
    brandKits: true,
    maxBrandKits: 10,
    aspectRatios: ALL_RATIOS,
  },
  business: {
    id: 'business',
    name: 'Business',
    currency: 'INR',
    monthlyPaise: 199_900,
    yearlyPaise: 2_098_800,
    creditsPerMonth: 1200,
    estimatedClips: [240, 300],
    maxVideoSeconds: 30 * 60,
    watermark: false,
    platforms: ALL_PLATFORMS,
    scheduling: true,
    analytics: true,
    brandKits: true,
    maxBrandKits: 25,
    aspectRatios: ALL_RATIOS,
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const PAID_PLAN_IDS = PLAN_IDS.filter((id) => PLANS[id].monthlyPaise > 0);

export const isPlanId = (v: unknown): v is PlanId => typeof v === 'string' && v in PLANS;

/** Entitlements for a profile tier. Unknown / legacy tiers ('free') get Starter. */
export function planFor(tier: string | null | undefined): PlanConfig {
  return isPlanId(tier) ? PLANS[tier] : PLANS.starter;
}

/** Price in paise for a plan and billing period (yearly falls back to 12× monthly). */
export function planPricePaise(planId: string, period: 'monthly' | 'yearly'): number {
  const p = planFor(planId);
  if (period === 'yearly') return p.yearlyPaise ?? p.monthlyPaise * 12;
  return p.monthlyPaise;
}

/** "₹599.00" style label, or "Free". */
export function formatInr(paise: number): string {
  if (paise <= 0) return 'Free';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} minutes`;
}
