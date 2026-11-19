"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Film, Trash2 } from "lucide-react";
import type { Video } from "@/lib/api";
import { deleteVideoWithToast } from "@/lib/delete-video";
import { GenerateClipsButton } from "@/components/dashboard/generate-clips-button";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDuration } from "@/lib/utils";

type ReadyVideosGridProps = {
  videos: Video[];
  /** Clips already made per source video, from loaded data. */
  clipCounts?: Record<string, number>;
};

export function ReadyVideosGrid({ videos: initialVideos, clipCounts = {} }: ReadyVideosGridProps) {
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Ready for more clips?</h2>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            Continue creating engaging shorts from your previously processed videos.
          </p>
        </div>

        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          {videos.map((video) => {
            const made = clipCounts[video.id];
            return (
              <article
                key={video.id}
                className="group flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-[#253244] bg-[#101824] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#35445a] hover:shadow-[0_20px_44px_-24px_rgba(0,0,0,0.95)] sm:w-[300px]"
              >
                <div className="relative aspect-video overflow-hidden bg-[#070B12]">
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
                  {video.duration_seconds ? (
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur-sm">
                      {formatDuration(video.duration_seconds)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={deletingId === video.id}
                    onClick={() => void handleDelete(video)}
                    aria-label={`Delete ${video.title}`}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white/70 opacity-0 backdrop-blur-sm transition-all hover:bg-[#EF4444]/80 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-3.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-[#F8FAFC]" title={video.title}>
                      {video.title}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#94A3B8]">
                      <Clock className="h-3 w-3" />
                      {video.duration_seconds ? formatDuration(video.duration_seconds) : "Length unknown"}
                      {made ? ` · ${made} clip${made === 1 ? "" : "s"} made` : ""}
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
