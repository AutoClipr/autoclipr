import { BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type AnalyticsOverview, type Profile } from "@/lib/api";
import { AnalyticsDashboard } from "@/components/dashboard/analytics-dashboard";
import { PlanUpgradeCard } from "@/components/billing/plan-upgrade-card";
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
    return <AnalyticsUpgrade />;
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

function AnalyticsUpgrade() {
  return (
    <div className="flex justify-center py-10">
      <PlanUpgradeCard
        icon={BarChart3}
        title="Analytics"
        description="See how your published clips perform."
        benefits={[
          "Views, likes and comments for every clip you publish",
          "Per-platform performance for YouTube Shorts and Instagram Reels",
          "Top-performing posts and publishing activity over time",
          "Sync stats on demand, with the last sync time shown",
        ]}
      />
    </div>
  );
}
