"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronDown, CornerDownLeft, LogOut, Menu, Moon, Search, Settings, Sun, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "./admin-sidebar";
import { ADMIN_NAV } from "./admin-nav";
import { cn } from "@/lib/utils";

const initials = (email: string) => email.split("@")[0].slice(0, 2).toUpperCase();

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private mode */
  }
}

/** Admin chrome: sidebar, top bar, ⌘K command palette and page area. */
export function AdminShell({ children, userEmail = "" }: { children: React.ReactNode; userEmail?: string }) {
  const [dark, setDark] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    setCollapsed(read("admin.sidebar.collapsed") === "1");
    setDark(read("admin.theme") !== "light");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      write("admin.sidebar.collapsed", c ? "0" : "1");
      return !c;
    });
  };
  const toggleTheme = () => {
    setDark((d) => {
      write("admin.theme", d ? "light" : "dark");
      return !d;
    });
  };

  return (
    // Light mode keeps the existing inverted-palette approach used across admin pages.
    <div className={cn("min-h-screen bg-[#0B1120] text-[#F8FAFC]", !dark && "[&_*]:![filter:invert(1)_hue-rotate(180deg)]")}>
      <AdminSidebar open={drawer} onClose={() => setDrawer(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <div className={cn("transition-[margin] duration-200", collapsed ? "lg:ml-[72px]" : "lg:ml-[248px]")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#263449] bg-[#0B1120]/85 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" aria-label="Open navigation" onClick={() => setDrawer(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.05] lg:hidden">
            <Menu className="h-5 w-5" />
          </button>

          <button type="button" onClick={() => setPalette(true)} aria-label="Search admin (Ctrl or Cmd + K)"
            className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-[#263449] bg-[#141F30] px-3 text-left text-sm text-[#64748B] transition-colors hover:border-[#35445a]">
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">Search pages and actions…</span>
            <kbd className="hidden rounded border border-[#263449] bg-[#0B1120] px-1.5 py-0.5 text-[10px] font-medium text-[#94A3B8] sm:inline">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.05] hover:text-[#F8FAFC]">
              {dark ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
            </button>
            <Link href="/admin/notifications" aria-label="Notifications" title="Notifications"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.05] hover:text-[#F8FAFC]">
              <Bell className="h-[17px] w-[17px]" />
            </Link>
            <span className="mx-1 h-6 w-px bg-[#263449]" aria-hidden />
            <ProfileMenu email={userEmail} />
          </div>
        </header>

        <main className="min-h-[calc(100vh-64px)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}

function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) return toast.error("Couldn't sign you out. Please try again.");
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[0.05]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#54D045]/15 text-[11px] font-bold text-[#8fe383] ring-1 ring-[#54D045]/30">{initials(email)}</span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[140px] truncate text-[13px] font-medium leading-none text-[#F8FAFC]">{email.split("@")[0]}</span>
          <span className="mt-1 block text-[10px] text-[#94A3B8]">Administrator</span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-[#64748B] sm:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[#263449] bg-[#141F30] p-1 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]">
          <p className="truncate px-3 py-2 text-xs text-[#94A3B8]">{email}</p>
          <div className="my-1 h-px bg-[#263449]" />
          <Link role="menuitem" href="/admin/settings" onClick={() => setOpen(false)} className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-[#F8FAFC] hover:bg-white/[0.05]"><Settings className="h-4 w-4 text-[#94A3B8]" /> Settings</Link>
          <Link role="menuitem" href="/dashboard" onClick={() => setOpen(false)} className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-[#F8FAFC] hover:bg-white/[0.05]"><ArrowLeft className="h-4 w-4 text-[#94A3B8]" /> Back to app</Link>
          <button role="menuitem" type="button" onClick={() => void signOut()} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-[#F87171] hover:bg-[#F87171]/10"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      )}
    </div>
  );
}

/** ⌘K: jump to any admin page or quick action. */
function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const items = useMemo(() => {
    const all = [
      ...ADMIN_NAV.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label }))),
      { href: "/admin?days=7", icon: Search, label: "Dashboard: last 7 days", group: "Quick actions", keywords: "week" },
      { href: "/admin?days=90", icon: Search, label: "Dashboard: last 90 days", group: "Quick actions", keywords: "quarter" },
      { href: "/dashboard", icon: ArrowLeft, label: "Back to app", group: "Quick actions", keywords: "exit user" },
    ];
    const s = q.trim().toLowerCase();
    return s ? all.filter((x) => `${x.label} ${x.group} ${x.keywords ?? ""}`.toLowerCase().includes(s)) : all;
  }, [q]);

  useEffect(() => setI(0), [q]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#263449] bg-[#141F30] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-2 border-b border-[#263449] px-4">
          <Search className="h-4 w-4 text-[#64748B]" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Go to page or run an action…" aria-label="Search"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
              else if (e.key === "Enter" && items[i]) go(items[i].href);
            }}
            className="h-12 flex-1 bg-transparent text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
          <kbd className="rounded border border-[#263449] px-1.5 py-0.5 text-[10px] text-[#94A3B8]">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {items.map((it, idx) => {
            const Icon = it.icon;
            return (
              <li key={it.href + it.label} role="option" aria-selected={idx === i}>
                <button type="button" onMouseEnter={() => setI(idx)} onClick={() => go(it.href)}
                  className={cn("flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm", idx === i ? "bg-[#54D045]/10 text-[#F8FAFC]" : "text-[#CBD5E1]")}>
                  <Icon className="h-4 w-4 text-[#94A3B8]" />
                  <span className="flex-1 truncate">{it.label}</span>
                  <span className="text-[11px] text-[#64748B]">{it.group}</span>
                  {idx === i && <CornerDownLeft className="h-3.5 w-3.5 text-[#64748B]" />}
                </button>
              </li>
            );
          })}
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-[#64748B]">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}
