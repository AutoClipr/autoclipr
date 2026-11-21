import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingSection } from "@/components/landing/pricing-section";
import { PricingSkeleton } from "@/components/landing/pricing-skeleton";
import { CreditsExplainer, PricingFAQ } from "@/components/landing/pricing-extras";
import { mergeLivePlans, type PlanNumbers } from "@/lib/plans";
import { PlanComparison } from "@/components/landing/plan-comparison";
import { pageMetadata } from "@/lib/seo";
import { Check, Zap, Shield, Lock } from "lucide-react";

export const metadata: Metadata = pageMetadata({
  title: "Pricing – Starter, Creator, Pro & Business Plans",
  description:
    "AutoClipr pricing: start free, or choose Creator (₹599/mo), Pro (₹999/mo) or Business (₹1,999/mo) for more credits, longer videos, no watermark, scheduling and analytics.",
  path: "/pricing",
});

const TRUST_ITEMS = [
  { icon: Zap, label: "Start for free" },
  { icon: Check, label: "No credit card required for Starter" },
  { icon: Shield, label: "Cancel paid plans anytime" },
  { icon: Lock, label: "Secure payments via Dodo Payments" },
];

/** Plans from the API (the authority); falls back to built-in values if it's down. */
async function loadPlans(): Promise<PlanNumbers[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/v1/plans`, {
      next: { revalidate: 300 },
    });
    const body = await res.json();
    return mergeLivePlans(Array.isArray(body?.data) ? body.data : null);
  } catch {
    return mergeLivePlans(null);
  }
}

export default async function PricingPage() {
  const plans = await loadPlans();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "AutoClipr",
    description: "AI video clipping and short-form publishing.",
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: (p.price_cents / 100).toFixed(2),
      priceCurrency: "INR",
      ...(p.price_cents > 0 ? { priceSpecification: { "@type": "UnitPriceSpecification", price: (p.price_cents / 100).toFixed(2), priceCurrency: "INR", billingDuration: "P1M" } } : {}),
    })),
  };
  return (
    <div className="relative overflow-hidden pt-4">
      {/* Background glow blobs */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: "900px",
          height: "500px",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.05) 55%, transparent 75%)",
          filter: "blur(48px)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/4 top-40 -translate-x-1/2"
        style={{
          width: "400px",
          height: "400px",
          background: "radial-gradient(ellipse, rgba(91,108,246,0.10) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Hero header */}
      <div className="relative mx-auto max-w-3xl px-4 pb-4 pt-10 text-center sm:px-6">

        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Create more.{" "}
          <span className="bg-gradient-to-r from-[#54D045] to-[#35D6E8] bg-clip-text text-transparent">Edit less.</span>
        </h1>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-white/70">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <Icon className="h-3.5 w-3.5" />
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>


      {/* Pricing cards */}
      <Suspense fallback={<PricingSkeleton showHeader={false} />}>
        <PricingSection showHeader={false} plans={plans} />
      </Suspense>

      <CreditsExplainer plans={plans} />

      <PlanComparison plans={plans} />

      <PricingFAQ />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
