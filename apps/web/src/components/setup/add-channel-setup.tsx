"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
  Youtube,
} from "lucide-react";
import { getAccessToken } from "@/lib/auth-token";
import { apiFetch, type YoutubeChannel } from "@/lib/api";
import { cn, formatConnectedDate, notifyChannelsUpdated } from "@/lib/utils";

type ResolvedChannel = {
  channel_url: string;
  channel_name: string;
  thumbnail_url?: string;
};

type Phase = "idle" | "resolving" | "preview" | "connecting";
type Sort = "recent" | "oldest" | "name";

const SUGGESTIONS = ["@MrBeast", "@mkbhd", "@AliAbdaal"];

/** "@handle" from a YouTube channel URL, when the URL has one. */
function handleOf(url: string): string | null {
  const m = url.match(/youtube\.com\/(@[\w.-]+)/i);
  return m ? m[1] : null;
}

/** Normalise for duplicate checks: lowercase, no protocol/www, no trailing slash. */
function normUrl(url: string) {
  return url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

/** Turn backend/network errors into short, actionable messages. */
function friendly(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (/rate|too many|429/i.test(message)) return "Too many lookups right now. Wait a moment and try again.";
  if (/network|fetch|ECONN|timeout/i.test(message)) return "We couldn't reach the server. Check your connection and try again.";
  return message;
}

export function AddChannelSetup({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<ResolvedChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removing, setRemoving] = useState<YoutubeChannel | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const loadChannels = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await apiFetch<YoutubeChannel[]>("/api/v1/channels", { token });
    if (res.success && res.data) {
      setChannels(res.data);
      setListError(false);
    } else {
      setListError(true);
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  /** Step 1: look the channel up and show a preview — nothing is saved yet. */
  async function findChannel() {
    const trimmed = query.trim();
    if (!trimmed || phase !== "idle") return;
    setError(null);
    setSuccess(null);
    setPreview(null);
    setPhase("resolving");

    const token = await getAccessToken();
    if (!token) {
      setPhase("idle");
      router.push("/login?redirect=/channels");
      return;
    }

    const res = await apiFetch<ResolvedChannel>(`/api/v1/channels/resolve?q=${encodeURIComponent(trimmed)}`, { token });
    if (!res.success || !res.data) {
      setError(friendly(res.error?.message, "We couldn't find that YouTube channel. Check the name, @handle or URL."));
      setPhase("idle");
      return;
    }
    setPreview(res.data);
    setPhase("preview");
  }

  /** Step 2: save the previewed channel. */
  async function confirmConnect() {
    if (!preview || phase !== "preview") return;
    if (channels.some((c) => normUrl(c.channel_url) === normUrl(preview.channel_url))) {
      setError(`${preview.channel_name} is already in your sources.`);
      return;
    }
    setPhase("connecting");
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setPhase("preview");
      return;
    }
    const res = await apiFetch<YoutubeChannel>("/api/v1/channels", {
      method: "POST",
      token,
      body: JSON.stringify({
        channel_url: preview.channel_url,
        channel_name: preview.channel_name,
        thumbnail_url: preview.thumbnail_url,
        is_trial_channel: false,
      }),
    });
    if (!res.success) {
      setError(friendly(res.error?.message, "We couldn't save that channel. Please try again."));
      setPhase("preview");
      return;
    }
    setSuccess(`${preview.channel_name} added to your sources.`);
    setQuery("");
    setPreview(null);
    setPhase("idle");
    await loadChannels();
    notifyChannelsUpdated();
    router.refresh();
    setTimeout(() => setSuccess(null), 6000);
  }

  function cancelPreview() {
    setPreview(null);
    setPhase("idle");
    setError(null);
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    const token = await getAccessToken();
    if (!token) return;
    const res = await apiFetch(`/api/v1/channels/${removing.id}`, { method: "DELETE", token });
    setRemoveBusy(false);
    if (!res.success) {
      setError(friendly(res.error?.message, "We couldn't remove that channel. Please try again."));
      setRemoving(null);
      return;
    }
    setSuccess(`${removing.channel_name} removed from your sources.`);
    setRemoving(null);
    await loadChannels();
    notifyChannelsUpdated();
    router.refresh();
    setTimeout(() => setSuccess(null), 5000);
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = channels.filter(
      (c) => !q || c.channel_name.toLowerCase().includes(q) || c.channel_url.toLowerCase().includes(q),
    );
    return [...list].sort((a, b) =>
      sort === "name"
        ? a.channel_name.localeCompare(b.channel_name)
        : sort === "oldest"
          ? a.created_at.localeCompare(b.created_at)
          : b.created_at.localeCompare(a.created_at),
    );
  }, [channels, filter, sort]);

  const alreadyAdded = preview ? channels.some((c) => normUrl(c.channel_url) === normUrl(preview.channel_url)) : false;
  const busy = phase === "resolving" || phase === "connecting";

  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">SOURCE CHANNELS</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[#F8FAFC]">Manage your content sources.</h1>
          <p className="mt-1 max-w-xl text-sm text-[#94A3B8]">
            Connect your YouTube channels and turn their videos into engaging AI-generated shorts.
          </p>
        </div>
        {!loadingList && !listError && (
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-[#253244] bg-[#101824] px-4 py-2.5">
            <Youtube className="h-5 w-5 text-[#FF0000]" />
            <div>
              <p className="text-lg font-semibold leading-none tabular-nums text-[#F8FAFC]">{channels.length}</p>
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">source channel{channels.length === 1 ? "" : "s"}</p>
            </div>
          </div>
        )}
      </header>

      {/* Connect card */}
      <section className="relative overflow-hidden rounded-2xl border border-[#253244] bg-[#101824] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#FF0000]/[0.08] blur-3xl" aria-hidden />
        <div className="relative mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#253244] bg-[#0A111B]">
            <Youtube className="h-5 w-5 text-[#FF0000]" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">Connect a YouTube channel</h2>
            <p className="text-sm text-[#94A3B8]">Add a channel you clip from, so it&apos;s one click away when you create shorts.</p>
          </div>
        </div>

        <label htmlFor="channel-url" className="sr-only">
          YouTube channel URL, @handle or name
        </label>
        <div
          className={cn(
            "relative flex items-center gap-2 rounded-xl border bg-[#0A111B] p-1.5 pl-4 transition-colors focus-within:border-[#54D045]/60",
            error && phase === "idle" ? "border-[#EF4444]/50" : "border-[#253244]",
          )}
        >
          {phase === "resolving" ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#54D045]" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-[#64748B]" />
          )}
          <input
            id="channel-url"
            value={query}
            disabled={busy || phase === "preview"}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            placeholder="Paste a YouTube channel URL or enter @handle"
            autoComplete="off"
            className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[#F8FAFC] placeholder:text-[#64748B] shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none disabled:opacity-60"
            onKeyDown={(e) => e.key === "Enter" && findChannel()}
          />
          {query && phase === "idle" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear"
              className="rounded-md p-1.5 text-[#64748B] hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {phase !== "preview" && phase !== "connecting" && (
            <button
              type="button"
              onClick={findChannel}
              disabled={busy || !query.trim()}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] transition-colors hover:bg-[#62dc53] disabled:cursor-not-allowed disabled:bg-[#19251F] disabled:text-[#64748B]"
            >
              {phase === "resolving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="hidden sm:inline">{phase === "resolving" ? "Finding…" : "Find channel"}</span>
            </button>
          )}
        </div>

        {phase === "idle" && !query && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#64748B]">Try:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="rounded-md border border-[#253244] bg-[#0A111B] px-2.5 py-1 text-[11px] text-[#cbd5e1] transition-colors hover:border-[#54D045]/40 hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Preview */}
        {preview && (phase === "preview" || phase === "connecting") && (
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-[#54D045]/30 bg-[#54D045]/[0.05] p-4 sm:flex-row sm:items-center">
            <ChannelAvatar src={preview.thumbnail_url} name={preview.channel_name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-[#F8FAFC]">{preview.channel_name}</p>
              {handleOf(preview.channel_url) && <p className="text-sm text-[#cbd5e1]">{handleOf(preview.channel_url)}</p>}
              <a
                href={preview.channel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-[#94A3B8] hover:text-white"
              >
                <span className="truncate">{preview.channel_url}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={cancelPreview}
                disabled={phase === "connecting"}
                className="h-10 rounded-lg border border-[#253244] px-3 text-sm text-[#cbd5e1] hover:bg-white/[0.04] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmConnect}
                disabled={phase === "connecting" || alreadyAdded}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {phase === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {alreadyAdded ? "Already added" : phase === "connecting" ? "Adding…" : "Add channel"}
              </button>
            </div>
          </div>
        )}

        {success && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-sm text-[#86efac]" role="status">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {success}
          </p>
        )}
        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#fca5a5]" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <p className="mt-4 flex items-start gap-2 text-xs text-[#64748B]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          These are channels you clip from. Accounts you post to are managed separately under{" "}
          <Link href="/setup/platforms?from=dashboard" className="text-[#8fe383] hover:underline">
            Platform connections
          </Link>
          .
        </p>
      </section>

      {/* Connected channels */}
      <section className="mt-5 rounded-2xl border border-[#253244] bg-[#101824]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#253244] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">
              Connected channels {!loadingList && channels.length > 0 && <span className="font-normal text-[#64748B]">{channels.length}</span>}
            </h2>
            <p className="mt-0.5 text-sm text-[#94A3B8]">Manage your YouTube content sources.</p>
          </div>
          {channels.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search channels"
                  aria-label="Search channels"
                  className="h-9 w-48 rounded-lg border border-[#253244] bg-[#0A111B] pl-8 pr-3 text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B] focus:border-[#54D045]/60"
                />
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sort channels"
                className="h-9 rounded-lg border border-[#253244] bg-[#0A111B] px-3 text-sm text-[#F8FAFC] outline-none [color-scheme:dark]"
              >
                <option value="recent">Recently added</option>
                <option value="oldest">Oldest first</option>
                <option value="name">A–Z</option>
              </select>
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4">
          {loadingList ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-[#253244] p-3">
                  <div className="h-11 w-11 animate-pulse rounded-full bg-[#131D2B]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 animate-pulse rounded bg-[#131D2B]" />
                    <div className="h-3 w-64 animate-pulse rounded bg-[#131D2B]" />
                  </div>
                </div>
              ))}
            </div>
          ) : listError ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#F8FAFC]">We couldn&apos;t load your channels.</p>
              <button
                type="button"
                onClick={() => {
                  setLoadingList(true);
                  loadChannels();
                }}
                className="mt-3 h-9 rounded-lg border border-[#253244] px-4 text-sm text-[#F8FAFC] hover:bg-white/[0.04]"
              >
                Retry
              </button>
            </div>
          ) : channels.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#FF0000]/25 bg-[#FF0000]/10">
                <Youtube className="h-6 w-6 text-[#FF4d4d]" />
              </span>
              <p className="font-semibold text-[#F8FAFC]">No source channels connected yet.</p>
              <p className="mt-1.5 max-w-sm text-sm text-[#94A3B8]">
                Connect your first YouTube channel to start turning videos into engaging shorts.
              </p>
              <button
                type="button"
                onClick={() => document.getElementById("channel-url")?.focus()}
                className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]"
              >
                Connect your first channel <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#94A3B8]">No channels match &ldquo;{filter}&rdquo;.</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((ch) => (
                <li
                  key={ch.id}
                  className="group flex items-center gap-3 rounded-xl border border-[#253244] bg-[#0B1220] p-3 transition-colors hover:border-[#35445a]"
                >
                  <ChannelAvatar src={ch.thumbnail_url} name={ch.channel_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <p className="truncate font-semibold text-[#F8FAFC]">{ch.channel_name}</p>
                      {handleOf(ch.channel_url) && <span className="text-xs text-[#94A3B8]">{handleOf(ch.channel_url)}</span>}
                    </div>
                    <p className="truncate text-xs text-[#64748B]">{ch.channel_url}</p>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">Added {formatConnectedDate(ch.created_at)}</p>
                  </div>
                  <span className="hidden shrink-0 rounded-md border border-[#22C55E]/30 bg-[#22C55E]/10 px-2 py-0.5 text-[11px] font-medium text-[#86efac] sm:inline">
                    Saved
                  </span>
                  <a
                    href={ch.channel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${ch.channel_name} on YouTube`}
                    className="rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setRemoving(ch)}
                    aria-label={`Remove ${ch.channel_name}`}
                    className="rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-[#EF4444]/10 hover:text-[#fca5a5]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {!embedded && (
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#253244] px-4 text-sm text-[#F8FAFC] hover:bg-white/[0.04]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <Link
            href="/login?redirect=/channels"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]"
          >
            Sign in to manage channels
          </Link>
        </div>
      )}

      {/* Remove confirmation */}
      {removing && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070B12]/80 p-4 backdrop-blur-sm"
          onClick={() => !removeBusy && setRemoving(null)}
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#253244] bg-[#101824] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]"
          >
            <div className="mb-4 flex items-center gap-3">
              <ChannelAvatar src={removing.thumbnail_url} name={removing.channel_name} />
              <h3 id="remove-title" className="text-lg font-semibold text-[#F8FAFC]">
                Remove {removing.channel_name}?
              </h3>
            </div>
            <p className="text-sm text-[#94A3B8]">
              It will be removed from your source channels. Videos you imported and clips you made from it stay in
              your library.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                disabled={removeBusy}
                onClick={() => setRemoving(null)}
                className="h-10 rounded-lg border border-[#253244] px-4 text-sm text-[#F8FAFC] hover:bg-white/[0.04]"
              >
                Keep channel
              </button>
              <button
                type="button"
                disabled={removeBusy}
                onClick={confirmRemove}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#EF4444] px-4 text-sm font-semibold text-white hover:bg-[#dc2626] disabled:opacity-60"
              >
                {removeBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelAvatar({ src, name, size = "md" }: { src?: string; name: string; size?: "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const dim = size === "lg" ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm";
  return src && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn("shrink-0 rounded-full border border-[#253244] object-cover", dim)}
    />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-[#FF0000]/15 font-semibold text-[#ff8080]", dim)}>
      {name.trim().charAt(0).toUpperCase() || <Youtube className="h-4 w-4" />}
    </span>
  );
}
