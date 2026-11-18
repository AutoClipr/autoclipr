"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarClock, Captions, Crop, Scissors, Send, Sparkles, X } from "lucide-react";
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
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={state.mode === "login" ? "Sign in" : "Create account"}
      onMouseDown={(e) => e.target === e.currentTarget && setState(null)}
    >
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d0f0e] p-2.5 shadow-2xl shadow-black/60 lg:grid-cols-[1fr_1fr]">
        <button
          type="button"
          onClick={() => setState(null)}
          aria-label="Close"
          className="absolute right-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <ClipShowcase />
        <div className="flex items-center px-5 py-10 sm:px-10">
          <AuthForm key={state.mode} mode={state.mode} redirectOverride={state.redirect} variant="modal" />
        </div>
      </div>
    </div>
  );
}

const SLIDES = [
  {
    tab: "Viral moments",
    video: "/assets/mockups/youtube.mp4",
    title: "AI clipping",
    text: "Drop in a long video and get the moments most likely to go viral.",
    chips: [{ icon: Sparkles, label: "Viral score" }, { icon: Scissors, label: "Auto cuts" }],
  },
  {
    tab: "Captions",
    video: "/assets/mockups/tiktok.mp4",
    title: "Animated captions",
    text: "Word-by-word captions in on-trend styles, added for you.",
    chips: [{ icon: Captions, label: "50+ styles" }, { icon: Sparkles, label: "Emoji & highlights" }],
  },
  {
    tab: "9:16 reframe",
    video: "/assets/mockups/instagram.mp4",
    title: "Smart reframe",
    text: "Keeps the speaker in frame as wide video becomes vertical.",
    chips: [{ icon: Crop, label: "Face tracking" }, { icon: Sparkles, label: "9:16 · 1:1" }],
  },
  {
    tab: "Auto publish",
    video: "/assets/mockups/linkedin.mp4",
    title: "Schedule & publish",
    text: "Post to TikTok, YouTube Shorts and Reels on your schedule.",
    chips: [{ icon: CalendarClock, label: "Scheduler" }, { icon: Send, label: "One-click post" }],
  },
];
const SLIDE_MS = 5000;

/** Left panel: a full-bleed clip that rotates through features. */
function ClipShowcase() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setI((n) => (n + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [i]);
  const slide = SLIDES[i];

  return (
    <div className="relative hidden min-h-[40rem] overflow-hidden rounded-2xl bg-black lg:block">
      <video
        key={slide.video}
        src={slide.video}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 via-35% to-transparent to-60%" aria-hidden />

      <div className="absolute inset-x-0 bottom-0 p-6">
        <div className="mb-3 flex flex-wrap gap-2">
          {slide.chips.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          ))}
        </div>
        <h3 className="text-4xl font-black uppercase tracking-tight text-white">{slide.title}</h3>
        <p className="mt-2 text-sm text-white/60">{slide.text}</p>

        <div className="mt-6 grid grid-cols-4 gap-2">
          {SLIDES.map((s, n) => (
            <button key={s.tab} type="button" onClick={() => setI(n)} className="text-left">
              <span className="block h-[3px] overflow-hidden rounded-full bg-white/20">
                <span
                  key={n === i ? `on-${i}` : "off"}
                  className="block h-full bg-white"
                  style={
                    n < i
                      ? { width: "100%" }
                      : n === i
                        ? { animation: `auth-slide ${SLIDE_MS}ms linear forwards` }
                        : { width: 0 }
                  }
                />
              </span>
              <span className={`mt-2 block text-xs ${n === i ? "text-white" : "text-white/40"}`}>{s.tab}</span>
            </button>
          ))}
        </div>
      </div>
      <style>{`@keyframes auth-slide{from{width:0}to{width:100%}}`}</style>
    </div>
  );
}
