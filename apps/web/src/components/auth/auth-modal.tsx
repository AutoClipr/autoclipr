"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";

type AuthModalMode = "login" | "register";
type AuthModalState = { mode: AuthModalMode; redirect?: string } | null;

const OPEN_EVENT = "autoclipr:open-auth";
let listening = false;

/**
 * Open the sign-in / sign-up popup. Falls back to the full page when no
 * popup is mounted (e.g. outside the marketing layout).
 */
export function openAuth(mode: AuthModalMode, redirect?: string) {
  if (!listening) {
    const q = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
    window.location.href = `/${mode}${q}`;
    return;
  }
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { mode, redirect } }));
}

/**
 * Shows login/register as a popup over the current page. Any link to
 * /login or /register on the page opens it instead of navigating; the
 * standalone pages still work for direct visits and auth redirects.
 */
export function AuthModal() {
  const [state, setState] = useState<AuthModalState>(null);
  const pathname = usePathname();

  useEffect(() => {
    listening = true;
    const onOpen = (e: Event) => setState((e as CustomEvent).detail);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const mode = url.pathname === "/login" ? "login" : url.pathname === "/register" ? "register" : null;
      if (!mode) return;
      e.preventDefault();
      e.stopPropagation();
      setState({ mode, redirect: url.searchParams.get("redirect") ?? undefined });
    };

    window.addEventListener(OPEN_EVENT, onOpen);
    document.addEventListener("click", onClick, true);
    return () => {
      listening = false;
      window.removeEventListener(OPEN_EVENT, onOpen);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  // Close once sign-in navigates somewhere else.
  useEffect(() => setState(null), [pathname]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState(null);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [state]);

  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={state.mode === "login" ? "Sign in" : "Create account"}
      onMouseDown={(e) => e.target === e.currentTarget && setState(null)}
    >
      <div className="relative w-full max-w-md lg:max-w-[34rem] 2xl:max-w-xl">
        <button
          type="button"
          onClick={() => setState(null)}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="bg-[#0b0d0c] rounded-3xl">
          <AuthForm key={state.mode} mode={state.mode} redirectOverride={state.redirect} />
        </div>
      </div>
    </div>
  );
}
