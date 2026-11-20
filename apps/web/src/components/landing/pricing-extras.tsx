"use client";

import Link from "next/link";
import { Coins, Film, Gauge } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FALLBACK_PLANS, formatMinutes, type PlanNumbers } from "@/lib/plans";

/* ─── Credits explainer ─────────────────────────────────────────────────── */

export function CreditsExplainer({ plans = FALLBACK_PLANS }: { plans?: PlanNumbers[] }) {
  const points = [
    { icon: Coins, title: "Credits pay for AI work", body: "Each clip you generate uses credits at its configured cost. They're deducted when you submit a video, before processing starts." },
    { icon: Gauge, title: "Your plan sets the allowance", body: "Paid plans reset your balance to the plan's monthly credits at each renewal. If a job fails, its credits are returned automatically." },
    { icon: Film, title: "Clip counts are estimates", body: "How many clips you get depends on how many you ask for per video, video length and your settings — so the numbers below are a guide, not a guarantee." },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6" aria-labelledby="credits-title">
      <div className="mb-6 text-center">
        <h2 id="credits-title" className="text-2xl font-bold tracking-tight text-[#F8FAFC] sm:text-3xl">
          Simple credits. More possibilities.
        </h2>
        <p className="mt-2 text-sm text-[#94A3B8]">One balance for everything you create.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {points.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-[#253244] bg-[#101824] p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#253244] bg-[#0A111B]">
              <Icon className="h-4 w-4 text-[#54D045]" aria-hidden />
            </span>
            <p className="mt-3 font-semibold text-[#F8FAFC]">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#94A3B8]">{body}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {plans.map((p) => (
          <div key={p.id} className="rounded-2xl border border-[#253244] bg-[#0B1220] p-4 text-center">
            <p className="text-xs text-[#94A3B8]">{p.name}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#F8FAFC]">
              {p.estimated_clips[0]}–{p.estimated_clips[1]}
            </p>
            <p className="text-[11px] text-[#64748B]">
              est. clips · {p.credits_per_month.toLocaleString("en-IN")} credits · up to {formatMinutes(p.max_video_seconds)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Pricing FAQ ───────────────────────────────────────────────────────── */

/**
 * Answers reflect how billing actually works (apps/api billing + the Refund
 * & Cancellation Policy). Update both together.
 */
export const PRICING_FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "What are credits and how do they work?",
    a: "Credits are what AI clip generation costs. When you submit a video, the credits for the clips you asked for are deducted before processing starts. If the job fails, they're returned to your balance automatically.",
  },
  {
    q: "How many clips can I create with each plan?",
    a: "Roughly 6–10 a month on Starter, 60–80 on Creator, 120–150 on Pro and 240–300 on Business. These are estimates — your credits are the real limit, and usage varies with video length and settings.",
  },
  {
    q: "What is the maximum video length supported?",
    a: "Source videos can be up to 5 minutes on Starter, 10 minutes on Creator, 15 minutes on Pro and 30 minutes on Business. Longer videos are rejected before any AI processing, and their credits are refunded.",
  },
  {
    q: "Does Starter include a watermark?",
    a: "Yes. Clips made on the free Starter plan carry a small “Made with AutoClipr” mark. Creator, Pro and Business exports have no watermark.",
  },
  {
    q: "How can I remove the watermark?",
    a: "Upgrade to any paid plan. Clips you generate after upgrading are watermark-free. Clips already made on Starter keep their watermark.",
  },
  {
    q: "Which social platforms can I publish to?",
    a: "Today AutoClipr publishes directly to YouTube Shorts and Instagram Reels after you connect those accounts. TikTok, Facebook, LinkedIn, X and Threads are coming soon on paid plans. You can always download your clips and post them anywhere.",
  },
  {
    q: "Does AutoClipr support automatic scheduling?",
    a: "Yes, on Creator, Pro and Business. Plan clips on a calendar and AutoClipr publishes them to YouTube Shorts and Instagram Reels at the time you pick.",
  },
  {
    q: "What analytics are available?",
    a: "On paid plans, the Analytics page shows views, likes and comments for clips you published through AutoClipr, per platform, with the time stats were last synced. Figures come from YouTube and Instagram and refresh when you sync — they aren't real-time.",
  },
  {
    q: "Can I upgrade or downgrade my plan?",
    a: "Yes. If you're on a paid plan, choose another plan on the Pricing page and select “Switch”. The prorated difference is charged or credited straight away, and your new plan's credits apply once the payment provider confirms the change.",
  },
  {
    q: "Can I cancel my subscription?",
    a: (
      <>
        Yes, any time from Subscription in your dashboard — no fee or minimum term. Your plan stays active until the end of the period you paid for, then your account returns to Starter. See the{" "}
        <Link href="/refund-policy" className="text-[#54D045] hover:underline">
          Refund &amp; Cancellation Policy
        </Link>{" "}
        for refunds.
      </>
    ),
  },
  {
    q: "What happens when I run out of credits?",
    a: "You can't submit new videos until your balance covers the clips you ask for — nothing is charged and no job is queued. Your credits reset at your next renewal, or you can upgrade for a larger allowance.",
  },
  {
    q: "Can I use AutoClipr for commercial purposes?",
    a: "Yes. You keep ownership of the videos you upload and the clips you create, so you can use them for your brand or clients. You're responsible for having the rights to the source videos you clip.",
  },
];

export function PricingFAQ() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6" aria-labelledby="pricing-faq-title">
      <h2 id="pricing-faq-title" className="mb-6 text-center text-2xl font-bold tracking-tight text-[#F8FAFC] sm:text-3xl">
        Pricing questions
      </h2>
      <Accordion type="single" collapsible className="space-y-2.5">
        {PRICING_FAQS.map((f, i) => (
          <AccordionItem key={f.q} value={`p-${i}`} className="overflow-hidden rounded-2xl border border-[#253244] bg-[#101824]">
            <AccordionTrigger className="px-5 py-4 text-left text-[15px] font-semibold text-[#F8FAFC] hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-4 text-sm leading-relaxed text-[#94A3B8]">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
