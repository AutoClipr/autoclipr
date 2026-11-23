"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

/** "Generate more clips" for a ready video (same request the button sends). */
export function useGenerateClips(videoId: string, videoStatus: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = videoStatus === "ready";

  async function generate() {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const res = await apiFetch("/api/v1/clips/generate", {
      method: "POST",
      token: session.access_token,
      body: JSON.stringify({
        video_id: videoId,
        clip_count: 3,
        aspect_ratio: "9:16",
        with_subtitles: true,
      }),
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error?.message ?? "Failed to generate clips");
      return;
    }

    router.refresh();
  }

  return { canGenerate, loading, error, generate };
}

export function GenerateClipsButton({
  videoId,
  videoStatus,
}: {
  videoId: string;
  videoStatus: string;
}) {
  const { canGenerate, loading, error, generate } = useGenerateClips(videoId, videoStatus);

  if (!canGenerate) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#54D045]/35 bg-[#54D045]/10 text-xs font-semibold text-[#a6ec9c] transition-colors hover:bg-[#54D045]/20 hover:text-white disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        {loading ? "Generating…" : "Generate more clips"}
      </button>
      {error && <p className="text-center text-xs text-rose-300">{error}</p>}
    </div>
  );
}
