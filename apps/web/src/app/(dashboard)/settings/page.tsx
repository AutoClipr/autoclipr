import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Bell, Link2, ShieldCheck, TriangleAlert, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type PlatformConnection, type Profile } from "@/lib/api";
import { resolveUserFullName } from "@/lib/user-avatar";
import { DeleteAccountSection } from "@/components/dashboard/delete-account-section";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { EmailNotificationsSection } from "@/components/dashboard/email-notifications-section";
import { SignOutEverywhere } from "@/components/dashboard/sign-out-everywhere";
import { cn } from "@/lib/utils";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "connections", label: "Connected accounts", icon: Link2 },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "danger", label: "Delete account", icon: TriangleAlert },
];

const PLATFORMS = [
  { id: "youtube", label: "YouTube" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
];

type ProfileWithPrefs = Profile & {
  clips_ready_email_notifications?: boolean;
  platform_email_notifications?: boolean;
  scheduler_email_notifications?: boolean;
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session!.access_token;

  const [profileRes, platformsRes] = await Promise.all([
    apiFetch<ProfileWithPrefs>("/api/v1/users/me", { token }),
    apiFetch<PlatformConnection[]>("/api/v1/platforms", { token }),
  ]);

  const profile = profileRes.data;
  const authUser = session!.user;
  const authEmail = authUser.email ?? profile?.email ?? "";
  const authPhone = authUser.phone ?? profile?.phone ?? null;
  const needsEmail = !authEmail;
  const connections = platformsRes.data ?? [];

  return (
    <div className="relative mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[#54D045]">ACCOUNT PREFERENCES</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#F8FAFC]">Settings</h1>
        <p className="mt-1 text-sm text-[#94A3B8]">Manage your account, preferences, and notifications.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        {/* In-page navigation */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/[0.04] hover:text-[#F8FAFC]",
                      s.id === "danger" ? "text-[#f87171]/80 hover:text-[#fca5a5]" : "text-[#94A3B8]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {needsEmail && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100">
              Add and verify your email below to enable Google/YouTube posting and account recovery.
            </div>
          )}

          <Section id="profile" title="Profile" description="How you appear in AutoClipr.">
            <SettingsForm
              email={authEmail}
              fullName={profile?.full_name ?? resolveUserFullName(authUser.user_metadata) ?? ""}
              avatarUrl={profile?.avatar_url ?? authUser.user_metadata?.avatar_url ?? ""}
              phone={authPhone}
              emailEditable={needsEmail}
              emailVerified={!!authUser.email_confirmed_at}
            />
          </Section>

          <Section
            id="notifications"
            title="Notification preferences"
            description="Choose which updates you want to receive from AutoClipr."
          >
            {profile ? (
              <EmailNotificationsSection
                initialEnabled={profile.email_notifications_enabled ?? true}
                initialPrefs={{
                  clips_ready_email_notifications: profile.clips_ready_email_notifications ?? true,
                  scheduler_email_notifications: profile.scheduler_email_notifications ?? true,
                  platform_email_notifications: profile.platform_email_notifications ?? true,
                }}
              />
            ) : (
              <p className="text-sm text-[#94A3B8]">We couldn&apos;t load your preferences. Refresh the page to try again.</p>
            )}
          </Section>

          <Section
            id="connections"
            title="Connected accounts"
            description="Social accounts AutoClipr can publish your clips to."
            action={
              <Link
                href="/setup/platforms?from=dashboard"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#253244] px-3 text-xs font-medium text-[#F8FAFC] transition-colors hover:border-[#35445a] hover:bg-white/[0.04]"
              >
                Manage <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {platformsRes.success ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {PLATFORMS.map((p) => {
                  const conn = connections.find((c) => c.platform === p.id);
                  const status = !conn ? "off" : conn.can_post === false && p.id !== "facebook" ? "attention" : "on";
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#253244] bg-[#0B1220]/40 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#F8FAFC]">{p.label}</p>
                        <p className="truncate text-xs text-[#94A3B8]">
                          {conn?.account_name ?? (conn ? "Connected" : "Not connected")}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          status === "on" && "border-[#54D045]/30 bg-[#54D045]/10 text-[#8fe383]",
                          status === "attention" && "border-amber-400/30 bg-amber-400/10 text-amber-200",
                          status === "off" && "border-[#253244] text-[#94A3B8]",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            status === "on" ? "bg-[#54D045]" : status === "attention" ? "bg-amber-300" : "bg-[#475569]",
                          )}
                        />
                        {status === "on" ? "Connected" : status === "attention" ? "Reconnect" : "Off"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-[#94A3B8]">We couldn&apos;t load your connections right now.</p>
            )}
          </Section>

          <Section id="security" title="Security" description="Keep your account safe.">
            <div className="flex flex-col gap-4 rounded-xl border border-[#253244] bg-[#0B1220]/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[#F8FAFC]">Sign out of all devices</p>
                <p className="text-xs text-[#94A3B8]">
                  Ends every active session, including this one. Use this if you signed in on a shared or lost device.
                </p>
              </div>
              <SignOutEverywhere />
            </div>
          </Section>

          <Section id="danger" title="Delete account" tone="danger">
            <DeleteAccountSection />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  action,
  tone,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "danger";
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-[#101824] p-5 sm:p-6",
        tone === "danger" ? "border-[#EF4444]/25" : "border-[#253244]",
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className={cn("text-base font-semibold", tone === "danger" ? "text-[#f87171]" : "text-[#F8FAFC]")}>
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-[#94A3B8]">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
