"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { deleteVideoRequest } from "@/lib/delete-video";
import { cn } from "@/lib/utils";
import {
  ClipSettingsPanel,
  PANEL,
  PlanLimitHint,
  ProcessingCard,
  PublishTargets,
  StepHeader,
  SummaryPanel,
  VideoThumb,
  estimateProcessingSeconds,
  formatDuration,
  useClipOptions,
  useCredits,
} from "./create-shared";

const FILE_INPUT_ID = "autoclipr-video-upload";

type Phase = "idle" | "checking" | "duplicate" | "configure" | "processing";
type Duplicate = { id: string; title: string; status: string; created_at: string };
type UploadState = { progress: number; done: boolean; videoId: string | null; error: string | null };

/** A frame about a second in, plus duration, read locally before upload. */
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

export function UploadForm() {
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const opts = useClipOptions();
  const { credits, costPerClip, tier, maxVideoSeconds } = useCredits();

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [upload, setUpload] = useState<UploadState>({ progress: 0, done: false, videoId: null, error: null });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const title = file ? file.name.replace(/\.[^.]+$/, "") : "";

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
    setDuplicate(null);
  }, [phase, upload.videoId]);

  useEffect(() => () => xhrRef.current?.abort(), []);

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

  /** Has this account already uploaded the same video (same name and length)? */
  async function findDuplicate(f: File, seconds: number | null): Promise<Duplicate | null> {
    const token = await getAccessToken();
    if (!token) return null;
    const q = new URLSearchParams({ title: f.name.replace(/\.[^.]+$/, ""), size: String(f.size) });
    if (seconds != null) q.set("duration", String(Math.round(seconds)));
    const res = await apiFetch<{ duplicate: Duplicate | null }>(`/api/v1/videos/duplicate?${q}`, {
      token,
      skipGlobalLoader: true,
    });
    return res.success ? (res.data?.duplicate ?? null) : null;
  }

  async function onFileSelected(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setPickError(`"${f.name}" isn't a video. Choose an MP4, MOV or WebM file.`);
      return;
    }
    setPickError(null);
    setFile(f);
    setError(null);
    setPhase("checking");
    const preview = await readVideoPreview(f);
    // Too long for the plan: stop before uploading (the server enforces this too).
    if (preview.duration != null && preview.duration > maxVideoSeconds + 5) {
      setFile(null);
      setPhase("idle");
      setPickError(
        `This video is ${formatDuration(preview.duration)} long. Your plan supports videos up to ${Math.round(maxVideoSeconds / 60)} minutes — trim it or upgrade your plan.`,
      );
      return;
    }
    setThumbnail(preview.thumbnail);
    setDuration(preview.duration);

    const dup = await findDuplicate(f, preview.duration);
    if (dup) {
      setDuplicate(dup);
      setPhase("duplicate");
      return;
    }
    setPhase("configure");
    void startUpload(f);
  }

  /** Upload failed: drop the half-made record and try the same file again. */
  function retryUpload() {
    if (!file) return;
    if (upload.videoId) void deleteVideoRequest(upload.videoId);
    void startUpload(file);
  }

  function uploadAnyway() {
    if (!file) return;
    setDuplicate(null);
    setPhase("configure");
    void startUpload(file);
  }

  async function handleCreate() {
    if (!upload.done || !upload.videoId || creating) return;
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
        ...opts.payload(),
        // Lets the API reject an over-length video before charging; the
        // worker re-checks the real length either way.
        ...(duration != null ? { source_duration_seconds: Math.round(duration) } : {}),
      }),
    });
    setCreating(false);
    if (!res.success) return setError(res.error?.message ?? "Could not start processing.");
    setPhase("processing");
  }

  if (phase === "idle") {
    return (
      <section className={cn(PANEL, "p-5 sm:p-6")}>
        <StepHeader step="01" title="Video source" description="Upload a video from your computer." />
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
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void onFileSelected(e.dataTransfer.files[0]);
          }}
          className={cn(
            "group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
            dragging
              ? "border-[#54D045]/70 bg-[#54D045]/[0.06]"
              : "border-[#253244] bg-[#0A111B] hover:border-[#54D045]/40 hover:bg-[#54D045]/[0.03]",
          )}
        >
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#54D045]/25 bg-[#54D045]/10 transition-transform group-hover:-translate-y-1">
            <UploadCloud className="h-6 w-6 text-[#8fe383]" />
          </span>
          <p className="text-[15px] font-semibold text-[#F8FAFC]">
            {dragging ? "Drop to upload" : "Drag & drop a video here"}
          </p>
          <p className="mt-1.5 text-sm text-[#94A3B8]">MP4, MOV or WebM. Upload starts right away while you pick settings.</p>
          <span className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#F8FAFC] px-4 text-sm font-semibold text-[#070B12] group-hover:bg-white">
            Browse files
          </span>
        </label>
        <PlanLimitHint tier={tier} />
        {pickError && (
          <p className="mt-3 text-sm text-[#fca5a5]" role="alert">
            {pickError}
          </p>
        )}
      </section>
    );
  }

  if (phase === "checking") {
    return (
      <div className={cn(PANEL, "flex items-center justify-center gap-3 px-6 py-20 text-sm text-white/60")}>
        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
        Checking your video…
      </div>
    );
  }

  if (phase === "duplicate" && duplicate) {
    const when = new Date(duplicate.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return (
      <div className={cn(PANEL, "grid gap-5 p-5 sm:grid-cols-[260px_1fr] sm:p-6")}>
        <VideoThumb src={thumbnail} className="aspect-video" />
        <div className="flex min-w-0 flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Already uploaded
          </span>
          <h2 className="mt-3 text-lg font-bold text-white">This video is already in your account</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">
            You uploaded <span className="font-semibold text-white">{duplicate.title}</span> with the same length on{" "}
            {when}. Uploading it again will use credits for clips you may already have.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/clips?video=${duplicate.id}`}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:opacity-90"
            >
              View its clips
            </Link>
            <button
              type="button"
              onClick={uploadAnyway}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.06]"
            >
              Upload anyway
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/55 hover:text-white"
            >
              Choose another video
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "processing" && upload.videoId) {
    return (
      <ProcessingCard
        videoId={upload.videoId}
        title={title}
        thumbnail={thumbnail}
        estimateSeconds={estimateProcessingSeconds(duration, opts.clipCount)}
        onReset={reset}
      />
    );
  }

  const buttonLabel = upload.error
    ? "Upload failed"
    : !upload.done
      ? `Uploading ${upload.progress}%…`
      : creating
        ? "Starting…"
        : "Generate Viral Clips";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="min-w-0 space-y-5">
        <section className={cn(PANEL, "p-5 sm:p-6")}>
          <StepHeader step="01" title="Video source" />
          <div className="grid gap-5 sm:grid-cols-[240px_1fr]">
          <VideoThumb src={thumbnail} className="aspect-video">
            <div className="absolute inset-0 flex items-center justify-center">
              {upload.error ? (
                <span className="rounded-lg bg-rose-500/80 px-2.5 py-1 text-xs font-semibold text-white">Upload failed</span>
              ) : upload.done ? (
                <span className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Uploaded
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white [text-shadow:0_1px_4px_#000]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading {upload.progress}%
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label="Remove video"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur hover:bg-black/80 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </VideoThumb>

          <div className="flex min-w-0 flex-col justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[#F8FAFC]" title={title}>
                {title}
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                {formatDuration(duration)} · {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}
              </p>
              {upload.error && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-[#fca5a5]">{upload.error}</p>
                  <button
                    type="button"
                    onClick={retryUpload}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#253244] px-2.5 text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.04]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Retry upload
                  </button>
                </div>
              )}
              {!upload.error && (
                <div className="mt-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#0A111B]">
                    <div
                      className="h-full rounded-full bg-[#54D045] transition-[width] duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-[#94A3B8]">
                    {upload.done ? "Upload complete" : `Uploading… ${upload.progress}%`}
                  </p>
                </div>
              )}
            </div>
          </div>
          </div>
        </section>

        <ClipSettingsPanel opts={opts}>
          <PublishTargets opts={opts} />
        </ClipSettingsPanel>
      </div>

      <SummaryPanel
        opts={opts}
        videoSeconds={duration}
        credits={credits}
        costPerClip={costPerClip}
        error={error}
        buttonLabel={buttonLabel}
        busy={creating || (!upload.done && !upload.error)}
        disabled={!upload.done}
        onCreate={handleCreate}
      />
    </div>
  );
}
