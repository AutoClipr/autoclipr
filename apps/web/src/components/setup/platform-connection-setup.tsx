"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, CheckCircle2, Ban, Info, ArrowLeft, ArrowRight } from "lucide-react";
import { usePlatformAvailability } from "@/hooks/use-platform-availability";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, type PlatformConnection } from "@/lib/api";
import { getConnectedPlatforms, setConnectedPlatforms } from "@/lib/platforms-storage";
import { markOnboardingComplete } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type Platform = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  /** Brand glow colour for the icon tile and hover halo. */
  glow: string;
};

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-7 w-7", className)} aria-hidden>
      <path
        fill="#FF0000"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .6 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.3.6 9.3.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8z"
      />
      <path fill="#fff" d="M9.75 15.02l6.5-3.52-6.5-3.52v7.04z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-7 w-7 fill-white", className)} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-7 w-7", className)} aria-hidden>
      <defs>
        <linearGradient id="ig-platform" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-platform)" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-7 w-7 fill-[#1877F2]", className)} aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const platforms: Platform[] = [
  {
    id: "youtube",
    glow: "rgba(239,68,68,0.55)",
    name: "YouTube",
    description: "Post clips as YouTube Shorts",
    icon: <YouTubeIcon />,
    available: true,
  },
  {
    id: "tiktok",
    glow: "rgba(255,255,255,0.35)",
    name: "TikTok",
    description: "Post clips to your TikTok account",
    icon: <TikTokIcon />,
    available: false,
  },
  {
    id: "instagram",
    glow: "rgba(214,41,118,0.55)",
    name: "Instagram",
    description: "Post clips as Instagram Reels",
    icon: <InstagramIcon />,
    available: true,
  },
  {
    id: "facebook",
    glow: "rgba(24,119,242,0.55)",
    name: "Facebook",
    description: "Post clips to your Facebook account",
    icon: <FacebookIcon />,
    available: true,
  },
];

export function PlatformConnectionSetup({ mode = "dashboard" }: { mode?: "trial" | "dashboard" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: regionLoading, banned: bannedPlatforms } = usePlatformAvailability();
  const [connected, setConnected] = useState<string[]>([]);
  const [platformRows, setPlatformRows] = useState<PlatformConnection[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [pendingPlatform, setPendingPlatform] = useState<Platform | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await apiFetch<PlatformConnection[]>("/api/v1/platforms", {
          token: session.access_token,
        });
        if (res.success && res.data) {
          setPlatformRows(res.data);
          setConnected(res.data.map((p) => p.platform));
          setConnectedPlatforms(res.data.map((p) => p.platform));
          return;
        }
      }
      setConnected(getConnectedPlatforms());
    }
    load();
  }, []);

  useEffect(() => {
    async function handleOAuthReturn() {
      const oauthStatus = searchParams.get("status");
      const platform = searchParams.get("platform");
      if (oauthStatus === "success" && platform) {
        const label = platform === "youtube" ? "YouTube Shorts" : platform === "instagram" ? "Instagram Reels" : platform;
        setStatusMessage(`${label} authorized. You can now post clips directly.`);
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await apiFetch<PlatformConnection[]>("/api/v1/platforms", {
            token: session.access_token,
          });
          if (res.success && res.data) {
            setPlatformRows(res.data);
            setConnected(res.data.map((p) => p.platform));
          }
        }
      } else if (oauthStatus === "error") {
        setStatusMessage(
          "Authorization failed. Check your app credentials in .env, then try again.",
        );
      }
    }
    handleOAuthReturn();
  }, [searchParams]);

  function handleConnectClick(platform: Platform) {
    if (!platform.available) return;
    if (connected.includes(platform.id)) {
      disconnect(platform.id);
      return;
    }
    setPendingPlatform(platform);
  }

  async function confirmConnect() {
    if (!pendingPlatform) return;
    setConnecting(pendingPlatform.id);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      const res = await apiFetch<PlatformConnection & { oauth_url?: string | null }>(
        "/api/v1/platforms",
        {
          method: "POST",
          token: session.access_token,
          body: JSON.stringify({ platform: pendingPlatform.id }),
        },
      );

      if (res.success && res.data) {
        setConnected((prev) => [...prev, pendingPlatform.id]);
        setConnectedPlatforms([...connected, pendingPlatform.id]);
        setPlatformRows((prev) => [...prev.filter((p) => p.platform !== pendingPlatform.id), res.data!]);

        if ((pendingPlatform.id === "youtube" || pendingPlatform.id === "instagram") && res.data.oauth_url) {
          window.location.href = res.data.oauth_url;
          return;
        }
      }
    } else {
      setConnected((prev) => {
        const next = [...prev, pendingPlatform.id];
        setConnectedPlatforms(next);
        return next;
      });
    }

    setConnecting(null);
    setPendingPlatform(null);
  }

  async function disconnect(id: string) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      await apiFetch(`/api/v1/platforms/${id}`, {
        method: "DELETE",
        token: session.access_token,
      });
    }

    setConnected((prev) => {
      const next = prev.filter((p) => p !== id);
      setConnectedPlatforms(next);
      return next;
    });
    setPlatformRows((prev) => prev.filter((p) => p.platform !== id));
  }

  async function authorizeInstagram() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await apiFetch<{ url: string }>("/api/v1/platforms/instagram/oauth-url", {
      token: session.access_token,
    });
    if (res.success && res.data?.url) {
      window.location.href = res.data.url;
    }
  }

  async function authorizeYoutube() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await apiFetch<{ url: string }>("/api/v1/platforms/youtube/oauth-url", {
      token: session.access_token,
    });
    if (res.success && res.data?.url) {
      window.location.href = res.data.url;
    }
  }

  function goToDashboard() {
    markOnboardingComplete();
    router.push("/dashboard");
    router.refresh();
  }

  const isTrial = mode === "trial";

  const usable = platforms.filter((p) => p.available && !bannedPlatforms.has(p.id));
  const total = usable.length;
  const connectedCount = usable.filter((p) => connected.includes(p.id)).length;

  return (
    <div className="relative mx-auto max-w-4xl">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[640px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(16,185,129,0.18), rgba(139,92,246,0.08), transparent)" }}
        aria-hidden
      />
      <div className="relative text-center">
        {isTrial && (
          <Badge
            variant="outline"
            className="mb-4 border-violet-400/40 bg-violet-500/10 text-violet-200"
          >
            FREE TRIAL
          </Badge>
        )}
        <p className="section-label-white mx-auto mb-5">Platforms</p>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Connect your{" "}
          <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
            platforms
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-white/55">
          {isTrial
            ? "Link a platform where you want clips posted. YouTube requires one-time Google authorization."
            : "Connect posting destinations (YouTube Shorts, Instagram, Facebook). This is separate from connecting a YouTube source channel for clipping."}
        </p>

        {/* Progress */}
        <div className="mx-auto mt-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur">
          <div className="flex gap-1">
            {usable.map((p) => (
              <span
                key={p.id}
                className={cn(
                  "h-1.5 w-5 rounded-full transition-colors",
                  connected.includes(p.id) ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" : "bg-white/15",
                )}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-white/65">
            {connectedCount} of {total} connected
          </span>
        </div>
      </div>

      {statusMessage && (
        <div className="relative mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.08] px-4 py-3 text-center text-sm text-emerald-200">
          {statusMessage}
        </div>
      )}

      <div className="relative mt-8 flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60 backdrop-blur">
        <Info className="h-4 w-4 shrink-0 text-emerald-300" />
        <span>
          Use <span className="font-semibold text-white">business or creator accounts</span> for the smoothest connection.
        </span>
      </div>

      <div className="relative mt-6 grid gap-4 sm:grid-cols-2">
        {platforms.map((platform) => {
          const isConnected = connected.includes(platform.id);
          const isLoading = connecting === platform.id;
          const banned = bannedPlatforms.has(platform.id);

          return (
            <article
              key={platform.id}
              style={{ ["--glow" as string]: platform.glow }}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-3xl border bg-white/[0.03] p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1",
                isConnected
                  ? "border-emerald-400/40 shadow-[0_0_40px_-16px_rgba(16,185,129,0.8)]"
                  : banned
                    ? "border-white/[0.07] opacity-80"
                    : "border-white/10 hover:border-white/20",
              )}
            >
              {/* Brand halo on hover */}
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
                style={{ background: "var(--glow)" }}
                aria-hidden
              />
              {isConnected && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-400/0 via-emerald-400/80 to-emerald-400/0" />
              )}

              <div className="relative mb-5 flex items-start justify-between">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] transition-transform duration-300 group-hover:scale-105"
                  style={{ boxShadow: "0 0 30px -10px var(--glow)" }}
                >
                  {platform.icon}
                </span>
                {isConnected ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected
                  </span>
                ) : (
                  !banned && platform.available && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/45">
                      Not connected
                    </span>
                  )
                )}
              </div>
              <h2 className="relative text-xl font-bold text-white">{platform.name}</h2>
              <p className="relative mt-1.5 flex-1 text-sm text-white/50">
                {platform.description}
              </p>
              {isConnected && platform.id === "youtube" && !platformRows.find((p) => p.platform === "youtube")?.can_post && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="relative mt-4 w-full"
                  onClick={authorizeYoutube}
                >
                  Authorize YouTube posting
                </Button>
              )}
              {isConnected && platform.id === "instagram" && !platformRows.find((p) => p.platform === "instagram")?.can_post && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="relative mt-4 w-full"
                  onClick={authorizeInstagram}
                >
                  Authorize Instagram posting
                </Button>
              )}
              {banned ? (
                <div className="relative mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/[0.08] text-sm font-medium text-rose-300">
                  <Ban className="h-4 w-4" />
                  Unavailable in your region
                </div>
              ) : (
                <Button
                  className={cn(
                    "relative mt-6 h-11 w-full rounded-full font-semibold",
                    isConnected && "hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200",
                    !platform.available &&
                      "cursor-not-allowed border border-white/10 bg-white/[0.04] text-white/40 opacity-70 hover:opacity-70",
                  )}
                  variant={isConnected ? "outline" : platform.available ? "gradient" : "secondary"}
                  disabled={!platform.available || isLoading || regionLoading}
                  onClick={() => handleConnectClick(platform)}
                >
                  {isLoading ? (
                    "Connecting…"
                  ) : !platform.available ? (
                    "Coming Soon"
                  ) : isConnected ? (
                    "Disconnect"
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      Connect
                    </>
                  )}
                </Button>
              )}
            </article>
          );
        })}
      </div>

      {connected.length === 0 ? (
        <p className="relative mt-10 text-center text-sm text-white/50">
          Connect at least one platform to continue.
        </p>
      ) : (
        <p className="relative mt-10 text-center text-sm text-white/60">
          <span className="font-semibold text-emerald-300">
            {connected.length} platform{connected.length !== 1 ? "s" : ""} connected
          </span>{" "}
          — use the <span className="font-semibold text-white">Post</span> button on each clip when ready.
        </p>
      )}

      <div className="relative mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {!isTrial && (
          <Button variant="outline" asChild>
            <Link href="/channels"><ArrowLeft className="h-4 w-4" /> Channel setup</Link>
          </Button>
        )}
        {isTrial && (
          <Button variant="outline" asChild>
            <Link href="/pricing">View plans</Link>
          </Button>
        )}
        <Button variant="gradient" onClick={goToDashboard}>
          {connected.length > 0
            ? "Continue to dashboard"
            : isTrial
              ? "Skip to dashboard"
              : "Go to dashboard"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* OAuth confirm modal */}
      {pendingPlatform && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-7 shadow-2xl"
            style={{ ["--glow" as string]: pendingPlatform.glow }}
          >
            <div className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-50 blur-3xl" style={{ background: "var(--glow)" }} aria-hidden />
            <div className="relative mb-5 flex justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]" style={{ boxShadow: "0 0 36px -10px var(--glow)" }}>
                {pendingPlatform.icon}
              </span>
            </div>
            <h3 className="relative text-center text-xl font-bold text-white">
              Connect {pendingPlatform.name}
            </h3>
            <p className="relative mt-3 text-center text-sm leading-relaxed text-white/55">
              You&apos;ll be redirected to {pendingPlatform.name} to authorize AutoClipr
              to post clips on your behalf. Use a business/creator account for best
              results.
            </p>
            <div className="relative mt-7 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPendingPlatform(null)}
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={confirmConnect}
              >
                Authorize
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
