"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2, Youtube, CheckCircle2, ArrowLeft, Radar, Scissors, Link2 } from "lucide-react";
import { getAccessToken } from "@/lib/auth-token";
import { apiFetch, type YoutubeChannel } from "@/lib/api";
import { notifyChannelsUpdated } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ConnectedChannelRow,
  ConnectedChannelsHeading,
} from "@/components/dashboard/connected-channel-row";

type ResolvedChannel = {
  channel_url: string;
  channel_name: string;
  thumbnail_url?: string;
};

type Phase = "idle" | "resolving" | "connecting";

export function AddChannelSetup({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    const res = await apiFetch<YoutubeChannel[]>("/api/v1/channels", { token });
    if (res.success && res.data) setChannels(res.data);
    setLoadingList(false);
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  async function connectChannel() {
    const trimmed = query.trim();
    if (!trimmed) return;

    setError(null);
    setSuccess(null);
    setPhase("resolving");

    const token = await getAccessToken();
    if (!token) {
      setPhase("idle");
      router.push("/login?redirect=/channels");
      return;
    }

    const resolveRes = await apiFetch<ResolvedChannel>(
      `/api/v1/channels/resolve?q=${encodeURIComponent(trimmed)}`,
      { token }
    );

    if (!resolveRes.success || !resolveRes.data) {
      setError(resolveRes.error?.message ?? "Could not find that YouTube channel.");
      setPhase("idle");
      return;
    }

    setPhase("connecting");

    const connectRes = await apiFetch<YoutubeChannel>("/api/v1/channels", {
      method: "POST",
      token,
      body: JSON.stringify({
        channel_url: resolveRes.data.channel_url,
        channel_name: resolveRes.data.channel_name,
        thumbnail_url: resolveRes.data.thumbnail_url,
        is_trial_channel: false,
      }),
    });

    if (!connectRes.success) {
      setError(connectRes.error?.message ?? "Failed to connect channel");
      setPhase("idle");
      return;
    }

    setQuery("");
    setSuccess(
      `${resolveRes.data.channel_name} saved as a clip source. Use Create Viral Shorts with a video URL for now — automatic monitoring is coming soon.`,
    );
    await loadChannels();
    notifyChannelsUpdated();
    router.refresh();
    setPhase("idle");

    setTimeout(() => setSuccess(null), 6000);
  }

  async function disconnect(id: string) {
    setRemovingId(id);
    const token = await getAccessToken();
    if (!token) return;

    await apiFetch(`/api/v1/channels/${id}`, { method: "DELETE", token });
    await loadChannels();
    notifyChannelsUpdated();
    router.refresh();
    setRemovingId(null);
  }

  const busy = phase !== "idle";

  return (
    <div className="relative mx-auto max-w-3xl">
      {/* Ambient glow behind header */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[640px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(239,68,68,0.16), rgba(16,185,129,0.08), transparent)" }}
        aria-hidden
      />

      <div className="relative text-center">
        <p className="section-label-white mx-auto mb-5">Source channels</p>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Add channels to{" "}
          <span className="bg-gradient-to-r from-red-300 via-rose-300 to-orange-200 bg-clip-text text-transparent">
            clip from
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-white/55">
          Save the YouTube channels you clip from. This is separate from posting platforms — connect
          those under Settings → Platforms, then use the Post button on each clip.
        </p>

        {/* How it works */}
        <div className="mx-auto mt-7 grid max-w-2xl gap-2.5 text-left sm:grid-cols-3">
          {[
            { icon: Link2, t: "Paste a channel", d: "Name, @handle or URL" },
            { icon: Radar, t: "We track uploads", d: "New videos are spotted" },
            { icon: Scissors, t: "Clips get made", d: "Ready in your library" },
          ].map(({ icon: Icon, t, d }, i) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 backdrop-blur">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                <Icon className="h-4 w-4 text-emerald-300" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-black">
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{t}</p>
                <p className="text-xs text-white/45">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add channel card */}
      <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-red-500/15 blur-3xl" aria-hidden />
        <div className="relative mb-5 flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]"
            style={{ boxShadow: "0 0 30px -10px rgba(239,68,68,0.7)" }}
          >
            <Youtube className="h-6 w-6 text-red-500" />
          </span>
          <div>
            <p className="text-lg font-bold text-white">Add a YouTube channel</p>
            <p className="text-xs text-white/45">Type a channel name, @handle or paste its URL</p>
          </div>
        </div>

        {/* Pill input with inline action */}
        <label htmlFor="channel-url" className="sr-only">YouTube channel</label>
        <div className="relative flex items-center gap-2 rounded-full border border-white/10 bg-black/30 p-1.5 pl-4 transition-all focus-within:border-emerald-400/50 focus-within:shadow-[0_0_30px_-8px_rgba(16,185,129,0.6)]">
          {phase === "resolving" ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-300" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-white/40" />
          )}
          <input
            id="channel-url"
            value={query}
            disabled={busy}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            placeholder="e.g. AdamLZ or @AdamLZ"
            className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-[15px] text-white placeholder:text-white/35 outline-none ring-0 focus:outline-none focus:ring-0"
            onKeyDown={(e) => e.key === "Enter" && !busy && connectChannel()}
          />
          <Button
            variant="gradient"
            className="h-11 shrink-0 px-5"
            disabled={busy || !query.trim()}
            onClick={connectChannel}
          >
            {phase === "resolving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Fetching…</span>
              </>
            ) : phase === "connecting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Connecting…</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Connect channel</span>
                <span className="sm:hidden">Add</span>
              </>
            )}
          </Button>
        </div>

        {/* Quick-try suggestions */}
        {!query && phase === "idle" && (
          <div className="relative mt-3 flex flex-wrap items-center gap-1.5 pl-1">
            <span className="text-[11px] text-white/40">Try:</span>
            {["@MrBeast", "@mkbhd", "@AliAbdaal"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/60 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {success && (
          <div className="relative mt-4 flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {error && (
          <p className="relative mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}
      </div>

      {/* Connected channels card */}
      <div className="relative mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur sm:p-8">
        {loadingList ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-6 text-center">
            <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/10 [animation-duration:2.5s]" />
              <span className="absolute inset-1.5 rounded-full bg-red-500/10" />
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/30">
                <Youtube className="h-5 w-5 text-red-400" />
              </span>
            </div>
            <p className="font-semibold text-white">No channels connected yet</p>
            <p className="mt-2 max-w-sm text-sm text-white/50">
              Connect your first YouTube channel to start automatically creating
              clips from new videos.
            </p>
          </div>
        ) : (
          <div>
            <ConnectedChannelsHeading count={channels.length} />
            <div className="space-y-3">
              {channels.map((ch) => (
                <ConnectedChannelRow
                  key={ch.id}
                  channel={ch}
                  onRemove={disconnect}
                  removing={removingId === ch.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {!embedded && (
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="outline" asChild>
            <Link href="/"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
          </Button>
          <Button variant="gradient" asChild>
            <Link href="/login?redirect=/channels">Sign in to manage channels</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
