import { BarChart3, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type AnalyticsOverview, type Profile } from "@/lib/api";
import { AnalyticsDashboard } from "@/components/dashboard/analytics-dashboard";
import { UpgradeButton } from "@/components/billing/pricing-modal";
import { isPaidTier } from "@/lib/plans";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session!.access_token;

  // The API enforces this too (403 for Starter); this just shows the right screen.
  const me = await apiFetch<Profile>("/api/v1/users/me", { token });
  if (!isPaidTier(me.data?.subscription_tier)) {
    return <AnalyticsUpgrade credits={me.data?.credits ?? 0} />;
  }

  const res = await apiFetch<AnalyticsOverview>("/api/v1/analytics", { token });

  const initialData: AnalyticsOverview = res.data ?? {
    summary: {
      posted_count: 0,
      failed_count: 0,
      pending_count: 0,
      total_views: 0,
      total_likes: 0,
      connected_platforms_count: 0,
    },
    connected_platforms: [],
    by_platform: {},
    publications: [],
  };

  return <AnalyticsDashboard initialData={initialData} loadFailed={!res.success} />;
}

function AnalyticsUpgrade({ credits }: { credits: number }) {
  const points = [
    "Views, likes and comments for every clip you publish",
    "Per-platform performance for YouTube Shorts and Instagram Reels",
    "Top-performing posts and publishing activity over time",
    "Sync stats on demand, with the last sync time shown",
  ];
  return (
    <div className="relative mx-auto max-w-2xl py-10">
      <div className="rounded-3xl border border-[#253244] bg-[#101824] p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#54D045]/15 ring-1 ring-[#54D045]/25">
          <BarChart3 className="h-7 w-7 text-[#54D045]" aria-hidden />
        </span>
        <p className="mb-2 inline-block rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
          Creator, Pro &amp; Business plans
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#F8FAFC] sm:text-3xl">Analytics</h1>
        <p className="mt-2 text-sm text-[#94A3B8]">See how your published clips perform. Available on paid plans.</p>
        <ul className="mx-auto mt-6 max-w-md space-y-2.5 text-left text-sm text-[#cbd5e1]">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#54D045]" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <UpgradeButton
          credits={credits}
          className="mt-7 rounded-full bg-[#54D045] px-6 py-2.5 text-sm font-semibold text-[#070B12] transition-colors hover:bg-[#62dc53]"
        >
          Upgrade to unlock
        </UpgradeButton>
      </div>
    </div>
  );
}
