import { CalendarClock } from "lucide-react";
import { SchedulerView } from "@/components/scheduler/scheduler-view";
import { PlanUpgradeCard } from "@/components/billing/plan-upgrade-card";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type Profile } from "@/lib/api";
import { hasSchedulerAccess } from "@/lib/scheduler";

export const metadata = { title: "Content Scheduler" };

export default async function SchedulerPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await apiFetch<Profile>("/api/v1/users/me", { token: session!.access_token });
  const tier = res.data?.subscription_tier ?? "starter";

  if (!hasSchedulerAccess(tier)) {
    return <SchedulerUpgrade />;
  }
  return <SchedulerView />;
}

function SchedulerUpgrade() {
  return (
    <div className="flex justify-center py-10">
      <PlanUpgradeCard
        icon={CalendarClock}
        title="Content Scheduler"
        description="Schedule your clips once and let AutoClipr publish them for you."
        benefits={[
          "Plan Shorts and Reels on a month, week or list calendar",
          "Auto-publish to YouTube Shorts and Instagram Reels on time",
          "Per-platform captions, drafts, and drag-to-reschedule",
          "Email alerts when a post goes live or needs attention",
        ]}
      />
    </div>
  );
}
