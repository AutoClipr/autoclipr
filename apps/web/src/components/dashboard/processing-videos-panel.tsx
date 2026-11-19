"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, Sparkles, Trash2 } from "lucide-react";
import { apiFetch, type Video, type VideoPipeline } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { formatPipelineError } from "@/lib/pipeline-errors";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { deleteVideoWithToast } from "@/lib/delete-video";

const PIPELINE_POLL_MS = 6000;

const STATUS_LABELS: Record<string, string> = {
  importing: "Importing",
  uploading: "Uploading",
  processing: "Processing",
  analyzing: "Analyzing",
  failed: "Failed",
};

function activeStepLabel(pipeline: VideoPipeline): string {
  const active = pipeline.steps.find((s) => s.status === "active");
  if (active) return active.label;
  if (pipeline.clips_created > 0) {
    return `${pipeline.clips_created} clip${pipeline.clips_created === 1 ? "" : "s"} ready`;
  }
  return "Preparing your video…";
}

/** "ETA 3m" / "ETA <1m" from the API's estimated completion time, or null. */
function formatEta(estimatedAt: string | null | undefined): string | null {
  if (!estimatedAt) return null;
  const ms = new Date(estimatedAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "ETA <1m";
  if (minutes < 60) return `ETA ${minutes}m`;
  return `ETA ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

type ProcessingVideosPanelProps = {
  videos: Video[];
};

export function ProcessingVideosPanel({ videos: initialVideos }: ProcessingVideosPanelProps) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [videos, setVideos] = useState(initialVideos);
  const [pipelines, setPipelines] = useState<Record<string, VideoPipeline>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Clip counts already seen, so the page refreshes only when new clips land.
  const seenClips = useRef<Record<string, number>>({});

  // The server re-sends the list after each refresh: follow it, so finished
  // videos leave the panel instead of polling forever.
  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  const pollAll = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    let shouldRefresh = false;

    for (const video of videos) {
      // Skip polling videos that already have a terminal error
      if (errors[video.id]) continue;

      const res = await apiFetch<VideoPipeline>(`/api/v1/videos/${video.id}/pipeline`, {
        token,
        skipGlobalLoader: true,
      });

      if (!res.success || !res.data) continue;

      const data = res.data;
      const failed = data.job?.status === "failed" || data.status === "failed";

      if (failed) {
        setErrors((prev) => ({
          ...prev,
          [video.id]: formatPipelineError(data.job?.error),
        }));
        continue;
      }

      setErrors((prev) => {
        if (!prev[video.id]) return prev;
        const next = { ...prev };
        delete next[video.id];
        return next;
      });

      if (data.status === "ready") {
        // Done: drop it from the panel and show its clips.
        setVideos((prev) => prev.filter((v) => v.id !== video.id));
        shouldRefresh = true;
        continue;
      }

      setPipelines((prev) => ({ ...prev, [video.id]: data }));

      if (data.clips_created > (seenClips.current[video.id] ?? 0)) {
        seenClips.current[video.id] = data.clips_created;
        shouldRefresh = true;
      }
    }

    if (shouldRefresh) {
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, router]);

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

  useEffect(() => {
    if (!videos.length) return;

    void pollAll();
    const interval = setInterval(() => void pollAll(), PIPELINE_POLL_MS);
    return () => clearInterval(interval);
  }, [videos, pollAll]);

  if (!videos.length) return null;

  return (
    <>
      {dialog}
      <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>Videos in progress</h2>
          <p className="text-sm text-white/50">
            Clips appear automatically when processing finishes — no action needed.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 rounded-full border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
          {videos.length} active
        </Badge>
      </div>

      <Card>
        <CardContent className="divide-y divide-white/10 p-0">
          {videos.map((video) => {
            const pipeline = pipelines[video.id];
            const error = errors[video.id];
            const progress = pipeline?.progress_percent ?? 8;
            const statusLabel = STATUS_LABELS[video.status] ?? video.status;
            const eta = formatEta(pipeline?.estimated_completion_at);

            return (
              <div key={video.id} className="space-y-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{video.title}</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {pipeline ? activeStepLabel(pipeline) : `${statusLabel}…`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!error && (
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-rose-500/30 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-200"
                      disabled={deletingId === video.id}
                      onClick={() => void handleDelete(video)}
                      aria-label={`Delete ${video.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {error ? (
                  <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.08] px-3.5 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm text-red-300">{error}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline" className="h-8">
                          <Link href="/create">Try again</Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-rose-500/30 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-200"
                          disabled={deletingId === video.id}
                          onClick={() => void handleDelete(video)}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-violet-400" />
                        {statusLabel}
                      </span>
                      <span>
                        {progress}%{eta && <span className="ml-1.5 text-white/40">· {eta}</span>}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
    </>
  );
}
