"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Film, FolderOpen, Trash2 } from "lucide-react";
import type { Video } from "@/lib/api";
import { deleteVideoWithToast } from "@/lib/delete-video";
import { GenerateClipsButton } from "@/components/dashboard/generate-clips-button";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDuration } from "@/lib/utils";

type ReadyVideosGridProps = {
  videos: Video[];
  /** Clips already made per source video, from loaded data (fallback when the API has no count). */
  clipCounts?: Record<string, number>;
  /** More videos exist on the server than were loaded (count shows "N+"). */
  moreAlbums?: boolean;
  /** Current plan name for the card tag, e.g. "Free Plan". */
  planLabel?: string;
};

/** An album is "New" for two days after it was made. */
const NEW_FOR_MS = 48 * 60 * 60 * 1000;

export function ReadyVideosGrid({ videos: initialVideos, clipCounts = {}, moreAlbums, planLabel }: ReadyVideosGridProps) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [videos, setVideos] = useState(initialVideos);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(video: Video) {
    const ok = await confirm({
      title: "Delete video?",
      description: `Delete "${video.title}" and all its clips? This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    setDeletingId(video.id);
    try {
      const deleted = await deleteVideoWithToast(video.id);
      if (!deleted) return;
      setVideos((prev) => prev.filter((v) => v.id !== video.id));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  if (!videos.length) return null;

  return (
    <>
      {dialog}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Your albums</h2>
            <p className="mt-0.5 text-sm text-[#94A3B8]">
              Every video you&apos;ve processed, with the clips made from it. Open an album or generate more clips.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#253244] bg-[#101824] px-3 py-1 text-xs font-medium text-[#cbd5e1]">
            <FolderOpen className="h-3.5 w-3.5 text-[#54D045]" aria-hidden />
            {videos.length.toLocaleString()}
            {moreAlbums ? "+" : ""} album{videos.length === 1 && !moreAlbums ? "" : "s"}
          </span>
        </div>

        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          {videos.map((video) => {
            const made = video.clip_count ?? clipCounts[video.id] ?? 0;
            const isNew = Date.now() - new Date(video.created_at).getTime() < NEW_FOR_MS;
            const href = `/clips/album/${video.id}`;
            return (
              <article
                key={video.id}
                className="group flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-[#253244] bg-[#101824] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#35445a] hover:shadow-[0_20px_44px_-24px_rgba(0,0,0,0.95)] sm:w-[300px]"
              >
                <Link href={href} aria-label={`Open album ${video.title}`} className="relative block aspect-video overflow-hidden bg-[#070B12] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60">
                  {video.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-8 w-8 text-[#253244]" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
                  <span className="absolute right-2 top-2 flex gap-1.5">
                    {planLabel && (
                      <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">{planLabel}</span>
                    )}
                    {isNew && (
                      <span className="rounded-full bg-[#54D045] px-2.5 py-1 text-[11px] font-semibold text-[#070B12]">New</span>
                    )}
                  </span>
                  {video.duration_seconds ? (
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur-sm">
                      {formatDuration(video.duration_seconds)}
                    </span>
                  ) : null}
                </Link>
                <div className="relative">
                  <button
                    type="button"
                    disabled={deletingId === video.id}
                    onClick={() => void handleDelete(video)}
                    aria-label={`Delete ${video.title}`}
                    className="absolute -top-10 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white/70 opacity-0 backdrop-blur-sm transition-all hover:bg-[#EF4444]/80 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-3.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-[#F8FAFC]" title={video.title}>
                      <Link href={href} className="hover:text-[#8fe383]">{video.title}</Link>
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#94A3B8]">
                      <Clock className="h-3 w-3" />
                      {video.duration_seconds ? formatDuration(video.duration_seconds) : "Length unknown"}
                      {` · ${made} clip${made === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <div className="mt-auto">
                    <GenerateClipsButton videoId={video.id} videoStatus={video.status} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
