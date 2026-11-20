import { CalendarClock, Check } from "lucide-react";
import { SchedulerView } from "@/components/scheduler/scheduler-view";
import { UpgradeButton } from "@/components/billing/pricing-modal";
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
    return <SchedulerUpgrade credits={res.data?.credits ?? 0} />;
  }
  return <SchedulerView />;
}

function SchedulerUpgrade({ credits }: { credits: number }) {
  const points = [
    "Plan Shorts and Reels on a month, week or list calendar",
    "Auto-publish to YouTube Shorts and Instagram Reels on time",
    "Per-platform captions, drafts, and drag-to-reschedule",
    "Email alerts when a post goes live or needs attention",
  ];
  return (
    <div className="relative mx-auto max-w-2xl py-10">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/25">
          <CalendarClock className="h-7 w-7 text-emerald-300" />
        </span>
        <p className="mb-2 inline-block rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
          Creator, Pro &amp; Business plans
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Content Scheduler</h1>
        <p className="mt-2 text-sm text-white/55">
          Schedule your clips once and let AutoClipr publish them for you. Available on paid plans.
        </p>
        <ul className="mx-auto mt-6 max-w-md space-y-2.5 text-left text-sm text-white/75">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              {p}
            </li>
          ))}
        </ul>
        <UpgradeButton
          credits={credits}
          className="mt-7 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black shadow-[0_0_20px_-4px_rgba(255,255,255,0.55)] transition-transform hover:scale-[1.02]"
        >
          Upgrade to unlock
        </UpgradeButton>
      </div>
    </div>
  );
}
