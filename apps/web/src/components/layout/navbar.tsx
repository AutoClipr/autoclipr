import Link from "next/link";
import { LogoIcon } from "@/components/ui/logo-icon";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type Profile } from "@/lib/api";
import { resolveUserFullName } from "@/lib/user-avatar";
import { UserMenu } from "./user-menu";
import { FreeToolsDropdown } from "./free-tools-dropdown";
import { ResourcesDropdown } from "./resources-dropdown";
import { FeaturesDropdown } from "./features-dropdown";
import { MobileMenu } from "./mobile-menu";
import { NavbarShell } from "./navbar-shell";
import { DashboardLink } from "./dashboard-link";
import { AppHeaderActions } from "./app-header-actions";

const linksRight = [
  { href: "/coaching", label: "Coaching" },
  { href: "/top-creators", label: "Top Creators" },
  { href: "/pricing", label: "Pricing" },
];

export async function Navbar({
  solid = false,
  credits,
  plan,
}: { solid?: boolean; plan?: string; /** Set on app pages: shows notifications, credits and Add credits. */ credits?: number } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Plan badge for the account menu. App pages pass it in; elsewhere fetch it.
  let userPlan = plan;
  if (user && !userPlan) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const res = await apiFetch<Profile>("/api/v1/users/me", { token: session.access_token });
      if (res.success && res.data) userPlan = res.data.subscription_tier || "free";
    }
  }

  return (
    <NavbarShell solid={solid}>

      <div className="flex h-14 w-full items-center justify-between px-4 sm:h-16 sm:px-6 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-8">
        {/* Logo */}
        <Link href="/" className="group relative flex items-center gap-2.5 justify-self-start font-bold">
          <span className="absolute -inset-2 -z-10 rounded-2xl bg-emerald-500/0 blur-xl transition-colors duration-300 group-hover:bg-emerald-500/15" />
          <LogoIcon size={36} className="rounded-xl shadow-glow transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" />
          <span className="text-base sm:text-lg">
            Auto<span className="gradient-text">Clipr.ai</span>
          </span>
        </Link>

        {/* Desktop nav — plain text links, no pill */}
        <nav className="hidden items-center gap-1 md:flex">
          <FeaturesDropdown />
          <FreeToolsDropdown />
          {linksRight.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group relative rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-white/[0.06] hover:text-foreground"
            >
              {l.label}
              <span className="absolute inset-x-3 -bottom-px h-px scale-x-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/70 to-emerald-400/0 transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
          <ResourcesDropdown />
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 justify-self-end">
          {/* Mobile: Sign up + hamburger */}
          {!user && (
            <Link
              href="/register"
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 transition-colors md:hidden"
            >
              Sign up free
            </Link>
          )}
          <MobileMenu isLoggedIn={!!user} />

          {/* Desktop: signed in → Dashboard + avatar; signed out → Sign in + Sign up */}
          {user ? (
            <div className="flex items-center gap-3">
              {credits !== undefined ? <AppHeaderActions credits={credits} plan={plan} /> : <DashboardLink />}
              <UserMenu
                email={user.email}
                phone={user.phone}
                fullName={resolveUserFullName(user.user_metadata)}
                plan={userPlan}
                avatarUrl={typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : undefined}
              />
            </div>
          ) : (
            <div className="hidden items-center gap-4 md:flex">
              <Link href="/login" className="text-sm font-semibold text-white transition-all [text-shadow:0_0_12px_rgba(255,255,255,0.55)] hover:[text-shadow:0_0_18px_rgba(255,255,255,0.9)]">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400"
              >
                <span className="xl:hidden">Sign up</span>
                <span className="hidden xl:inline">Sign up — it&apos;s free</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </NavbarShell>
  );
}
