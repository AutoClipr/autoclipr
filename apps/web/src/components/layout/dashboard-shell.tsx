import { cookies } from "next/headers";
import { apiFetch, type Profile } from "@/lib/api";
import { DashboardSidebar, SIDEBAR_COOKIE } from "@/components/layout/dashboard-sidebar";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { Navbar } from "@/components/layout/navbar";
import { PageBackground } from "@/components/ui/page-background";
import { ReferralTracker } from "@/components/affiliates/referral-tracker";
import { Heartbeat } from "@/components/heartbeat";

export async function DashboardShell({
  children,
  token,
}: {
  children: React.ReactNode;
  token: string;
}) {
  let credits = 10;
  let sidebarCredits: number | null = null;
  let plan = "free";
  const [profileRes, cookieStore] = await Promise.all([
    apiFetch<Profile>("/api/v1/users/me", { token }),
    cookies(),
  ]);
  if (profileRes.success && profileRes.data) {
    credits = profileRes.data.credits;
    sidebarCredits = profileRes.data.credits;
    plan = profileRes.data.subscription_tier || "free";
  }

  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <div className="relative min-h-screen" data-sidebar={collapsed ? "collapsed" : "expanded"} id="app-shell">
      <ReferralTracker token={token} />
      <Heartbeat />
      <PageBackground variant="dashboard" />
      <Navbar solid credits={credits} plan={plan} />
      <DashboardSidebar plan={plan} credits={sidebarCredits} initialCollapsed={collapsed} />
      <div className="transition-[padding] duration-200 ease-out lg:pl-64 [[data-sidebar=collapsed]_&]:lg:pl-[72px]">
        <div className="mx-auto max-w-6xl px-4 py-8 pt-20 sm:px-6 lg:pt-8">{children}</div>
      </div>
      <AssistantWidget />
    </div>
  );
}
