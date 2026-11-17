"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Video } from "@/lib/api";
import { deleteVideoWithToast } from "@/lib/delete-video";
import { VideoCard } from "@/components/dashboard/video-card";
import { GenerateClipsButton } from "@/components/dashboard/generate-clips-button";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";

type ReadyVideosGridProps = {
  videos: Video[];
};

export function ReadyVideosGrid({ videos: initialVideos }: ReadyVideosGridProps) {
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
      <h2 className="mb-1 text-lg font-bold text-white">Generate more clips</h2>
      <p className="mb-4 text-sm text-white/50">
        These videos are ready — generate additional shorts anytime.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <div key={video.id} className="space-y-4">
            <div className="relative">
              <VideoCard video={video} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-3 top-3 h-8 w-8 border-rose-500/40 bg-black/70 text-rose-300 backdrop-blur hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-rose-200"
                disabled={deletingId === video.id}
                onClick={() => void handleDelete(video)}
                aria-label={`Delete ${video.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-center px-1">
              <GenerateClipsButton videoId={video.id} videoStatus={video.status} />
            </div>
          </div>
        ))}
      </div>
    </section>
    </>
  );
}
