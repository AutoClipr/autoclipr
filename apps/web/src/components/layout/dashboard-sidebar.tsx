"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  CalendarDays,
  LayoutDashboard,
  Film,
  BarChart3,
  CreditCard,
  Settings,
  Menu,
  X,
  Youtube,
  Link2,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoIcon } from "@/components/ui/logo-icon";
import { useState } from "react";
import { hasSchedulerAccess } from "@/lib/scheduler";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; paid?: boolean };

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Create",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/create", label: "Create", icon: Sparkles },
      { href: "/channels", label: "Channels", icon: Youtube },
      { href: "/clips", label: "Clips", icon: Film },
    ],
  },
  {
    title: "Post",
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

export function DashboardSidebar({ plan = "starter" }: { plan?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-20 z-40 rounded-xl border border-white/[0.08] bg-[#0a0618]/90 p-2.5 backdrop-blur-xl lg:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/[0.06] bg-[#030014]/80 backdrop-blur-2xl transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-6">
          <LogoIcon size={32} className="rounded-lg shadow-glow" />
          <span className="font-bold">Auto<span className="text-emerald-400">Clipr</span></span>
        </div>

        <div className="mx-4 mt-5">
          <Link
            href="/create"
            onClick={() => setOpen(false)}
            className={cn(
              "flex flex-col gap-2 rounded-xl p-4 create-sidebar-card",
              (pathname === "/create" || pathname === "/upload") && "create-sidebar-card-active"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700">
                <Link2 className="h-4 w-4 text-white" />
              </span>
              <span className="text-sm font-bold leading-tight">Create Viral Shorts</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste YouTube, Vimeo, or any video URL
            </p>
          </Link>
        </div>

        <nav className="mt-5 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-xs font-medium text-white/40">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href === "/create" && pathname === "/upload") ||
                    (item.href === "/channels" && pathname.startsWith("/channels"));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-white/[0.08] text-white"
                          : "text-white/75 hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                      {item.label}
                      {item.paid && !hasSchedulerAccess(plan) && (
                        <span className="ml-auto rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                          Pro
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] p-4">
          <p className="text-xs text-muted-foreground">
            Need help?{" "}
            <Link href="/contact" className="text-emerald-400 hover:underline">
              Contact support
            </Link>
          </p>
        </div>
      </aside>
    </>
  );
}
