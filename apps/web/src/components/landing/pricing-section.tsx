"use client";

import { openAuth } from "@/components/auth/auth-modal";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Aperture, Briefcase, Check, Clock, Loader2, Rocket, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { CouponField, couponAppliesTo, type AppliedCoupon } from "@/components/landing/coupon-field";
import { createClient } from "@/lib/supabase/client";
import {
  FALLBACK_PLANS,
  LIVE_PUBLISH_PLATFORMS,
  formatInr,
  formatMinutes,
  mergeLivePlans,
  isPaidTier,
  yearlySavingPct,
  type PlanId,
  type PlanNumbers,
} from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, MotionCard } from "@/components/ui/motion";

/* ─── Card copy (numbers come from the API) ─────────────────────────────── */

type Accent = "green" | "violet" | "teal" | "orange";

const COPY: Record<PlanId, { tagline: string; icon: LucideIcon; accent: Accent; cta: string; popular?: boolean }> = {
  starter: { tagline: "Perfect for exploring AI video clipping.", icon: Rocket, accent: "green", cta: "Get started free" },
  creator: { tagline: "For individual creators who publish consistently.", icon: Aperture, accent: "violet", cta: "Get Creator" },
  pro: { tagline: "For serious creators and growing content brands.", icon: Sparkles, accent: "teal", cta: "Get Pro", popular: true },
  business: { tagline: "For agencies, teams, and high-volume content creators.", icon: Briefcase, accent: "orange", cta: "Get Business" },
};

const ACCENT: Record<Accent, { icon: string; dot: string; btn: string }> = {
  green: { icon: "from-[#54D045] to-emerald-600", dot: "bg-[#54D045]", btn: "border border-[#242B3A] bg-white/[0.04] text-white hover:bg-white/[0.08]" },
  violet: { icon: "from-violet-500 to-fuchsia-500", dot: "bg-violet-500", btn: "border border-[#242B3A] bg-white/[0.04] text-white hover:bg-white/[0.08]" },
  teal: { icon: "from-[#00B88A] to-[#54D045]", dot: "bg-[#00B88A]", btn: "bg-[#54D045] text-[#070B12] shadow-lg shadow-[#54D045]/20 hover:bg-[#62dc53]" },
  orange: { icon: "from-[#FF9418] to-amber-400", dot: "bg-[#FF9418]", btn: "border border-[#242B3A] bg-white/[0.04] text-white hover:bg-white/[0.08]" },
};

type Feature = { label: string; strong?: boolean; soon?: boolean; muted?: boolean };

/** Only what the product does today; unbuilt items are marked "Soon". */
function featuresFor(p: PlanNumbers): Feature[] {
  const paid = p.price_cents > 0;
  const live = p.platforms.filter((x) => LIVE_PUBLISH_PLATFORMS.includes(x));
  const upcoming = p.platforms.filter((x) => !LIVE_PUBLISH_PLATFORMS.includes(x));
  const f: Feature[] = [
    { label: `${p.credits_per_month.toLocaleString("en-IN")} credits / month`, strong: true },
    { label: `≈ ${p.estimated_clips[0]}–${p.estimated_clips[1]} short clips (estimate)` },
    { label: `Source videos up to ${formatMinutes(p.max_video_seconds)}`, strong: true },
    { label: paid ? "AI viral moment detection & clip scoring" : "AI viral moment detection" },
    { label: "Auto captions & subtitles in 15 styles" },
    { label: "Vertical 9:16 export for Shorts, Reels & TikTok" },
    { label: live.length >= 2 ? "Publish to YouTube Shorts & Instagram Reels" : "Publish to YouTube" },
  ];
  if (p.scheduling) f.push({ label: "Content scheduling for all social media platforms", strong: true });
  if (p.analytics) f.push({ label: "Analytics & performance tracking", strong: true });
  if (paid) f.push({ label: p.id === "creator" ? "Email & chat support" : "Email + 24/7 live chat support", strong: p.id !== "creator" });
  f.push(p.watermark ? { label: "AutoClipr watermark on exports", muted: true } : { label: "No watermark", strong: true });
  if (upcoming.length) f.push({ label: "TikTok, Facebook, LinkedIn, X & Threads publishing", strong: true });
  return f;
}

/* ─── Checkout ──────────────────────────────────────────────────────────── */

/** Buyer's country from IP, only to prefill Dodo's checkout. */
async function detectCheckoutCountry(): Promise<string | undefined> {
  try {
    const data = await fetch("/api/geo").then((r) => r.json());
    if (data?.countryName === "Unknown") return undefined;
    return typeof data?.country === "string" ? data.country : undefined;
  } catch {
    return undefined;
  }
}

type Period = "monthly" | "yearly";

/** Starts a Dodo checkout. Throws with the API's message on failure. */
async function startCheckout(accessToken: string, planId: string, period: Period, couponCode?: string) {
  const country = await detectCheckoutCountry();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      planId,
      billingPeriod: period,
      ...(couponCode ? { couponCode } : {}),
      ...(country ? { country } : {}),
    }),
  });
  const body = await res.json().catch(() => null);
  const url = body?.data?.url as string | undefined;
  if (!url) throw new Error(body?.error?.message ?? body?.message ?? "Could not start checkout. Please try again.");
  window.location.href = url;
}

/** Moves an existing subscription to another plan (prorated by Dodo). */
async function switchPlan(accessToken: string, planId: string, period: Period) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/billing/subscription/change-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ planId, billingPeriod: period }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.error?.message ?? body?.message ?? "Could not switch plan. Please try again.");
}

/* ─── Card ──────────────────────────────────────────────────────────────── */

function PricingCard({
  plan,
  coupon,
  currentTier,
  period,
}: {
  plan: PlanNumbers;
  coupon: AppliedCoupon | null;
  currentTier?: string | null;
  period: Period;
}) {
  const copy = COPY[plan.id];
  const ac = ACCENT[copy.accent];
  const Icon = copy.icon;
  const paid = plan.price_cents > 0;
  // Coupons are monthly-only (the API refuses them on yearly).
  const planCoupon = coupon && paid && period === "monthly" && couponAppliesTo(coupon, plan.id) ? coupon : null;
  const percentOff = planCoupon?.type === "percentage" ? Math.min(planCoupon.value, 100) : 0;
  const yearly = period === "yearly" && paid && plan.yearly_price_cents != null;
  // Yearly shows the per-month equivalent; the total is listed underneath.
  const listPaise = yearly ? Math.round(plan.yearly_price_cents! / 12) : plan.price_cents;
  const shownPaise = percentOff ? Math.round(listPaise * (100 - percentOff)) / 100 : listPaise;
  const yearlyTotal = yearly ? (percentOff ? Math.round(plan.yearly_price_cents! * (100 - percentOff)) / 100 : plan.yearly_price_cents!) : 0;
  const saving = yearly ? yearlySavingPct(plan) : 0;
  const isCurrent = currentTier === plan.id || (currentTier === "free" && plan.id === "starter");
  const unavailable = paid && !(period === "yearly" ? plan.checkout_available_yearly : plan.checkout_available);
  // A paid subscriber picking another paid plan switches in place.
  const isSwitch = paid && !!currentTier && isPaidTier(currentTier) && !isCurrent;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switched, setSwitched] = useState(false);

  async function handleClick() {
    setError(null);
    if (!paid) {
      openAuth("register");
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) {
        const back = `/pricing?checkout=${plan.id}&billing=${period}${planCoupon ? `&coupon=${encodeURIComponent(planCoupon.code)}` : ""}`;
        openAuth("login", back);
        return;
      }
      if (isSwitch) {
        const ok = window.confirm(
          `Switch to ${plan.name} (${period === "yearly" ? `${formatInr(plan.yearly_price_cents ?? 0)}/year` : `${formatInr(plan.price_cents)}/month`})? The prorated difference is charged or credited now.`,
        );
        if (!ok) return;
        await switchPlan(session.access_token, plan.id, period);
        setSwitched(true);
        return;
      }
      await startCheckout(session.access_token, plan.id, period, planCoupon?.code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <MotionCard
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 motion-reduce:hover:translate-y-0",
        copy.popular
          ? "border-[#54D045]/50 bg-gradient-to-b from-[#00B88A]/[0.16] via-[#0D1220] to-[#0D1220] shadow-[0_0_60px_-18px_rgba(84,208,69,0.55)]"
          : copy.accent === "orange"
            ? "border-[#242B3A] bg-gradient-to-b from-[#FF9418]/[0.06] to-[#0D1220] hover:border-[#FF9418]/30"
            : "border-[#242B3A] bg-[#0D1220] hover:border-white/20",
      )}
    >
      {copy.popular && (
        <>
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[#54D045]/25 blur-3xl" aria-hidden />
          <div className="absolute right-5 top-5 z-10 flex items-center gap-1.5 rounded-full bg-[#54D045] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#070B12] shadow-lg shadow-[#54D045]/30">
            <Zap className="h-3 w-3" aria-hidden /> Most popular
          </div>
        </>
      )}

      <div className="relative px-6 pb-6 pt-7">
        {!copy.popular && <span className={cn("absolute right-6 top-6 h-2 w-2 rounded-full opacity-80 blur-[2px]", ac.dot)} aria-hidden />}
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg", ac.icon)}>
          <Icon className="h-6 w-6 text-white" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
          {copy.popular && (
            <span className="rounded-full border border-[#54D045]/30 bg-[#54D045]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#a6ec9c]">
              Best value
            </span>
          )}
          {isCurrent && (
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
              Current plan
            </span>
          )}
        </div>
        <p className="mt-1.5 min-h-[40px] text-sm text-[#9299A8]">{copy.tagline}</p>

        <div className="mt-5">
          {percentOff > 0 && (
            <div className="mb-1 flex items-center gap-2">
              <span className="text-base font-semibold text-white/35 line-through">{formatInr(listPaise)}</span>
              <span className="rounded-full border border-[#54D045]/30 bg-[#54D045]/15 px-2 py-0.5 text-[10px] font-semibold text-[#a6ec9c]">
                {planCoupon!.code} · {percentOff}% off
              </span>
            </div>
          )}
          <p className="flex items-end gap-1">
            <span className="text-5xl font-extrabold tabular-nums tracking-tight text-white">{formatInr(shownPaise)}</span>
            {paid && <span className="mb-1.5 text-sm text-[#9299A8]">/month</span>}
          </p>
          {yearly ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/40">
              {formatInr(yearlyTotal)} billed yearly
              {saving > 0 && (
                <span className="rounded-full border border-[#54D045]/25 bg-[#54D045]/15 px-2 py-0.5 text-[10px] font-semibold text-[#a6ec9c]">
                  Save {saving}%
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-xs text-white/40">{paid ? "Billed monthly · Cancel anytime" : "Free forever · No credit card"}</p>
          )}
          {coupon && paid && !planCoupon && (
            <p className="mt-1 text-xs text-white/35">
              {period === "yearly" ? "Coupons apply to monthly billing only" : <>{coupon.code} doesn&apos;t apply to this plan</>}
            </p>
          )}
        </div>
      </div>

      <div className="mx-6 h-px bg-white/[0.06]" />

      <div className="flex flex-1 flex-col px-6 py-6">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-white/30">What&apos;s included</p>
        <ul className="space-y-2.5">
          {featuresFor(plan).map((f) => (
            <li key={f.label} className="flex items-start gap-2.5 text-sm">
              {f.soon ? (
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-white/30" aria-hidden />
              ) : (
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                    f.muted ? "bg-white/[0.06]" : f.strong ? `bg-gradient-to-br ${ac.icon}` : "bg-white/[0.08]",
                  )}
                  aria-hidden
                >
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </span>
              )}
              <span className={cn("leading-snug", f.soon || f.muted ? "text-white/40" : f.strong ? "font-medium text-white" : "text-white/65")}>
                {f.label}
                {f.soon && <span className="ml-1.5 rounded bg-white/10 px-1.5 py-px text-[10px] font-medium text-white/60">Soon</span>}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-7">
          <button
            type="button"
            onClick={handleClick}
            disabled={loading || unavailable || switched || (isCurrent && paid)}
            aria-busy={loading}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60 disabled:cursor-not-allowed disabled:opacity-50",
              ac.btn,
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {loading
              ? isSwitch ? "Switching…" : "Redirecting…"
              : switched
                ? "Switch requested"
                : isCurrent && paid
                  ? "Your current plan"
                  : unavailable
                    ? "Coming soon"
                    : isSwitch
                      ? `Switch to ${plan.name}`
                      : copy.cta}
          </button>
          {switched && (
            <p className="mt-2 text-center text-xs text-[#a6ec9c]" role="status">
              Done — your new plan and credits apply as soon as Dodo confirms the change.
            </p>
          )}
          {error && (
            <p className="mt-2 text-center text-xs text-red-300" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </MotionCard>
  );
}

/* ─── Section ───────────────────────────────────────────────────────────── */

type PricingSectionProps = {
  showHeader?: boolean;
  /** Plans from GET /api/v1/plans, fetched on the server. Fetched here when omitted. */
  plans?: Partial<PlanNumbers>[] | null;
  /** The signed-in user's tier, to mark the current plan. */
  currentTier?: string | null;
};

export function PricingSection({ showHeader = true, plans: initialPlans, currentTier: tierProp }: PricingSectionProps) {
  const [currentTier, setCurrentTier] = useState<string | null>(tierProp ?? null);
  const [plans, setPlans] = useState<PlanNumbers[]>(() => (initialPlans ? mergeLivePlans(initialPlans) : FALLBACK_PLANS));
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [period, setPeriod] = useState<Period>("monthly");
  const searchParams = useSearchParams();
  const maxSaving = Math.max(0, ...plans.map(yearlySavingPct));
  const autoCheckoutTriggered = useRef(false);

  useEffect(() => {
    if (initialPlans) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/plans`)
      .then((r) => r.json())
      .then((b) => Array.isArray(b?.data) && setPlans(mergeLivePlans(b.data)))
      .catch(() => {});
  }, [initialPlans]);

  // Mark the visitor's current plan when signed in.
  useEffect(() => {
    if (tierProp !== undefined) return;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("subscription_tier").eq("id", user.id).maybeSingle();
      setCurrentTier((data?.subscription_tier as string | undefined) ?? null);
    })().catch(() => {});
  }, [tierProp]);

  // After the login redirect: continue to checkout for ?checkout=<plan>.
  useEffect(() => {
    const checkoutPlan = searchParams?.get("checkout");
    if (!checkoutPlan || autoCheckoutTriggered.current) return;
    autoCheckoutTriggered.current = true;
    (async () => {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) return;
      const billing: Period = searchParams?.get("billing") === "yearly" ? "yearly" : "monthly";
      await startCheckout(session.access_token, checkoutPlan, billing, searchParams?.get("coupon") ?? undefined).catch(() => {});
    })();
  }, [searchParams]);

  return (
    <section id="pricing" className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        {showHeader && (
          <Reveal className="mb-10 text-center">
            <p className="section-label mx-auto mb-6">Pricing</p>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Create more. <span className="text-[#54D045]">Edit less.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground sm:text-lg">
              Choose the plan that fits how much you publish. Start free, upgrade any time.
            </p>
          </Reveal>
        )}

        {/* Billing period */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div role="radiogroup" aria-label="Billing period" className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60",
                  period === p ? "bg-white text-[#070B12] shadow" : "text-[#9299A8] hover:text-white",
                )}
              >
                {p === "monthly" ? "Monthly" : "Yearly"}
                {p === "yearly" && maxSaving > 0 && (
                  <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold", period === p ? "bg-[#54D045] text-[#070B12]" : "bg-[#54D045]/20 text-[#a6ec9c]")}>
                    −{maxSaving}%
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#9299A8]">
            {period === "yearly"
              ? maxSaving > 0
                ? `Billed yearly · Save up to ${maxSaving}% · Cancel anytime`
                : "Billed yearly · Cancel anytime"
              : "Billed monthly · Cancel anytime"}
          </p>
        </div>

        <CouponField billingPeriod={period} applied={coupon} onApply={setCoupon} onClear={() => setCoupon(null)} />

        <Stagger className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" amount={0.1}>
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} coupon={coupon} currentTier={currentTier} period={period} />
          ))}
        </Stagger>

        <Reveal className="mt-10 text-center" delay={0.2}>
          <div className="inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-4 text-sm text-muted-foreground sm:px-8">
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#54D045]" aria-hidden /> Starter is free forever</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#54D045]" aria-hidden /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#54D045]" aria-hidden /> Cancel paid plans anytime</span>
            <Link href="/register" className="font-medium text-[#54D045] hover:underline">
              Try AutoClipr free →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
