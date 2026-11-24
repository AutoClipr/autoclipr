"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronsLeft, Zap } from "lucide-react";
import { ADMIN_NAV, isActivePath } from "./admin-nav";
import { cn } from "@/lib/utils";

/**
 * Admin navigation. Desktop: fixed, collapsible to an icon rail (labels move
 * into tooltips). Mobile: slide-over drawer.
 */
export function AdminSidebar({
  open, onClose, collapsed, onToggleCollapsed,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />}

      <aside
        aria-label="Admin navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#263449] bg-[#0D1524] transition-[width,transform] duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "w-[248px] lg:w-[72px]" : "w-[248px]",
        )}
      >
        {/* Brand */}
        <div className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-[#263449] px-4", collapsed && "lg:justify-center lg:px-0")}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#54D045] shadow-[0_0_20px_-4px_rgba(84,208,69,0.6)]">
            <Zap className="h-4 w-4 text-[#0B1120]" fill="currentColor" />
          </span>
          <div className={cn("min-w-0", collapsed && "lg:hidden")}>
            <p className="text-sm font-semibold leading-none text-[#F8FAFC]">AutoClipr</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#94A3B8]">Admin Panel</p>
          </div>
        </div>

        {/* Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none]">
          {ADMIN_NAV.map((group) => (
            <div key={group.label} className="mb-5">
              <p className={cn("mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]", collapsed && "lg:sr-only")}>{group.label}</p>
              {collapsed && <div className="mx-auto mb-2 hidden h-px w-6 bg-[#263449] lg:block" aria-hidden />}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className="group/item relative">
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
                          collapsed && "lg:justify-center lg:px-0",
                          active ? "bg-[#54D045]/[0.1] text-[#F8FAFC]" : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#F8FAFC]",
                        )}
                      >
                        {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[#54D045]" aria-hidden />}
                        <Icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-[#54D045]" : "")} />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                      </Link>
                      {collapsed && (
                        <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-[#263449] bg-[#1A2739] px-2 py-1 text-xs text-[#F8FAFC] opacity-0 shadow-lg transition-opacity group-hover/item:opacity-100 lg:block">
                          {item.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 space-y-1 border-t border-[#263449] p-3">
          <Link href="/dashboard" title="Back to app"
            className={cn("flex h-9 items-center gap-3 rounded-lg px-3 text-xs font-medium text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#F8FAFC]", collapsed && "lg:justify-center lg:px-0")}>
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Back to app</span>
          </Link>
          <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn("hidden h-9 w-full items-center gap-3 rounded-lg px-3 text-xs font-medium text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#F8FAFC] lg:flex", collapsed && "lg:justify-center lg:px-0")}>
            <ChevronsLeft className={cn("h-4 w-4 shrink-0 transition-transform", collapsed && "rotate-180")} />
            <span className={cn(collapsed && "lg:hidden")}>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
}
