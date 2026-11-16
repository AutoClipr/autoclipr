import { createClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/dashboard/page-hero";
import { apiFetch, type Clip, type Video } from "@/lib/api";
import { ClipsList } from "@/components/dashboard/clips-list";
import { ProcessingVideosPanel } from "@/components/dashboard/processing-videos-panel";
import { ReadyVideosGrid } from "@/components/dashboard/ready-videos-grid";
import { ReloadButton } from "@/components/dashboard/reload-button";
import { Card } from "@/components/ui/card";
import { Scissors } from "lucide-react";

export const metadata = { title: "Clips" };

const IN_PROGRESS_STATUSES = new Set([
  "importing",
  "uploading",
  "processing",
  "analyzing",
  "failed",
]);

export default async function ClipsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session!.access_token;

  const [clipsRes, videosRes] = await Promise.all([
    apiFetch<Clip[]>("/api/v1/clips?limit=24", { token }),
    apiFetch<Video[]>("/api/v1/videos?limit=12", { token }),
  ]);

  const clips = clipsRes.data ?? [];
  const allVideos = videosRes.data ?? [];
  const processingVideos = allVideos.filter((v) => IN_PROGRESS_STATUSES.has(v.status));
  const readyVideos = allVideos.filter((v) => v.status === "ready");

  return (
    <div className="space-y-8">
      <PageHero
        label="Clips"
        title="My"
        highlight="clips"
        description="AI-generated shorts from your uploaded videos."
        actions={<ReloadButton hasProcessing={processingVideos.length > 0} />}
      />

      {processingVideos.length > 0 && (
        <ProcessingVideosPanel videos={processingVideos} />
      )}

      {readyVideos.length > 0 && <ReadyVideosGrid videos={readyVideos} />}

      <section>
        <h2 className="mb-4 text-lg font-bold text-white">All clips</h2>
        {clips.length === 0 ? (
          <Card className="flex flex-col items-center border-dashed p-8 text-center sm:p-16">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-400/30 bg-emerald-500/15 shadow-[0_0_40px_-8px_rgba(16,185,129,0.7)]">
              <Scissors className="h-7 w-7 text-emerald-200" />
            </span>
            <p className="text-lg font-medium">
              {processingVideos.length > 0 ? "Clips are on the way" : "No clips yet"}
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/50">
              {processingVideos.length > 0
                ? "Your videos are still processing. Finished clips will show up here automatically."
                : "Upload a video or import from YouTube to generate clips."}
            </p>
          </Card>
        ) : (
          <ClipsList clips={clips} />
        )}
      </section>
    </div>
  );
}
