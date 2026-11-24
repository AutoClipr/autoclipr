"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Link2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { SUPPORTED_SOURCES } from "@/lib/video-sources";
import { cn } from "@/lib/utils";
import {
  ClipSettingsPanel,
  SourceLayoutBar,
  PANEL,
  ProcessingCard,
  PublishTargets,
  StepHeader,
  SummaryPanel,
  VideoThumb,
  useClipOptions,
  PlanLimitHint,
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
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "");
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
  const { credits, costPerClip, tier } = useCredits();
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<{ videoId: string; title: string } | null>(null);

  // Prefill from ?url= (the landing page's "Get free clips" box sends people here).
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("url");
    if (fromQuery) setUrl(fromQuery);
  }, []);

  const trimmed = url.trim();
  const ytId = youtubeId(url);
  const thumbnail = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;
  const source = trimmed ? sourceLabel(url) : null;
  const validUrl = !!source;
  const invalid = trimmed.length > 0 && !validUrl;

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      inputRef.current?.focus();
    }
  }

  async function handleCreate() {
    if (!validUrl || creating) return;
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
        url: trimmed,
        ...opts.payload(),
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
    <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="min-w-0 space-y-5">
        {/* Step 1: link + preview */}
        <section className={cn(PANEL, "p-5 sm:p-6")}>
          <StepHeader step="01" title="Video source" description="Paste a link to a public video." />
          <div className="-mt-2 mb-4"><PlanLimitHint tier={tier} /></div>
          <div className="grid gap-5 sm:grid-cols-[240px_1fr]">
            <VideoThumb src={thumbnail} className="aspect-video">
              {!thumbnail && (
                <span className="absolute inset-x-0 bottom-3 text-center text-xs text-[#64748B]">
                  {source ? `${source} link` : "Preview appears here"}
                </span>
              )}
              {thumbnail && source && (
                <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  {source}
                </span>
              )}
            </VideoThumb>

            <div className="min-w-0">
              <label htmlFor="video-url" className="text-sm font-medium text-[#F8FAFC]">
                Video URL
              </label>
              <div
                className={cn(
                  "mt-2 flex items-center gap-2.5 rounded-xl border bg-[#0A111B] pl-4 pr-2 transition-colors focus-within:border-[#54D045]/60",
                  invalid ? "border-[#EF4444]/50" : "border-[#253244]",
                )}
              >
                <Link2 className="h-5 w-5 shrink-0 text-[#64748B]" />
                <input
                  ref={inputRef}
                  id="video-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  aria-invalid={invalid}
                  aria-describedby="video-url-help"
                  className="h-14 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[#F8FAFC] shadow-none outline-none ring-0 placeholder:text-[#64748B] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                />
                {url ? (
                  <button
                    type="button"
                    onClick={() => setUrl("")}
                    aria-label="Clear link"
                    className="rounded-md p-1.5 text-[#64748B] hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pasteFromClipboard}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#253244] px-3 text-sm font-medium text-[#cbd5e1] hover:bg-white/[0.04] hover:text-white"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                  </button>
                )}
              </div>
              <p id="video-url-help" className={cn("mt-2 text-xs", invalid ? "text-[#fca5a5]" : "text-[#64748B]")}>
                {invalid
                  ? "That doesn't look like a valid link. It should start with https://"
                  : validUrl
                    ? `${source} link detected. Title and length are read when the import starts.`
                    : `Supported: ${SUPPORTED_SOURCES.filter((s) => s.id !== "upload")
                        .map((s) => s.label)
                        .join(" · ")}`}
              </p>
              <div className="mt-4"><SourceLayoutBar opts={opts} tier={tier} thumbnail={thumbnail} /></div>
            </div>
          </div>
        </section>

        <ClipSettingsPanel opts={opts} media={{ image: thumbnail }}>
          <PublishTargets opts={opts} />
        </ClipSettingsPanel>
      </div>

      <SummaryPanel
        opts={opts}
        videoSeconds={null}
        videoLengthLabel={source ? "Detected on import" : "–"}
        credits={credits}
        costPerClip={costPerClip}
        error={error}
        buttonLabel={creating ? "Starting…" : validUrl ? "Generate Viral Clips" : "Paste a link to start"}
        busy={creating}
        disabled={!validUrl}
        onCreate={handleCreate}
      />
    </div>
  );
}
