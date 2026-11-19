"use client";

import { memo, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  ExternalLink,
  Flame,
  Loader2,
  MoreHorizontal,
  Play,
  Scissors,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Clip } from "@/lib/api";
import { downloadFile, sanitizeFilename } from "@/lib/download";
import { PostClipModal } from "@/components/dashboard/post-clip-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ClipCardProps = {
  clip: Clip;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (clipId: string, selected: boolean) => void;
  onDelete?: (clipId: string) => void | Promise<void>;
  /** Highest-scoring clip in the list. */
  topPick?: boolean;
};

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

export function clipDuration(clip: Clip): number {
  return clip.duration_seconds ?? Math.max(0, Math.round((clip.end_time_ms - clip.start_time_ms) / 1000));
}

export function clipScore(clip: Clip): number | null {
  return clip.viral_score ?? (clip.ai_score != null ? Math.round(clip.ai_score * 100) : null);
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function scoreTone(score: number) {
  if (score >= 80) return "border-[#54D045]/40 bg-[#54D045]/15 text-[#a6ec9c]";
  if (score >= 60) return "border-[#35D6E8]/35 bg-[#35D6E8]/12 text-[#9beef7]";
  return "border-white/15 bg-black/50 text-white/75";
}

function ClipCardInner({
  clip,
  selectable = false,
  selected = false,
  onSelectChange,
  onDelete,
  topPick = false,
}: ClipCardProps) {
  const [thumbError, setThumbError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const durationSec = clipDuration(clip);
  const viralScore = clipScore(clip);
  const ready = clip.status === "completed";
  const canDownload = ready && !!clip.download_url;

  const postedPubs = clip.publications?.filter((p) => p.status === "posted") ?? [];
  const failedPubs = clip.publications?.filter((p) => p.status === "failed") ?? [];
  const pendingPubs =
    clip.publications?.filter((p) => p.status === "pending" || p.status === "processing") ?? [];

  async function handleDownload() {
    if (!clip.download_url) return;
    setDownloading(true);
    try {
      await downloadFile(clip.download_url, `${sanitizeFilename(clip.title)}.mp4`);
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(clip.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      className={cn(
        "group/card relative flex flex-col overflow-hidden rounded-2xl border bg-[#101824] transition-all duration-300",
        selected
          ? "border-[#54D045]/70 shadow-[0_0_0_1px_rgba(84,208,69,0.35),0_16px_40px_-20px_rgba(84,208,69,0.6)]"
          : topPick
            ? "border-amber-300/35 hover:border-amber-300/55"
            : "border-[#253244] hover:border-[#35445a]",
        "hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-24px_rgba(0,0,0,0.95)]",
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-[#070B12]">
        {clip.thumbnail_url && !thumbError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.04]"
            onError={() => setThumbError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Scissors className="h-9 w-9 text-[#253244]" />
          </div>
        )}

        {/* Legibility gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent" />

        {/* Preview trigger */}
        {canDownload ? (
          <button
            type="button"
            aria-label={`Preview ${clip.title}`}
            onClick={() => setPreviewOpen(true)}
            className="absolute inset-0 flex items-center justify-center focus-visible:outline-none"
          >
            <span className="flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-white/95 opacity-0 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.8)] transition-all duration-200 group-hover/card:scale-100 group-hover/card:opacity-100 group-focus-visible/card:opacity-100">
              <Play className="h-5 w-5 translate-x-0.5 fill-[#070B12] text-[#070B12]" />
            </span>
          </button>
        ) : (
          !ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-xs text-white/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="capitalize">{clip.status}</span>
            </div>
          )
        )}

        {/* Top-left: top pick */}
        {topPick && (
          <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
            <Flame className="h-3 w-3" /> Top pick
          </span>
        )}

        {/* Top-right: select */}
        {selectable && (
          <label className="absolute right-2.5 top-2.5 z-10 cursor-pointer">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={selected}
              onChange={(e) => onSelectChange?.(clip.id, e.target.checked)}
              aria-label={`Select ${clip.title}`}
            />
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md border transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#54D045]/60",
                selected
                  ? "border-[#54D045] bg-[#54D045] text-[#070B12]"
                  : "border-white/50 bg-black/40 text-transparent opacity-80 backdrop-blur-sm hover:border-white group-hover/card:opacity-100",
              )}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </label>
        )}

        {/* Bottom: duration + score */}
        <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-10 flex items-center justify-between gap-2">
          <span className="rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white backdrop-blur-sm">
            {formatSeconds(durationSec)}
          </span>
          {viralScore != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm",
                scoreTone(viralScore),
              )}
              title="Viral score (0–100)"
            >
              <Flame className="h-3 w-3" />
              {viralScore}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[#F8FAFC]" title={clip.title}>
            {clip.title}
          </h3>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {relativeDate(clip.created_at)}
            {clip.export_quality ? ` · ${clip.export_quality.replace("_", " ").toUpperCase()}` : ""}
          </p>
        </div>

        {(postedPubs.length > 0 || pendingPubs.length > 0 || failedPubs.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {postedPubs.map((pub) => (
              <a
                key={`p-${pub.platform}`}
                href={pub.platform_post_url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-[#54D045]/30 bg-[#54D045]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#a6ec9c] hover:bg-[#54D045]/20"
              >
                {PLATFORM_LABEL[pub.platform] ?? pub.platform}
                {pub.platform_post_url && <ExternalLink className="h-2.5 w-2.5" />}
              </a>
            ))}
            {pendingPubs.map((pub) => (
              <span
                key={`q-${pub.platform}`}
                className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200"
              >
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {PLATFORM_LABEL[pub.platform] ?? pub.platform}
              </span>
            ))}
            {failedPubs.map((pub) => (
              <span
                key={`f-${pub.platform}`}
                title={pub.error_message ?? "Failed"}
                className="inline-flex items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium text-rose-200"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                {PLATFORM_LABEL[pub.platform] ?? pub.platform} failed
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2">
          {ready && (
            <button
              type="button"
              onClick={() => setPostOpen(true)}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#54D045] text-xs font-semibold text-[#070B12] transition-colors hover:bg-[#62dc53]"
            >
              <Share2 className="h-3.5 w-3.5" /> Post
            </button>
          )}
          {canDownload && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              aria-label={`Download ${clip.title}`}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#253244] text-[#cbd5e1] transition-colors hover:border-[#35445a] hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          )}
          {onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More actions"
                  disabled={deleting}
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#253244] text-[#cbd5e1] transition-colors hover:border-[#35445a] hover:bg-white/[0.04] hover:text-white disabled:opacity-50",
                    !ready && "ml-auto",
                  )}
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {canDownload && (
                  <DropdownMenuItem onSelect={() => setPreviewOpen(true)}>
                    <Play className="mr-2 h-4 w-4" /> Preview
                  </DropdownMenuItem>
                )}
                {canDownload && (
                  <DropdownMenuItem onSelect={() => void handleDownload()}>
                    <Download className="mr-2 h-4 w-4" /> Download
                  </DropdownMenuItem>
                )}
                {canDownload && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onSelect={() => void handleDelete()}
                  className="text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <PostClipModal clip={clip} open={postOpen} onClose={() => setPostOpen(false)} />
      {previewOpen && clip.download_url && (
        <ClipPreviewModal
          clip={clip}
          durationSec={durationSec}
          downloading={downloading}
          onDownload={handleDownload}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </article>
  );
}

export const ClipCard = memo(ClipCardInner);

function ClipPreviewModal({
  clip,
  durationSec,
  downloading,
  onDownload,
  onClose,
}: {
  clip: Clip;
  durationSec: number;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070B12]/90 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${clip.title}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[#253244] bg-[#101824] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#253244] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#F8FAFC]">{clip.title}</p>
            <p className="text-xs text-[#94A3B8]">{formatSeconds(durationSec)} · 9:16</p>
          </div>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 justify-center bg-black">
          <video
            src={clip.download_url ?? undefined}
            poster={clip.thumbnail_url ?? undefined}
            controls
            autoPlay
            playsInline
            className="aspect-[9/16] max-h-[68vh] w-auto max-w-full bg-black object-contain"
          />
        </div>
        <div className="flex gap-2 p-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-lg border border-[#253244] text-sm font-medium text-[#cbd5e1] hover:bg-white/[0.04]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#54D045] text-sm font-semibold text-[#070B12] hover:bg-[#62dc53] disabled:opacity-60"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
