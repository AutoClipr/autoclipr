"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink, Flame, Loader2, Share2, X } from "lucide-react";
import type { Clip } from "@/lib/api";
import { cn } from "@/lib/utils";
import { clipDuration, clipScore, formatSeconds, scoreLabel, scoreTone } from "./clip-card";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const PLATFORM_LABEL: Record<string, string> = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };

const resolution = (q?: string | null) => (q === "4k" ? "2160 × 3840" : "1080 × 1920");

/**
 * Large clip player. Rendered in a portal on <body> so no transformed parent
 * (card hover lift) can trap it. Only the open clip's video is loaded; it
 * starts playing straight from the user's click and is torn down on close.
 */
export function ClipPlayerModal({
  clips,
  index,
  onIndexChange,
  onClose,
  onPost,
  onDownload,
  downloadingId,
}: {
  clips: Clip[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onPost: (clip: Clip) => void;
  onDownload: (clip: Clip) => void;
  downloadingId: string | null;
}) {
  const clip = clips[index];
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [speed, setSpeed] = useState(1);
  const hasPrev = index > 0;
  const hasNext = index < clips.length - 1;

  // Keyboard, scroll lock, focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      else if (e.key === "ArrowRight" && index < clips.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const returnFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      returnFocus?.focus?.();
    };
  }, [index, clips.length, onClose, onIndexChange]);

  // New clip: reset state and start playback (with sound; muted if the browser refuses).
  useEffect(() => {
    setLoading(true);
    setError(false);
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => undefined);
    });
    return () => {
      // Stop and release the media when switching or closing.
      v.pause();
      v.removeAttribute("src");
      v.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.id]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  if (!clip) return null;
  const score = clipScore(clip);
  const posted = clip.publications?.filter((p) => p.status === "posted") ?? [];
  const pending = clip.publications?.filter((p) => p.status === "pending" || p.status === "processing") ?? [];
  const failed = clip.publications?.filter((p) => p.status === "failed") ?? [];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-stretch justify-center bg-[#050817]/90 backdrop-blur-md sm:items-center sm:p-6" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Clip: ${clip.title}`}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full flex-col overflow-y-auto bg-[#101827] sm:h-auto sm:max-h-[92vh] sm:max-w-[1150px] sm:rounded-3xl sm:border sm:border-[#263244] sm:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] md:flex-row md:overflow-hidden"
      >
        {/* Player */}
        <div className="relative flex shrink-0 items-center justify-center bg-black md:w-[58%]">
          {hasPrev && (
            <NavBtn side="left" label="Previous clip" onClick={() => onIndexChange(index - 1)} />
          )}
          <div className="relative flex h-[62vh] w-full items-center justify-center sm:h-[78vh] md:h-[86vh] md:max-h-[820px]">
            <video
              key={clip.id}
              ref={videoRef}
              src={clip.download_url ?? undefined}
              poster={clip.thumbnail_url ?? undefined}
              controls
              autoPlay
              playsInline
              preload="auto"
              onWaiting={() => setLoading(true)}
              onCanPlay={() => setLoading(false)}
              onPlaying={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
              className="aspect-[9/16] h-full max-h-full w-auto max-w-full bg-black object-contain"
            />
            {loading && !error && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-label="Loading video">
                <Loader2 className="h-9 w-9 animate-spin text-white/80" />
              </span>
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center" role="alert">
                <AlertCircle className="h-8 w-8 text-rose-300" />
                <p className="text-sm text-white">This clip couldn&apos;t be played.</p>
                <p className="text-xs text-white/60">The link may have expired — close and reopen, or refresh the page.</p>
              </div>
            )}
          </div>
          {hasNext && (
            <NavBtn side="right" label="Next clip" onClick={() => onIndexChange(index + 1)} />
          )}
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">
              CLIP {index + 1} OF {clips.length}
            </p>
            <button ref={closeRef} type="button" aria-label="Close player" onClick={onClose}
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#9299A8] hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60">
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 className="mt-2 text-xl font-bold leading-snug text-white">{clip.title}</h2>

          {score != null && (
            <div className={cn("mt-4 inline-flex w-fit items-center gap-2 rounded-xl border px-3 py-2", scoreTone(score))}>
              <Flame className="h-4 w-4" />
              <span className="text-lg font-bold tabular-nums">{score}</span>
              <span className="text-xs font-semibold">{scoreLabel(score)} viral score</span>
            </div>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Meta label="Duration" value={formatSeconds(clipDuration(clip))} />
            <Meta label="Resolution" value={resolution(clip.export_quality)} />
            <Meta label="Format" value={`MP4 · ${clip.aspect_ratio || "9:16"}`} />
            <Meta label="Created" value={new Date(clip.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} />
          </dl>

          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9299A8]">Publishing</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {posted.length + pending.length + failed.length === 0 && <span className="text-sm text-[#9299A8]">Not published yet</span>}
              {posted.map((p) => (
                <a key={`p-${p.platform}`} href={p.platform_post_url ?? undefined} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#54D045]/30 bg-[#54D045]/10 px-2 py-1 text-xs font-medium text-[#a6ec9c] hover:bg-[#54D045]/20">
                  {PLATFORM_LABEL[p.platform] ?? p.platform} {p.platform_post_url && <ExternalLink className="h-3 w-3" />}
                </a>
              ))}
              {pending.map((p) => (
                <span key={`q-${p.platform}`} className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-200">
                  <Loader2 className="h-3 w-3 animate-spin" /> {PLATFORM_LABEL[p.platform] ?? p.platform}
                </span>
              ))}
              {failed.map((p) => (
                <span key={`f-${p.platform}`} title={p.error_message ?? "Failed"} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                  <AlertCircle className="h-3 w-3" /> {PLATFORM_LABEL[p.platform] ?? p.platform} failed
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9299A8]">Playback speed</p>
            <div className="mt-2 inline-flex rounded-xl border border-[#263244] bg-[#0A111B] p-0.5" role="radiogroup" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={speed === s} onClick={() => setSpeed(s)}
                  className={cn("h-8 rounded-lg px-2.5 text-xs font-medium tabular-nums", speed === s ? "bg-[#263244] text-white" : "text-[#9299A8] hover:text-white")}>
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
            <button type="button" onClick={() => onPost(clip)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#54D045] text-sm font-semibold text-[#050817] hover:bg-[#62dc53]">
              <Share2 className="h-4 w-4" /> Publish
            </button>
            <button type="button" onClick={() => onDownload(clip)} disabled={downloadingId === clip.id}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#263244] text-sm font-semibold text-white hover:bg-white/[0.04] disabled:opacity-60">
              {downloadingId === clip.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
            </button>
          </div>
          <p className="mt-3 hidden text-center text-[11px] text-[#64748B] sm:block">← → to switch clips · Esc to close</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#263244] bg-[#151F2E]/60 px-3 py-2.5">
      <dt className="text-[11px] text-[#9299A8]">{label}</dt>
      <dd className="mt-0.5 font-medium text-white">{value}</dd>
    </div>
  );
}

function NavBtn({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className={cn("absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60",
        side === "left" ? "left-3" : "right-3")}>
      <Icon className="h-5 w-5" />
    </button>
  );
}
