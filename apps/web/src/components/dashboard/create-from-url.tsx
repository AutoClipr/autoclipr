"use client";

import { useEffect, useState } from "react";
import { Link2, Send, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { PLATFORMS, SUPPORTED_SOURCES } from "@/lib/video-sources";
import { cn } from "@/lib/utils";
import {
  ClipSettingsPanel,
  PANEL,
  ProcessingCard,
  SectionTitle,
  SummaryPanel,
  VideoOptionsRow,
  VideoThumb,
  useClipOptions,
  useCredits,
} from "./create-shared";

/** YouTube video id from watch, youtu.be, shorts, embed and live links. */
function youtubeId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "music.youtube.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
      return m?.[2] ?? null;
    }
  } catch {
    // not a URL yet
  }
  return null;
}

function sourceLabel(raw: string): string | null {
  try {
    const host = new URL(raw.trim()).hostname.replace(/^www\./, "");
    if (/youtube\.com|youtu\.be/.test(host)) return "YouTube";
    if (host.includes("vimeo.com")) return "Vimeo";
    if (host.includes("loom.com")) return "Loom";
    if (host.includes("drive.google.com")) return "Google Drive";
    if (/\.mp4($|\?)/i.test(raw)) return "Direct MP4";
    return host;
  } catch {
    return null;
  }
}

export function CreateFromUrl() {
  const opts = useClipOptions();
  const { credits, costPerClip } = useCredits();

  const [url, setUrl] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["tiktok", "instagram", "youtube", "linkedin"]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<{ videoId: string; title: string } | null>(null);

  // Prefill from ?url= (the landing page's "Get free clips" box sends people here).
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("url");
    if (fromQuery) setUrl(fromQuery);
  }, []);

  const ytId = youtubeId(url);
  const thumbnail = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;
  const source = url.trim() ? sourceLabel(url) : null;
  const validUrl = !!source;

  async function handleCreate() {
    if (!validUrl) return;
    setCreating(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setCreating(false);
      return setError("Please sign in again.");
    }
    const res = await apiFetch<{ video_id: string; title: string }>("/api/v1/videos/import-url", {
      method: "POST",
      token,
      body: JSON.stringify({
        url: url.trim(),
        ...opts.payload(),
        platforms,
        auto_publish: true,
      }),
    });
    setCreating(false);
    if (!res.success || !res.data) return setError(res.error?.message ?? "Could not start the import.");
    setStarted({ videoId: res.data.video_id, title: res.data.title });
  }

  if (started) {
    return (
      <ProcessingCard
        videoId={started.videoId}
        title={started.title}
        thumbnail={thumbnail}
        // Length isn't known until the download finishes; the live ETA takes over then.
        estimateSeconds={null}
        onReset={() => {
          setStarted(null);
          setUrl("");
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="space-y-5">
        {/* Link + preview */}
        <div className={cn(PANEL, "grid gap-5 p-4 sm:grid-cols-[260px_1fr] sm:p-5")}>
          <VideoThumb src={thumbnail} className="aspect-video">
            {!thumbnail && (
              <span className="absolute inset-x-0 bottom-3 text-center text-xs text-white/45">
                {source ? `${source} link` : "Preview appears here"}
              </span>
            )}
          </VideoThumb>

          <div className="flex min-w-0 flex-col justify-between gap-4">
            <div className="min-w-0">
              <label htmlFor="video-url" className="text-[15px] font-semibold text-white">
                Paste a video link
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 transition-colors focus-within:border-emerald-400/50">
                <Link2 className="h-4 w-4 shrink-0 text-white/40" />
                <input
                  id="video-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm text-white placeholder:text-white/30 outline-none"
                />
                {url && (
                  <button
                    type="button"
                    onClick={() => setUrl("")}
                    aria-label="Clear link"
                    className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-white/40">
                {SUPPORTED_SOURCES.filter((s) => s.id !== "upload")
                  .map((s) => s.label)
                  .join(" · ")}
              </p>
            </div>
            <VideoOptionsRow opts={opts} />
          </div>
        </div>

        <ClipSettingsPanel opts={opts}>
          <section className="border-t border-white/[0.06] pt-6">
            <SectionTitle icon={Send} title="Publish to" />
            <div className="mt-4 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setPlatforms((prev) => (on ? prev.filter((x) => x !== p.id) : [...prev, p.id]))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      on ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/45 hover:text-white/80",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </section>
        </ClipSettingsPanel>
      </div>

      <SummaryPanel
        opts={opts}
        videoSeconds={null}
        videoLengthLabel={source ? "Detected on import" : "–"}
        credits={credits}
        costPerClip={costPerClip}
        error={error}
        buttonLabel={creating ? "Starting…" : validUrl ? "Create" : "Paste a link to start"}
        busy={creating}
        disabled={!validUrl}
        onCreate={handleCreate}
      />
    </div>
  );
}
