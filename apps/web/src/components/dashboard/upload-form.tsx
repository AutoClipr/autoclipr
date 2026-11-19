"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Captions,
  CheckCircle2,
  Clock,
  FileVideo,
  Loader2,
  Scissors,
  Timer,
  Trash2,
  Zap,
} from "lucide-react";
import { apiFetch, type Profile, type VideoPipeline } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { deleteVideoRequest } from "@/lib/delete-video";
import { formatPipelineError } from "@/lib/pipeline-errors";
import { CAPTION_STYLES, DURATIONS, EXPORT_QUALITIES, LANGUAGES } from "@/lib/video-sources";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const PIPELINE_POLL_MS = 3000;
const FILE_INPUT_ID = "autoclipr-video-upload";
const CLIP_COUNTS = [3, 5, 8, 10, 15, 20];

type Phase = "idle" | "configure" | "processing";
type UploadState = { progress: number; done: boolean; videoId: string | null; error: string | null };

/* ------------------------------------------------------------------ helpers */

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "–";
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * Rough processing time before we have live progress: download/transcribe
 * scales with video length, rendering with the number of clips.
 */
function estimateProcessingSeconds(videoSeconds: number | null, clipCount: number): number {
  const length = videoSeconds ?? 300;
  return Math.round(45 + length * 0.35 + clipCount * 15);
}

function formatEstimate(seconds: number): string {
  if (seconds < 90) return "about 1 min";
  const low = Math.max(1, Math.floor(seconds / 60));
  const high = Math.ceil((seconds * 1.4) / 60);
  return low === high ? `about ${low} min` : `${low}–${high} min`;
}

/** First frame (a second in) and duration, read locally before upload. */
async function readVideoPreview(file: File): Promise<{ thumbnail: string | null; duration: number | null }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("metadata"));
    });
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    video.currentTime = Math.min(1, (duration ?? 2) / 3);
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("seek"));
    });
    const canvas = document.createElement("canvas");
    const scale = 480 / Math.max(video.videoWidth, 1);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { thumbnail: canvas.toDataURL("image/jpeg", 0.8), duration };
  } catch {
    return { thumbnail: null, duration: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------------------------------------------------------- caption cards */

const CAPTION_PREVIEW: Record<string, React.ReactNode> = {
  viral: (
    <span className="text-[15px] font-black uppercase leading-tight text-white [text-shadow:0_2px_0_#000]">
      To get <span className="text-yellow-300">started</span>
    </span>
  ),
  animated: (
    <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-[15px] font-extrabold leading-tight text-transparent">
      To get started
    </span>
  ),
  emoji: <span className="text-[15px] font-bold leading-tight text-white">To get started 🚀</span>,
  karaoke: (
    <span className="text-[15px] font-black uppercase leading-tight text-white/45">
      To get <span className="rounded bg-violet-500 px-1 text-white">started</span>
    </span>
  ),
};

/* -------------------------------------------------------------- component */

export function UploadForm() {
  const router = useRouter();
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [upload, setUpload] = useState<UploadState>({ progress: 0, done: false, videoId: null, error: null });

  const [clipCount, setClipCount] = useState(5);
  const [durations, setDurations] = useState<number[]>([30, 45, 60]);
  const [captionStyle, setCaptionStyle] = useState("viral");
  const [language, setLanguage] = useState("en");
  const [exportQuality, setExportQuality] = useState("hd");

  const [credits, setCredits] = useState<number | null>(null);
  const [costPerClip, setCostPerClip] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pipeline, setPipeline] = useState<VideoPipeline | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const title = file ? file.name.replace(/\.[^.]+$/, "") : "";
  const totalCost = clipCount * costPerClip;
  const notEnoughCredits = credits !== null && credits < totalCost;
  const estimateSeconds = estimateProcessingSeconds(duration, clipCount);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const res = await apiFetch<Profile>("/api/v1/users/me", { token, skipGlobalLoader: true });
      if (res.success && res.data) {
        setCredits(res.data.credits);
        setCostPerClip(res.data.clip_credit_cost ?? 1);
      }
    })();
  }, []);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    // Removed before Create: delete the half-made upload so it doesn't linger.
    if (phase === "configure" && upload.videoId) void deleteVideoRequest(upload.videoId);
    setPhase("idle");
    setFile(null);
    setThumbnail(null);
    setDuration(null);
    setUpload({ progress: 0, done: false, videoId: null, error: null });
    setError(null);
  }, [phase, upload.videoId]);

  /** Upload starts as soon as a file is picked, while the user sets options. */
  async function startUpload(f: File) {
    setUpload({ progress: 0, done: false, videoId: null, error: null });
    const token = await getAccessToken();
    if (!token) return setUpload((u) => ({ ...u, error: "Please sign in again." }));

    const init = await apiFetch<{ video_id: string; upload_url: string }>("/api/v1/videos/upload", {
      method: "POST",
      token,
      body: JSON.stringify({
        title: f.name.replace(/\.[^.]+$/, ""),
        filename: f.name,
        mime_type: f.type,
        size: f.size,
      }),
    });
    if (!init.success || !init.data) {
      return setUpload((u) => ({ ...u, error: init.error?.message ?? "Could not start the upload." }));
    }
    const videoId = init.data.video_id;
    setUpload((u) => ({ ...u, videoId }));

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUpload((u) => ({ ...u, progress: Math.round((ev.loaded / ev.total) * 100) }));
          }
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("upload")));
        xhr.onerror = () => reject(new Error("upload"));
        xhr.onabort = () => reject(new Error("aborted"));
        xhr.open("PUT", init.data!.upload_url);
        xhr.setRequestHeader("Content-Type", f.type);
        xhr.send(f);
      });
    } catch (e) {
      if ((e as Error).message === "aborted") return;
      return setUpload((u) => ({ ...u, error: "Upload failed. Check your connection and try again." }));
    }
    xhrRef.current = null;
    setUpload({ progress: 100, done: true, videoId, error: null });
  }

  async function onFileSelected(f: File | undefined) {
    if (!f?.type.startsWith("video/")) return;
    setFile(f);
    setError(null);
    setPhase("configure");
    void startUpload(f);
    const preview = await readVideoPreview(f);
    setThumbnail(preview.thumbnail);
    setDuration(preview.duration);
  }

  async function handleCreate() {
    if (!upload.done || !upload.videoId) return;
    setCreating(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setCreating(false);
      return setError("Please sign in again.");
    }
    const res = await apiFetch(`/api/v1/videos/${upload.videoId}/complete`, {
      method: "POST",
      token,
      body: JSON.stringify({
        clip_count: clipCount,
        durations: durations.length ? durations : [...DURATIONS],
        caption_style: captionStyle,
        caption_language: language,
        export_quality: exportQuality,
      }),
    });
    setCreating(false);
    if (!res.success) return setError(res.error?.message ?? "Could not start processing.");

    setPipeline({
      video_id: upload.videoId,
      title,
      status: "processing",
      source_url: null,
      current_step: null,
      steps: [],
      progress_percent: 2,
      clips_created: 0,
    });
    setStartedAt(Date.now());
    setPhase("processing");
  }

  // Poll the pipeline while processing; tick the elapsed timer every second.
  useEffect(() => {
    if (phase !== "processing" || !pipeline?.video_id) return;
    const failed = pipeline.job?.status === "failed" || pipeline.status === "failed";
    if (failed) {
      setError(formatPipelineError(pipeline.job?.error));
      return;
    }
    if (pipeline.status === "ready") {
      router.push(`/clips?video=${pipeline.video_id}`);
      router.refresh();
      return;
    }
    const poll = setInterval(async () => {
      const token = await getAccessToken();
      if (!token) return;
      const res = await apiFetch<VideoPipeline>(`/api/v1/videos/${pipeline.video_id}/pipeline`, {
        token,
        skipGlobalLoader: true,
      });
      if (res.success && res.data) setPipeline(res.data);
    }, PIPELINE_POLL_MS);
    return () => clearInterval(poll);
  }, [phase, pipeline, router]);

  useEffect(() => {
    if (phase !== "processing") return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [phase]);

  useEffect(() => () => xhrRef.current?.abort(), []);

  /* --------------------------------------------------------------- views */

  if (phase === "idle") {
    return (
      <div className={PANEL}>
        <input
          id={FILE_INPUT_ID}
          type="file"
          accept="video/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            void onFileSelected(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label
          htmlFor={FILE_INPUT_ID}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFileSelected(e.dataTransfer.files[0]);
          }}
          className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/12 bg-white/[0.02] px-6 py-20 text-center transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/[0.04]"
        >
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] transition-transform group-hover:-translate-y-1">
            <FileVideo className="h-6 w-6 text-white/80" />
          </span>
          <p className="text-[15px] font-semibold text-white">Drop a video here, or click to browse</p>
          <p className="mt-1.5 text-sm text-white/45">MP4, MOV or WebM. Upload starts right away while you pick your settings.</p>
        </label>
      </div>
    );
  }

  // A render helper, not a component, so the image isn't remounted every tick.
  const thumb = (className?: string) => (
    <div className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900", className)}>
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <FileVideo className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-white/25" />
      )}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );

  if (phase === "processing" && pipeline) {
    const failed = !!error;
    const progress = pipeline.progress_percent ?? 2;
    const activeStep = pipeline.steps.find((s) => s.status === "active")?.label;
    const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
    const liveEta = pipeline.estimated_completion_at
      ? Math.max(0, Math.round((new Date(pipeline.estimated_completion_at).getTime() - now) / 1000))
      : null;
    const remaining = liveEta ?? Math.max(0, estimateSeconds - elapsed);

    return (
      <div className={cn(PANEL, "grid gap-6 p-5 sm:grid-cols-[220px_1fr] sm:p-6")}>
        {thumb("aspect-video sm:aspect-[4/3]")}
        <div className="flex min-w-0 flex-col justify-center">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                  failed ? "border-rose-400/30 text-rose-300" : "border-emerald-400/30 text-emerald-300",
                )}
              >
                {failed ? "Failed" : pipeline.job?.status === "queued" ? "Queued" : "Processing"}
              </span>
              <h2 className="mt-2 truncate text-lg font-bold text-white">{pipeline.title || title}</h2>
            </div>
            {!failed && <Loader2 className="h-6 w-6 shrink-0 animate-spin text-emerald-400" />}
          </div>

          {failed ? (
            <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] p-3 text-sm text-rose-200">
              {error}
              <button type="button" onClick={reset} className="ml-2 font-semibold text-white underline-offset-2 hover:underline">
                Try another video
              </button>
            </div>
          ) : (
            <>
              <Progress value={progress} className="mt-4 h-2" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
                <span>
                  {progress}% · {activeStep ?? (pipeline.job?.status === "queued" ? "Waiting for a worker" : "Preparing")}
                </span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" />Elapsed {formatDuration(elapsed)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{remaining > 0 ? `~${formatEstimate(remaining)} left` : "Finishing up"}</span>
                </span>
              </div>
              <p className="mt-4 text-xs text-white/40">
                You can leave this page — your clips will appear in Clips when they&apos;re ready.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  /* configure */
  const createLabel = upload.error
    ? "Upload failed"
    : !upload.done
      ? `Uploading ${upload.progress}%…`
      : creating
        ? "Starting…"
        : "Create";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="space-y-5">
        {/* Video */}
        <div className={cn(PANEL, "grid gap-5 p-4 sm:grid-cols-[260px_1fr] sm:p-5")}>
          <div className="relative">
            {thumb("aspect-video")}
            <div className="absolute inset-0 flex items-center justify-center">
              {upload.error ? (
                <span className="rounded-lg bg-rose-500/80 px-2.5 py-1 text-xs font-semibold text-white">Upload failed</span>
              ) : upload.done ? (
                <span className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur">
                  <CheckCircle2 className="h-3.5 w-3.5" />Uploaded
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white [text-shadow:0_1px_4px_#000]">
                  <Loader2 className="h-4 w-4 animate-spin" />Uploading {upload.progress}%
                </span>
              )}
            </div>
            {!upload.done && !upload.error && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                <div className="h-full bg-emerald-400 transition-all" style={{ width: `${upload.progress}%` }} />
              </div>
            )}
            <button
              type="button"
              onClick={reset}
              aria-label="Remove video"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur hover:bg-black/80 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-white" title={title}>{title}</p>
              <p className="mt-1 text-xs text-white/45">
                {formatDuration(duration)} · {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}
              </p>
              {upload.error && <p className="mt-2 text-xs text-rose-300">{upload.error}</p>}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <InlineSelect label="Speech language" value={language} onChange={setLanguage} options={LANGUAGES} />
              <InlineSelect label="Quality" value={exportQuality} onChange={setExportQuality} options={EXPORT_QUALITIES} />
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className={cn(PANEL, "space-y-6 p-5 sm:p-6")}>
          <section>
            <SectionTitle icon={Scissors} title="Clipping" />
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <InlineSelect
                label="AI picks"
                value={String(clipCount)}
                onChange={(v) => setClipCount(Number(v))}
                options={CLIP_COUNTS.map((n) => ({ id: String(n), label: `${n} clips` }))}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white/45">Clip length:</span>
                {DURATIONS.map((sec) => {
                  const on = durations.includes(sec);
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() =>
                        setDurations((d) => (on ? d.filter((x) => x !== sec) : [...d, sec].sort((a, b) => a - b)))
                      }
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                        on ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/45 hover:text-white/80",
                      )}
                    >
                      {sec}s
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="border-t border-white/[0.06] pt-6">
            <SectionTitle icon={Captions} title="Captions" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CAPTION_STYLES.map((s) => {
                const on = captionStyle === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => setCaptionStyle(s.id)} className="text-center">
                    <span
                      className={cn(
                        "relative flex h-24 items-center justify-center rounded-xl border-2 bg-[#1b1d1c] px-2 transition-colors",
                        on ? "border-white" : "border-transparent hover:border-white/20",
                      )}
                    >
                      {on && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Selected
                        </span>
                      )}
                      {CAPTION_PREVIEW[s.id]}
                    </span>
                    <span className="mt-2 block text-xs text-white/50">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Summary */}
      <aside className={cn(PANEL, "p-5 lg:sticky lg:top-24")}>
        <h3 className="text-[15px] font-semibold text-white">Summary</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Video length" value={formatDuration(duration)} />
          <Row label="Clips" value={`${clipCount}`} />
          <Row label="Clip length" value={durations.length ? durations.map((d) => `${d}s`).join(", ") : "Auto"} />
          <Row label="Captions" value={CAPTION_STYLES.find((s) => s.id === captionStyle)?.label ?? "–"} />
          <Row label="Processing time" value={`~${formatEstimate(estimateSeconds)}`} icon={Clock} />
        </dl>
        <div className="my-4 border-t border-white/[0.08]" />
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-white">Total</span>
          <span className="flex items-center gap-1 font-semibold text-white">
            <Zap className="h-4 w-4 fill-amber-400 text-amber-400" />
            {totalCost} credits
          </span>
        </div>
        {credits !== null && (
          <p className={cn("mt-1 text-right text-xs", notEnoughCredits ? "text-rose-300" : "text-white/40")}>
            {notEnoughCredits ? `You have ${credits} — pick fewer clips or add credits` : `${credits} available`}
          </p>
        )}

        {error && <p className="mt-4 rounded-lg border border-rose-500/25 bg-rose-500/[0.08] p-2.5 text-xs text-rose-200">{error}</p>}

        <button
          type="button"
          onClick={handleCreate}
          disabled={!upload.done || creating || notEnoughCredits}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/60"
        >
          {(creating || (!upload.done && !upload.error)) && <Loader2 className="h-4 w-4 animate-spin" />}
          {createLabel}
        </button>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">
          By continuing, you confirm you have the rights to use this video.
        </p>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------ small parts */

const PANEL = "rounded-2xl border border-white/[0.08] bg-[#111312]";

function SectionTitle({ icon: Icon, title }: { icon: typeof Scissors; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[15px] font-semibold text-white">{title}</span>
    </div>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Clock }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-white/50">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className="truncate text-right text-white/85">{value}</dd>
    </div>
  );
}

function InlineSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ id: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-1.5 text-white/45">
      {label}:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-md bg-transparent py-0.5 font-medium text-white outline-none hover:text-emerald-200 focus-visible:ring-1 focus-visible:ring-emerald-400"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-zinc-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
