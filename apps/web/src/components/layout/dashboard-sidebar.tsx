"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  Film,
  Gift,
  LayoutDashboard,
  Menu,
  Settings,
  Sparkles,
  Wand2,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoIcon } from "@/components/ui/logo-icon";
import { hasSchedulerAccess } from "@/lib/scheduler";

export const SIDEBAR_COOKIE = "autoclipr_sidebar_collapsed";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  paid?: boolean;
  /** Extra paths that should also mark this item active. */
  match?: (path: string) => boolean;
};

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/dashboard" },
      { href: "/create", label: "Create", icon: Sparkles, match: (p) => p === "/create" || p === "/upload" },
      { href: "/channels", label: "Channels", icon: Youtube },
      { href: "/clips", label: "My Clips", icon: Film },
    ],
  },
  {
    title: "Publish & grow",
    items: [
      { href: "/scheduler", label: "Content Scheduler", icon: CalendarDays, paid: true },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/subscription", label: "Subscription", icon: CreditCard },
      { href: "/dashboard/affiliate", label: "Refer a friend", icon: Gift },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(item: NavItem, path: string) {
  if (item.match) return item.match(path);
  return path === item.href || path.startsWith(`${item.href}/`);
}

export function DashboardSidebar({
  plan = "starter",
  credits,
  initialCollapsed = false,
}: {
  plan?: string;
  /** Live balance from the profile; the widget is hidden when unknown. */
  credits?: number | null;
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Close the drawer after navigating.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock background scroll and allow Escape while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      const shell = document.getElementById("app-shell");
      if (shell) shell.dataset.sidebar = next ? "collapsed" : "expanded";
      return next;
    });
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        className="fixed left-4 top-20 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-[#253244] bg-[#080D18]/95 text-[#F8FAFC] backdrop-blur lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        aria-controls="app-sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[115] bg-[#070B12]/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-[120] flex w-[260px] flex-col border-r border-[#253244]/70 bg-[#080D18] transition-[transform,width] duration-200 ease-out lg:top-16 lg:z-30 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[72px]" : "lg:w-64",
        )}
      >
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4 lg:hidden">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60">
            <LogoIcon size={30} className="shrink-0 rounded-lg" />
            <span className="truncate font-bold text-[#F8FAFC]">
              Auto<span className="text-[#54D045]">Clipr</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#131D2B] hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-3 [scrollbar-color:#253244_transparent] [scrollbar-width:thin]",
            collapsed && "lg:overflow-visible",
          )}
        >
          {/* Create CTA */}
          <Link
            href="/create"
            aria-label="Create new clips"
            className={cn(
              "group relative mb-4 mt-1 block rounded-2xl lg:mt-9 border border-[#54D045]/25 bg-gradient-to-br from-[#54D045]/[0.12] to-[#54D045]/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#54D045]/45 hover:shadow-[0_10px_30px_-14px_rgba(84,208,69,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60",
              collapsed ? "p-3 lg:flex lg:justify-center lg:p-2.5" : "p-3",
            )}
          >
            <div className={cn("flex items-center gap-2.5", collapsed && "lg:justify-center")}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#54D045] text-[#070B12]">
                <Wand2 className="h-4 w-4" />
              </span>
              <span className={cn("text-sm font-semibold text-[#F8FAFC]", collapsed && "lg:hidden")}>
                Create Viral Shorts
              </span>
            </div>
            <div className={cn(collapsed && "lg:hidden")}>
              <p className="mt-1.5 text-xs leading-snug text-[#94A3B8]">
                Turn long videos into engaging shorts with AI.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#8fe383]">
                Create New Clips
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            {collapsed && <Tooltip label="Create New Clips" />}
          </Link>

          {/* Navigation */}
          <nav className="space-y-4" aria-label="Sections">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <p
                  className={cn(
                    "mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#64748B]",
                    collapsed && "lg:hidden",
                  )}
                >
                  {section.title}
                </p>
                {collapsed && <div className="mx-3 mb-2 hidden h-px bg-[#253244]/70 lg:block" aria-hidden />}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item, pathname);
                    const Icon = item.icon;
                    const locked = item.paid && !hasSchedulerAccess(plan);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60",
                            active
                              ? "bg-[#19251F] text-[#F8FAFC]"
                              : "text-[#94A3B8] hover:bg-[#131D2B] hover:text-[#F8FAFC]",
                            collapsed && "lg:justify-center lg:px-0",
                          )}
                        >
                          {active && (
                            <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#54D045]" aria-hidden />
                          )}
                          <Icon
                            className={cn(
                              "h-[18px] w-[18px] shrink-0 transition-colors",
                              active ? "text-[#54D045]" : "text-[#64748B] group-hover:text-[#cbd5e1]",
                            )}
                            strokeWidth={1.75}
                          />
                          <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                          {locked && (
                            <span
                              className={cn(
                                "ml-auto rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-300",
                                collapsed && "lg:hidden",
                              )}
                            >
                              Pro
                            </span>
                          )}
                          {collapsed && <Tooltip label={item.label} />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom */}
        <div className="shrink-0 space-y-1.5 border-t border-[#253244]/70 p-3">
          {typeof credits === "number" && (
            <Link
              href="/subscription"
              className={cn(
                "group relative block rounded-xl border border-[#253244] bg-[#101824] px-3 py-2.5 transition-colors hover:border-[#35445a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60",
                collapsed && "lg:flex lg:justify-center lg:p-2",
              )}
            >
              <div className={cn("flex items-center gap-2", collapsed && "lg:hidden")}>
                <Zap className="h-3.5 w-3.5 fill-[#54D045] text-[#54D045]" />
                <span className="text-[11px] font-medium text-[#94A3B8]">Credits balance</span>
              </div>
              <div className={cn("mt-1 flex items-end justify-between gap-2", collapsed && "lg:hidden")}>
                <span className="text-lg font-semibold tabular-nums text-[#F8FAFC]">
                  {credits.toLocaleString()} <span className="text-xs font-medium text-[#94A3B8]">credits</span>
                </span>
                <span className="mb-1 text-[11px] font-medium text-[#8fe383] group-hover:underline">Manage</span>
              </div>
              {collapsed && (
                <span className="hidden flex-col items-center lg:flex">
                  <Zap className="h-4 w-4 fill-[#54D045] text-[#54D045]" />
                  <span className="mt-0.5 text-[10px] font-semibold tabular-nums text-[#F8FAFC]">{compact(credits)}</span>
                </span>
              )}
              {collapsed && <Tooltip label={`${credits.toLocaleString()} credits — Manage`} />}
            </Link>
          )}


          <div className={cn("flex items-center justify-between gap-2 px-1 pt-1", collapsed && "lg:flex-col")}>
            <p className={cn("text-[11px] text-[#64748B]", collapsed && "lg:hidden")}>
              Need help?{" "}
              <Link href="/contact" className="font-medium text-[#8fe383] hover:underline">
                Contact support
              </Link>
            </p>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#64748B] transition-colors hover:bg-[#131D2B] hover:text-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60 lg:flex"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function compact(n: number) {
  return n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString();
}

/** Label shown beside an icon when the sidebar is collapsed (desktop only). */
function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-[#253244] bg-[#101824] px-2 py-1 text-xs font-medium text-[#F8FAFC] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 lg:block"
    >
      {label}
    </span>
  );
}
