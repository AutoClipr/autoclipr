"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
  X,
} from "lucide-react";
import { usePlatformAvailability } from "@/hooks/use-platform-availability";
import { Button } from "@/components/ui/button";
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
  /** Brand tint for the icon tile. */
  tint: string;
  /** Platforms with a real OAuth posting flow (others just record the connection). */
  oauth: boolean;
};

type CardState = "loading" | "connected" | "reconnect" | "not_connected" | "connecting" | "failed" | "unavailable" | "coming_soon";

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-6 w-6", className)} aria-hidden>
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
    <svg viewBox="0 0 24 24" className={cn("h-6 w-6 fill-white", className)} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-6 w-6", className)} aria-hidden>
      <defs>
        <linearGradient id="ig-platform" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-platform)" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="#fff" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-6 w-6 fill-[#1877F2]", className)} aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5 fill-white", className)} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-6 w-6", className)} aria-hidden>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.1 9.5H4.6V19h2.5V9.5zM5.85 5a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9zM19.4 13.7c0-2.6-1.4-4.4-3.8-4.4-1.2 0-2.1.6-2.5 1.3V9.5h-2.4V19h2.5v-5c0-1.3.6-2.2 1.7-2.2s1.6.8 1.6 2.2v5h2.5v-5.3z"
      />
    </svg>
  );
}

const platforms: Platform[] = [
  {
    id: "youtube",
    tint: "rgba(255,0,0,0.10)",
    name: "YouTube",
    description: "Publish directly to YouTube Shorts",
    icon: <YouTubeIcon />,
    available: true,
    oauth: true,
  },
  {
    id: "instagram",
    tint: "rgba(214,41,118,0.10)",
    name: "Instagram",
    description: "Publish directly to Instagram Reels",
    icon: <InstagramIcon />,
    available: true,
    oauth: true,
  },
  {
    id: "facebook",
    tint: "rgba(24,119,242,0.10)",
    name: "Facebook",
    description: "Publish directly to Facebook Reels",
    icon: <FacebookIcon />,
    available: true,
    oauth: false,
  },
  {
    id: "tiktok",
    tint: "rgba(255,255,255,0.06)",
    name: "TikTok",
    description: "Publish short-form videos to TikTok",
    icon: <TikTokIcon />,
    available: false,
    oauth: false,
  },
  {
    id: "twitter",
    tint: "rgba(255,255,255,0.06)",
    name: "X (Twitter)",
    description: "Publish clips to your X timeline",
    icon: <XIcon />,
    available: false,
    oauth: false,
  },
  {
    id: "linkedin",
    tint: "rgba(10,102,194,0.12)",
    name: "LinkedIn",
    description: "Publish clips to your LinkedIn profile",
    icon: <LinkedInIcon />,
    available: false,
    oauth: false,
  },
];

async function accessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** Where the OAuth round-trip should land when it started from the Social accounts page. */
const OAUTH_RETURN_KEY = "autoclipr_oauth_return";

export function PlatformConnectionSetup({
  mode = "dashboard",
  embedded = false,
}: {
  mode?: "trial" | "dashboard";
  /** Inside the dashboard (Social accounts page): no onboarding footer. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: regionLoading, banned: bannedPlatforms } = usePlatformAvailability();
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState<string[]>([]);
  const [platformRows, setPlatformRows] = useState<PlatformConnection[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pendingPlatform, setPendingPlatform] = useState<Platform | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Platform | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const token = await accessToken();
    if (token) {
      const res = await apiFetch<PlatformConnection[]>("/api/v1/platforms", { token });
      if (res.success && res.data) {
        setPlatformRows(res.data);
        setConnected(res.data.map((p) => p.platform));
        setConnectedPlatforms(res.data.map((p) => p.platform));
        setLoaded(true);
        return;
      }
    }
    setConnected(getConnectedPlatforms());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Returning from an OAuth redirect.
  useEffect(() => {
    if (!embedded && searchParams.get("from") === "oauth") {
      let back: string | null = null;
      try {
        back = sessionStorage.getItem(OAUTH_RETURN_KEY);
        sessionStorage.removeItem(OAUTH_RETURN_KEY);
      } catch {}
      if (back) {
        router.replace(`${back}?${searchParams.toString()}`);
        return;
      }
    }
    const oauthStatus = searchParams.get("status");
    const platform = searchParams.get("platform");
    const name = platforms.find((p) => p.id === platform)?.name ?? "The platform";
    if (oauthStatus === "success" && platform) {
      setNotice({ tone: "success", text: `${name} is connected. You can now publish clips directly.` });
      refresh();
    } else if (oauthStatus === "error") {
      if (platform) setFailed(platform);
      setNotice({
        tone: "error",
        text: `${name} authorization didn't complete. Please try again — use a business or creator account if it keeps failing.`,
      });
    }
  }, [searchParams, refresh, embedded, router]);

  async function confirmConnect() {
    if (!pendingPlatform) return;
    const target = pendingPlatform;
    setConnecting(target.id);
    setFailed(null);
    setNotice(null);

    const token = await accessToken();
    if (token) {
      const res = await apiFetch<PlatformConnection & { oauth_url?: string | null }>("/api/v1/platforms", {
        method: "POST",
        token,
        body: JSON.stringify({ platform: target.id }),
      });

      if (res.success && res.data) {
        setConnected((prev) => [...prev.filter((p) => p !== target.id), target.id]);
        setConnectedPlatforms([...connected.filter((p) => p !== target.id), target.id]);
        setPlatformRows((prev) => [...prev.filter((p) => p.platform !== target.id), res.data!]);

        if ((target.id === "youtube" || target.id === "instagram") && res.data.oauth_url) {
          try {
            if (embedded) sessionStorage.setItem(OAUTH_RETURN_KEY, "/social-accounts");
            else sessionStorage.removeItem(OAUTH_RETURN_KEY);
          } catch {}
          window.location.href = res.data.oauth_url;
          return;
        }
        setNotice({ tone: "success", text: `${target.name} is connected.` });
      } else {
        setFailed(target.id);
        setNotice({ tone: "error", text: res.error?.message ?? `Couldn't connect ${target.name}. Please try again.` });
      }
    } else {
      setConnected((prev) => {
        const next = [...prev, target.id];
        setConnectedPlatforms(next);
        return next;
      });
    }

    setConnecting(null);
    setPendingPlatform(null);
  }

  async function confirmDisconnect() {
    if (!disconnectTarget) return;
    const id = disconnectTarget.id;
    setDisconnecting(true);
    const token = await accessToken();
    if (token) {
      await apiFetch(`/api/v1/platforms/${id}`, { method: "DELETE", token });
    }
    setConnected((prev) => {
      const next = prev.filter((p) => p !== id);
      setConnectedPlatforms(next);
      return next;
    });
    setPlatformRows((prev) => prev.filter((p) => p.platform !== id));
    setNotice({ tone: "success", text: `${disconnectTarget.name} disconnected.` });
    setDisconnecting(false);
    setDisconnectTarget(null);
  }

  /** Re-run OAuth for a connection that exists but can't post (missing or expired tokens). */
  async function reauthorize(id: string) {
    const token = await accessToken();
    if (!token) return;
    setConnecting(id);
    const res = await apiFetch<{ url: string }>(`/api/v1/platforms/${id}/oauth-url`, { token });
    if (res.success && res.data?.url) {
      window.location.href = res.data.url;
      return;
    }
    setConnecting(null);
    setFailed(id);
    setNotice({ tone: "error", text: "Couldn't start authorization. Please try again." });
  }

  function goToDashboard() {
    markOnboardingComplete();
    router.push("/dashboard");
    router.refresh();
  }

  function stateFor(p: Platform): CardState {
    if (bannedPlatforms.has(p.id)) return "unavailable";
    if (!p.available) return "coming_soon";
    if (connecting === p.id) return "connecting";
    if (connected.includes(p.id)) {
      const row = platformRows.find((r) => r.platform === p.id);
      // Only OAuth platforms can be in a needs-authorization state.
      if (p.oauth && row && !row.can_post) return "reconnect";
      return "connected";
    }
    if (failed === p.id) return "failed";
    return "not_connected";
  }

  const isTrial = mode === "trial";
  // Regionally unavailable / not-yet-launched platforms don't count against progress.
  const usable = platforms.filter((p) => p.available && !bannedPlatforms.has(p.id));
  const states = usable.map((p) => stateFor(p));
  const connectedCount = states.filter((s) => s === "connected" || s === "reconnect").length;
  const healthyCount = states.filter((s) => s === "connected").length;
  const needsAttention = states.filter((s) => s === "reconnect" || s === "failed").length;
  const total = usable.length;
  const percent = total ? Math.round((connectedCount / total) * 100) : 0;

  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[720px] max-w-full -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(84,208,69,0.16), rgba(53,214,232,0.06), transparent)" }}
        aria-hidden
      />

      {/* Hero */}
      <header className="relative text-center">
        {isTrial && (
          <span className="mb-4 inline-flex rounded-full border border-[#54D045]/30 bg-[#54D045]/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-[#8fe383]">
            FREE TRIAL
          </span>
        )}
        <p className="mx-auto mb-5 w-fit rounded-full border border-[#253244] bg-[#0B1220] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#94A3B8]">
          SOCIAL INTEGRATIONS
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-[#F8FAFC] sm:text-5xl">
          Your social{" "}
          <span className="bg-gradient-to-r from-[#54D045] to-[#35D6E8] bg-clip-text text-transparent">ecosystem.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] text-[#94A3B8]">
          Connect your channels. Publish your clips. Grow everywhere.
        </p>
        <div className="mx-auto mt-6 inline-flex items-center gap-2.5 rounded-full border border-[#253244] bg-[#0B1220]/80 px-4 py-2 text-sm">
          <span className="relative flex h-2 w-2">
            {connectedCount > 0 && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#54D045] opacity-60" />
            )}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", connectedCount > 0 ? "bg-[#54D045]" : "bg-[#94A3B8]/50")} />
          </span>
          <span className="font-medium text-[#F8FAFC]">
            {loaded ? `${connectedCount} platform${connectedCount === 1 ? "" : "s"} connected` : "Checking connections…"}
          </span>
        </div>
        {!isTrial && (
          <p className="mx-auto mt-4 max-w-lg text-xs text-[#94A3B8]/70">
            These are publishing destinations. Connecting a YouTube source channel for clipping is a separate step under Channel setup.
          </p>
        )}
      </header>

      {/* Feedback */}
      {notice && (
        <div
          role="status"
          className={cn(
            "relative mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
            notice.tone === "success"
              ? "border-[#54D045]/30 bg-[#54D045]/[0.07] text-[#bff0b8]"
              : "border-rose-400/30 bg-rose-500/[0.07] text-rose-200",
          )}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative mt-10 grid gap-5 lg:grid-cols-[1fr_280px] lg:items-start">
        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              state={loaded || !platform.available ? stateFor(platform) : "loading"}
              accountName={platformRows.find((r) => r.platform === platform.id)?.account_name ?? null}
              disabled={regionLoading || !loaded || (connecting !== null && connecting !== platform.id)}
              onConnect={() => {
                setFailed(null);
                setPendingPlatform(platform);
              }}
              onDisconnect={() => setDisconnectTarget(platform)}
              onReconnect={() => reauthorize(platform.id)}
            />
          ))}
        </div>

        {/* Overview */}
        <aside className="rounded-[20px] border border-[#253244] bg-[#101824] p-5">
          <h2 className="text-sm font-semibold text-[#F8FAFC]">Connection overview</h2>

          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tabular-nums text-[#F8FAFC]">{percent}%</span>
              <span className="text-xs text-[#94A3B8]">complete</span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-[#0B1220]"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Connection progress"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#54D045] to-[#35D6E8] transition-[width] duration-700 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <OverviewRow label="Connected" value={`${connectedCount} of ${total}`} />
            <OverviewRow label="Available platforms" value={String(total)} />
            <OverviewRow
              label="Connection health"
              value={
                connectedCount === 0 ? (
                  <span className="text-[#94A3B8]">–</span>
                ) : needsAttention > 0 ? (
                  <span className="text-amber-300">{needsAttention} need attention</span>
                ) : (
                  <span className="text-[#54D045]">{healthyCount === connectedCount ? "Healthy" : "OK"}</span>
                )
              }
            />
          </dl>

          <div className="mt-6 flex items-start gap-2 rounded-xl border border-[#253244] bg-[#0B1220] p-3 text-xs leading-relaxed text-[#94A3B8]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#35D6E8]" />
            <span>
              Use <span className="font-medium text-[#F8FAFC]">business or creator accounts</span> for the smoothest connection.
            </span>
          </div>
        </aside>
      </div>

      {/* Footer actions */}
      {!embedded && (<>
      <div className="relative mt-10 flex flex-col-reverse items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {isTrial ? (
          <Button variant="outline" asChild className="h-11 rounded-full border-[#253244] px-5">
            <Link href="/pricing">View plans</Link>
          </Button>
        ) : (
          <Button variant="outline" asChild className="h-11 rounded-full border-[#253244] px-5">
            <Link href="/channels">
              <ArrowLeft className="h-4 w-4" /> Back to Channel setup
            </Link>
          </Button>
        )}
        <Button
          onClick={goToDashboard}
          className="h-11 rounded-full bg-[#54D045] px-6 font-semibold text-[#070B12] shadow-[0_0_30px_-8px_rgba(84,208,69,0.7)] hover:bg-[#62dc53]"
        >
          {connected.length > 0 ? "Continue to dashboard" : isTrial ? "Skip to dashboard" : "Go to dashboard"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      {connected.length > 0 && (
        <p className="relative mt-4 text-center text-xs text-[#94A3B8]">
          Use the <span className="font-medium text-[#F8FAFC]">Post</span> button on any clip to publish it.
        </p>
      )}
      </>)}

      {/* Connect dialog */}
      {pendingPlatform && (
        <Dialog onClose={() => !connecting && setPendingPlatform(null)} labelledBy="connect-title">
          <div className="mb-5 flex justify-center">
            <IconTile platform={pendingPlatform} large />
          </div>
          <h3 id="connect-title" className="text-center text-xl font-bold text-[#F8FAFC]">
            Connect {pendingPlatform.name}
          </h3>
          <p className="mt-3 text-center text-sm leading-relaxed text-[#94A3B8]">
            {pendingPlatform.oauth
              ? `You'll be redirected to ${pendingPlatform.name} to authorize AutoClipr to publish clips on your behalf.`
              : `AutoClipr will add ${pendingPlatform.name} as a publishing destination for your clips.`}{" "}
            A business or creator account works best.
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#94A3B8]/80">
            <ShieldCheck className="h-3.5 w-3.5 text-[#54D045]" />
            We only publish what you choose to post.
          </div>
          <div className="mt-7 flex gap-3">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-full border-[#253244]"
              disabled={!!connecting}
              onClick={() => setPendingPlatform(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-11 flex-1 rounded-full bg-[#54D045] font-semibold text-[#070B12] hover:bg-[#62dc53]"
              disabled={!!connecting}
              onClick={confirmConnect}
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
                </>
              ) : pendingPlatform.oauth ? (
                "Authorize"
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        </Dialog>
      )}

      {/* Disconnect dialog */}
      {disconnectTarget && (
        <Dialog onClose={() => !disconnecting && setDisconnectTarget(null)} labelledBy="disconnect-title">
          <div className="mb-5 flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/10">
              <Unplug className="h-6 w-6 text-rose-300" />
            </span>
          </div>
          <h3 id="disconnect-title" className="text-center text-xl font-bold text-[#F8FAFC]">
            Disconnect {disconnectTarget.name}?
          </h3>
          <p className="mt-3 text-center text-sm leading-relaxed text-[#94A3B8]">
            AutoClipr won&apos;t be able to publish clips to {disconnectTarget.name} until you connect it again.
          </p>
          <div className="mt-7 flex gap-3">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-full border-[#253244]"
              disabled={disconnecting}
              onClick={() => setDisconnectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-11 flex-1 rounded-full bg-rose-500 font-semibold text-white hover:bg-rose-500/90"
              disabled={disconnecting}
              onClick={confirmDisconnect}
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#94A3B8]">{label}</dt>
      <dd className="font-medium text-[#F8FAFC]">{value}</dd>
    </div>
  );
}

function IconTile({ platform, large }: { platform: Platform; large?: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-2xl border border-[#253244] transition-transform duration-300 group-hover:scale-105",
        large ? "h-16 w-16" : "h-12 w-12",
      )}
      style={{ background: `linear-gradient(145deg, ${platform.tint}, rgba(11,18,32,0.9))` }}
    >
      {platform.icon}
    </span>
  );
}

const BADGES: Record<CardState, { label: string; className: string; icon?: React.ReactNode }> = {
  connected: {
    label: "Connected",
    className: "border-[#54D045]/35 bg-[#54D045]/10 text-[#8fe383]",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  reconnect: {
    label: "Reconnect required",
    className: "border-amber-400/35 bg-amber-400/10 text-amber-200",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  loading: { label: "Checking", className: "border-[#253244] bg-[#0B1220] text-[#94A3B8]" },
  not_connected: { label: "Not connected", className: "border-[#253244] bg-[#0B1220] text-[#94A3B8]" },
  connecting: {
    label: "Connecting",
    className: "border-[#35D6E8]/30 bg-[#35D6E8]/10 text-[#9beef7]",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  failed: {
    label: "Connection failed",
    className: "border-rose-400/35 bg-rose-500/10 text-rose-200",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  unavailable: {
    label: "Unavailable",
    className: "border-[#253244] bg-[#0B1220] text-[#94A3B8]",
    icon: <Ban className="h-3.5 w-3.5" />,
  },
  coming_soon: { label: "Coming soon", className: "border-[#253244] bg-[#0B1220] text-[#94A3B8]" },
};

function PlatformCard({
  platform,
  state,
  accountName,
  disabled,
  onConnect,
  onDisconnect,
  onReconnect,
}: {
  platform: Platform;
  state: CardState;
  accountName: string | null;
  disabled: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const badge = BADGES[state];
  const live = state === "connected" || state === "reconnect";
  const inactive = state === "unavailable" || state === "coming_soon";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[20px] border bg-[#101824] p-5 transition-all duration-300",
        state === "connected" &&
          "border-[#54D045]/35 shadow-[0_0_0_1px_rgba(84,208,69,0.06),0_12px_40px_-20px_rgba(84,208,69,0.55)]",
        state === "reconnect" && "border-amber-400/30",
        state === "failed" && "border-rose-400/30",
        !live && state !== "failed" && "border-[#253244]",
        !inactive && "hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)]",
        !inactive && !live && state !== "failed" && "hover:border-[#35445a]",
        inactive && "opacity-75",
      )}
    >
      {state === "connected" && (
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#54D045]/70 to-transparent" />
      )}

      <div className="flex items-start justify-between gap-3">
        <IconTile platform={platform} />
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            badge.className,
          )}
        >
          {badge.icon}
          {badge.label}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold text-[#F8FAFC]">{platform.name}</h3>
      <p className="mt-1 text-sm text-[#94A3B8]">{platform.description}</p>

      <div className="mt-4 min-h-[36px] flex-1">
        {live && accountName && (
          <div className="flex items-center gap-2 rounded-lg border border-[#253244] bg-[#0B1220] px-3 py-2 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#54D045]" />
            <span className="truncate text-[#F8FAFC]">{accountName}</span>
          </div>
        )}
        {state === "reconnect" && (
          <p className="mt-2 text-xs text-amber-200/80">Authorization is missing or expired. Reconnect to keep publishing.</p>
        )}
        {state === "unavailable" && (
          <p className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
            {platform.name} isn&apos;t available in your region
            <span className="group/tip relative inline-flex">
              <Info className="h-3.5 w-3.5 cursor-help text-[#94A3B8]" tabIndex={0} aria-describedby={`${platform.id}-tip`} />
              <span
                id={`${platform.id}-tip`}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg border border-[#253244] bg-[#0B1220] px-3 py-2 text-[11px] leading-relaxed text-[#cbd5e1] opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
              >
                {platform.name} is restricted in your country, so publishing to it can&apos;t be enabled. Your other platforms work as usual.
              </span>
            </span>
          </p>
        )}
      </div>

      <div className="mt-4">
        {state === "connected" && (
          <Button
            variant="outline"
            onClick={onDisconnect}
            disabled={disabled}
            className="h-10 w-full rounded-full border-[#253244] bg-transparent text-[#cbd5e1] hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
          >
            Disconnect
          </Button>
        )}
        {state === "reconnect" && (
          <div className="flex gap-2">
            <Button
              onClick={onReconnect}
              disabled={disabled}
              className="h-10 flex-1 rounded-full bg-amber-400 font-semibold text-[#070B12] hover:bg-amber-300"
            >
              <RefreshCw className="h-4 w-4" /> Reconnect
            </Button>
            <Button
              variant="outline"
              onClick={onDisconnect}
              disabled={disabled}
              aria-label={`Disconnect ${platform.name}`}
              className="h-10 rounded-full border-[#253244] px-3 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <Unplug className="h-4 w-4" />
            </Button>
          </div>
        )}
        {(state === "not_connected" || state === "failed") && (
          <Button
            onClick={onConnect}
            disabled={disabled}
            className="h-10 w-full rounded-full bg-[#F8FAFC] font-semibold text-[#070B12] hover:bg-white"
          >
            {state === "failed" ? <RefreshCw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {state === "failed" ? "Try again" : "Connect"}
          </Button>
        )}
        {state === "loading" && <div className="h-10 w-full animate-pulse rounded-full bg-[#0B1220]" />}
        {state === "connecting" && (
          <Button disabled className="h-10 w-full rounded-full border border-[#253244] bg-[#0B1220] text-[#94A3B8]">
            <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
          </Button>
        )}
        {inactive && (
          <Button disabled className="h-10 w-full cursor-not-allowed rounded-full border border-[#253244] bg-[#0B1220] text-[#94A3B8]">
            {state === "unavailable" ? (
              <>
                <Ban className="h-4 w-4" /> Unavailable in your region
              </>
            ) : (
              "Coming soon"
            )}
          </Button>
        )}
      </div>
    </article>
  );
}

function Dialog({
  children,
  onClose,
  labelledBy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070B12]/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-[20px] border border-[#253244] bg-[#101824] p-7 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        {children}
      </div>
    </div>
  );
}
