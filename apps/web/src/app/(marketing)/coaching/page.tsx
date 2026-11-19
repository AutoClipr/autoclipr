import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, CalendarCheck, LineChart, MessageCircle, Sparkles } from "lucide-react";
import { MarketingHero } from "@/components/marketing/marketing-hero";

export const metadata: Metadata = pageMetadata({
  title: "1-on-1 Creator Coaching — Grow Your Channel Faster",
  description:
    "Get personalised 1-on-1 coaching to grow your YouTube, TikTok, and Reels channels faster. Expert guidance on short-form content strategy, editing, and monetisation. Coming soon.",
  path: "/coaching",
  keywords: [
    "creator coaching", "youtube coaching", "tiktok growth coaching",
    "short form video coaching", "content creator mentorship", "youtube shorts coach",
  ],
});

export default function CoachingPage() {
  return (
    <div className="relative isolate">
      <MarketingHero
        icon={<Sparkles className="h-8 w-8" />}
        label="Coming soon"
        title="1-on-1 creator"
        highlight="coaching"
        description="Personal guidance on short-form strategy, editing and growth. We're building something special — check back soon."
      >
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)] transition-shadow hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.65)]"
          >
            Start clipping free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/25 hover:text-white"
          >
            Ask about coaching
          </Link>
        </div>
      </MarketingHero>

      <div className="mx-auto grid max-w-5xl gap-4 px-4 pb-24 sm:grid-cols-3 sm:px-6">
        {[
          { icon: CalendarCheck, title: "Content plan", body: "A posting plan built around your niche and the formats that work on each platform." },
          { icon: LineChart, title: "Channel review", body: "A look at what's working, what's not, and where your next views will come from." },
          { icon: MessageCircle, title: "Direct feedback", body: "Honest notes on hooks, pacing and captions from people who clip every day." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
              <Icon className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="font-semibold text-white">{title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/50">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
