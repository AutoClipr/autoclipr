"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, Film, Instagram, Loader2, Upload, X, Youtube } from "lucide-react";
import { getAccessToken } from "@/lib/auth-token";
import { apiFetch, type Clip, type PlatformConnection } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  SCHEDULER_PLATFORMS,
  formatDateTime,
  timeZoneOptions,
  utcToZoned,
  viewerTimeZone,
  zonedToUtcIso,
  type ScheduledPost,
  type SchedulerPlatform,
} from "@/lib/scheduler";

const STEPS = ["Media", "Accounts", "Content", "Schedule", "Review"] as const;
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-m4v";

type Media =
  | { kind: "clip"; clipId: string; title: string; thumbnail: string | null; duration: number | null }
  | { kind: "upload"; path: string; name: string; duration: number | null; previewUrl: string };

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "youtube") return <Youtube className={cn("text-red-400", className)} />;
  if (platform === "instagram") return <Instagram className={cn("text-pink-400", className)} />;
  return <Film className={className} />;
}

/** Reads duration and size of a local video before uploading it. */
function probeVideo(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file could not be read as a video."));
    };
    v.src = url;
  });
}

export function ScheduleComposer({
  open,
  onClose,
  onSaved,
  initialDate,
  startWithUpload,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** "YYYY-MM-DD" when opened from a calendar day. */
  initialDate?: string | null;
  startWithUpload?: boolean;
  editing?: ScheduledPost | null;
}) {
  const tz0 = viewerTimeZone();
  const [step, setStep] = useState(0);
  const [mediaTab, setMediaTab] = useState<"library" | "upload">("library");
  const [media, setMedia] = useState<Media | null>(null);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [connections, setConnections] = useState<PlatformConnection[] | null>(null);
  const [selected, setSelected] = useState<SchedulerPlatform[]>([]);
  const [overrides, setOverrides] = useState<Partial<Record<SchedulerPlatform, string>>>({});
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [timeZone, setTimeZone] = useState(tz0);
  const [upload, setUpload] = useState<{ progress: number; error: string | null } | null>(null);
  const [saving, setSaving] = useState<"draft" | "scheduled" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the composer opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setUpload(null);
    setSaving(null);
    if (editing) {
      const tz = editing.timezone || tz0;
      const when = editing.scheduled_at ? utcToZoned(editing.scheduled_at, tz) : null;
      setStep(0);
      setMediaTab(editing.clip_id ? "library" : "upload");
      setMedia(
        editing.clip_id
          ? { kind: "clip", clipId: editing.clip_id, title: editing.title ?? "Clip", thumbnail: editing.media_thumbnail_url, duration: editing.media_duration_seconds }
          : { kind: "upload", path: editing.media_storage_path, name: "Uploaded video", duration: editing.media_duration_seconds, previewUrl: "" },
      );
      setSelected(editing.scheduled_post_targets.map((t) => t.platform));
      setOverrides(
        Object.fromEntries(editing.scheduled_post_targets.filter((t) => t.caption_override).map((t) => [t.platform, t.caption_override!])),
      );
      setTitle(editing.title ?? "");
      setCaption(editing.caption ?? "");
      setDescription(editing.description ?? "");
      setHashtags(editing.hashtags ?? "");
      setTimeZone(tz);
      setDate(when?.date ?? "");
      setTime(when?.time ?? "18:00");
    } else {
      setStep(0);
      setMediaTab(startWithUpload ? "upload" : "library");
      setMedia(null);
      setSelected([]);
      setOverrides({});
      setTitle("");
      setCaption("");
      setDescription("");
      setHashtags("");
      setTimeZone(tz0);
      setDate(initialDate ?? "");
      setTime("18:00");
    }
  }, [open, editing, initialDate, startWithUpload, tz0]);

  // Load clips and connected accounts once per open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const [c, p] = await Promise.all([
        apiFetch<Clip[]>("/api/v1/clips?limit=60", { token }),
        apiFetch<PlatformConnection[]>("/api/v1/platforms", { token }),
      ]);
      if (cancelled) return;
      setClips((c.data ?? []).filter((x) => x.status === "completed"));
      setConnections(p.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, saving, onClose]);

  const usable = useMemo(
    () =>
      SCHEDULER_PLATFORMS.map((p) => {
        const conn = connections?.find((c) => c.platform === p.id);
        return { ...p, ready: !!conn && conn.auth_status === "authorized" && conn.has_tokens !== false, name: conn?.account_name };
      }),
    [connections],
  );

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("video/")) return setUpload({ progress: 0, error: "Choose a video file (MP4, MOV, WebM)." });
    if (file.size > MAX_UPLOAD_BYTES) return setUpload({ progress: 0, error: "That file is over 500 MB." });
    let meta: { duration: number; width: number; height: number };
    try {
      meta = await probeVideo(file);
    } catch (e) {
      return setUpload({ progress: 0, error: (e as Error).message });
    }
    if (meta.duration > 180) {
      return setUpload({ progress: 0, error: "Shorts and Reels must be 3 minutes or shorter." });
    }
    setUpload({ progress: 0, error: null });
    const token = await getAccessToken();
    if (!token) return;
    const init = await apiFetch<{ upload_url: string; media_storage_path: string }>("/api/v1/scheduled-posts/uploads", {
      method: "POST",
      token,
      body: JSON.stringify({ filename: file.name, mime_type: file.type, size: file.size }),
    });
    if (!init.success || !init.data) {
      return setUpload({ progress: 0, error: init.error?.message ?? "Could not start the upload." });
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => ev.lengthComputable && setUpload({ progress: Math.round((ev.loaded / ev.total) * 100), error: null });
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error()));
        xhr.onerror = () => reject(new Error());
        xhr.open("PUT", init.data!.upload_url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
    } catch {
      return setUpload({ progress: 0, error: "Upload failed. Check your connection and try again." });
    }
    setUpload(null);
    setMedia({
      kind: "upload",
      path: init.data.media_storage_path,
      name: file.name,
      duration: Math.round(meta.duration),
      previewUrl: URL.createObjectURL(file),
    });
    if (meta.width > meta.height) {
      setError("Heads up: this video is landscape. Shorts and Reels look best vertical (9:16).");
    }
  }

  const scheduledIso = date && time ? zonedToUtcIso(date, time, timeZone) : null;

  function stepError(s: number): string | null {
    if (s === 0 && !media) return "Choose a clip or upload a video.";
    if (s === 1 && !selected.length) return "Pick at least one account.";
    if (s === 3) {
      if (!scheduledIso) return "Pick a date and time.";
      if (new Date(scheduledIso).getTime() < Date.now() + 60_000) return "Pick a time at least a minute from now.";
    }
    return null;
  }

  function next() {
    const e = stepError(step);
    if (e) return setError(e);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function save(status: "draft" | "scheduled") {
    if (status === "scheduled") {
      for (let s = 0; s < 4; s++) {
        const e = stepError(s);
        if (e) {
          setStep(s);
          return setError(e);
        }
      }
    } else if (!media) {
      setStep(0);
      return setError("Choose a clip or upload a video.");
    }
    setSaving(status);
    setError(null);
    const token = await getAccessToken();
    if (!token) return;
    const body = {
      ...(media!.kind === "clip" ? { clip_id: media!.clipId } : { media_storage_path: media!.path, media_duration_seconds: media!.duration ?? undefined }),
      title: title || undefined,
      caption,
      description: description || undefined,
      hashtags: hashtags || undefined,
      targets: selected.map((platform) => ({ platform, ...(overrides[platform]?.trim() ? { caption_override: overrides[platform] } : {}) })),
      ...(scheduledIso ? { scheduled_at: scheduledIso } : {}),
      timezone: timeZone,
      status,
    };
    const res = await apiFetch(editing ? `/api/v1/scheduled-posts/${editing.id}` : "/api/v1/scheduled-posts", {
      method: editing ? "PATCH" : "POST",
      token,
      body: JSON.stringify(body),
    });
    setSaving(null);
    if (!res.success) return setError(res.error?.message ?? "Could not save the post.");
    onSaved();
    onClose();
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-title"
    >
      <div className="relative my-4 flex w-full max-w-2xl flex-col rounded-3xl border border-white/10 bg-[#0b0f14] shadow-2xl">
        {/* Header + stepper */}
        <div className="border-b border-white/[0.06] px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="composer-title" className="text-xl font-bold text-white">
              {editing ? "Edit post" : "Schedule a post"}
            </h2>
            <button
              type="button"
              aria-label="Close"
              disabled={!!saving}
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ol className="mt-4 flex gap-1.5 overflow-x-auto">
            {STEPS.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => (i < step || !stepError(Math.max(0, i - 1)) ? setStep(i) : undefined)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    i === step ? "bg-white text-black" : i < step ? "bg-emerald-500/15 text-emerald-200" : "bg-white/[0.05] text-white/50",
                  )}
                >
                  {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                  {s}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="min-h-[18rem] px-5 py-5 sm:px-6">
          {/* Step 1 — media */}
          {step === 0 && (
            <div>
              <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
                {(["library", "upload"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMediaTab(t)}
                    className={cn("rounded-full px-4 py-1.5 text-sm", mediaTab === t ? "bg-white font-semibold text-black" : "text-white/60")}
                  >
                    {t === "library" ? "AutoClipr library" : "Upload video"}
                  </button>
                ))}
              </div>

              {mediaTab === "library" ? (
                clips === null ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
                ) : clips.length === 0 ? (
                  <p className="py-10 text-center text-sm text-white/50">
                    No finished clips yet. <Link href="/create" className="text-emerald-300 hover:underline">Create some</Link> or upload a video.
                  </p>
                ) : (
                  <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                    {clips.map((c) => {
                      const active = media?.kind === "clip" && media.clipId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setMedia({ kind: "clip", clipId: c.id, title: c.title, thumbnail: c.thumbnail_url ?? null, duration: c.duration_seconds ?? null })}
                          className={cn(
                            "group relative aspect-[9/16] overflow-hidden rounded-xl border bg-black text-left",
                            active ? "border-emerald-400 ring-2 ring-emerald-400/50" : "border-white/10 hover:border-white/30",
                          )}
                        >
                          {c.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <Film className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white/30" />
                          )}
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 text-[10px] leading-tight text-white">
                            <span className="line-clamp-2">{c.title}</span>
                            {c.duration_seconds ? <span className="text-white/60">{Math.round(c.duration_seconds)}s</span> : null}
                          </span>
                          {active && (
                            <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-black">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div>
                  {media?.kind === "upload" ? (
                    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      {media.previewUrl ? (
                        <video src={media.previewUrl} className="h-28 w-16 rounded-lg bg-black object-cover" muted playsInline controls={false} />
                      ) : (
                        <span className="flex h-28 w-16 items-center justify-center rounded-lg bg-black"><Film className="h-5 w-5 text-white/30" /></span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{media.name}</p>
                        {media.duration ? <p className="text-xs text-white/50">{media.duration}s</p> : null}
                        <button type="button" onClick={() => setMedia(null)} className="mt-2 text-xs text-white/60 underline-offset-4 hover:underline">
                          Replace video
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center transition-colors hover:border-white/30">
                      <input
                        type="file"
                        accept={ACCEPT}
                        className="sr-only"
                        disabled={!!upload && !upload.error}
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      />
                      {upload && !upload.error ? (
                        <>
                          <Loader2 className="mb-3 h-6 w-6 animate-spin text-emerald-300" />
                          <p className="text-sm text-white">Uploading… {upload.progress}%</p>
                          <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${upload.progress}%` }} />
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="mb-3 h-6 w-6 text-white/50" />
                          <p className="font-medium text-white">Choose a video from your device</p>
                          <p className="mt-1 text-xs text-white/45">MP4, MOV or WebM · up to 500 MB · 3 min max · vertical works best</p>
                        </>
                      )}
                      {upload?.error && <p className="mt-3 text-sm text-rose-300">{upload.error}</p>}
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — accounts */}
          {step === 1 && (
            <div className="space-y-2">
              {connections === null ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
              ) : (
                <>
                  {usable.map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={!p.ready}
                        onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                          on ? "border-emerald-400/50 bg-emerald-500/[0.08]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                          !p.ready && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <PlatformIcon platform={p.id} className="h-5 w-5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">{p.label}</p>
                          <p className="truncate text-xs text-white/45">{p.ready ? p.name || "Connected" : "Not connected or not authorized"}</p>
                        </div>
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", on ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/20")}>
                          {on && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                  {usable.some((p) => !p.ready) && (
                    <p className="pt-1 text-xs text-white/45">
                      Connect accounts in <Link href="/setup/platforms" className="text-emerald-300 hover:underline">Settings → Platforms</Link>. Facebook and TikTok publishing are coming later.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3 — content */}
          {step === 2 && (
            <div className="space-y-3">
              {selected.includes("youtube") && (
                <Field label="YouTube title" hint={`${title.length}/100`}>
                  <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the first line of the caption" className={inputCls} />
                </Field>
              )}
              <Field label="Caption" hint={`${caption.length}/2200`}>
                <textarea value={caption} maxLength={2200} rows={4} onChange={(e) => setCaption(e.target.value)} placeholder="What's this video about?" className={cn(inputCls, "resize-none")} />
              </Field>
              <Field label="Hashtags">
                <input value={hashtags} maxLength={500} onChange={(e) => setHashtags(e.target.value)} placeholder="#shorts #creator" className={inputCls} />
              </Field>
              <Field label="Description (optional)">
                <textarea value={description} maxLength={5000} rows={2} onChange={(e) => setDescription(e.target.value)} placeholder="Extra text added after the caption" className={cn(inputCls, "resize-none")} />
              </Field>
              {selected.length > 1 && (
                <details className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <summary className="cursor-pointer text-sm text-white/70">Customize caption per platform</summary>
                  <div className="mt-3 space-y-3">
                    {selected.map((p) => (
                      <Field key={p} label={SCHEDULER_PLATFORMS.find((x) => x.id === p)?.label ?? p}>
                        <textarea
                          value={overrides[p] ?? ""}
                          rows={2}
                          maxLength={2200}
                          onChange={(e) => setOverrides((o) => ({ ...o, [p]: e.target.value }))}
                          placeholder="Leave empty to use the main caption"
                          className={cn(inputCls, "resize-none")}
                        />
                      </Field>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Step 4 — schedule */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputCls, "[color-scheme:dark]")} />
                </Field>
                <Field label="Time">
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cn(inputCls, "[color-scheme:dark]")} />
                </Field>
              </div>
              <Field label="Timezone">
                <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={cn(inputCls, "[color-scheme:dark]")}>
                  {timeZoneOptions(tz0).map((z) => (
                    <option key={z} value={z} className="bg-zinc-900">{z}</option>
                  ))}
                </select>
              </Field>
              {scheduledIso && (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80">
                  Publishes <span className="font-semibold text-white">{formatDateTime(scheduledIso, timeZone)}</span> ({timeZone})
                </p>
              )}
            </div>
          )}

          {/* Step 5 — review */}
          {step === 4 && (
            <dl className="space-y-2.5 text-sm">
              <Summary label="Video">{media ? (media.kind === "clip" ? media.title : media.name) : "—"}</Summary>
              <Summary label="Accounts">
                <span className="flex flex-wrap justify-end gap-1.5">
                  {selected.length
                    ? selected.map((p) => (
                        <span key={p} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs">
                          <PlatformIcon platform={p} className="h-3 w-3" /> {SCHEDULER_PLATFORMS.find((x) => x.id === p)?.short}
                        </span>
                      ))
                    : "—"}
                </span>
              </Summary>
              <Summary label="Caption"><span className="line-clamp-3">{caption || "—"}</span></Summary>
              {hashtags && <Summary label="Hashtags">{hashtags}</Summary>}
              <Summary label="Date & time">{scheduledIso ? formatDateTime(scheduledIso, timeZone) : "Not set"}</Summary>
              <Summary label="Timezone">{timeZone}</Summary>
            </dl>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-sm text-rose-200">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            disabled={!!saving}
            onClick={() => save("draft")}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition-colors hover:bg-white/[0.06]"
          >
            {saving === "draft" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save as draft"}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="flex-1 rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 hover:bg-white/[0.06] sm:flex-none">
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="flex-1 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:opacity-90 sm:flex-none">
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={!!saving}
                onClick={() => save("scheduled")}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black shadow-[0_0_20px_-4px_rgba(255,255,255,0.55)] hover:opacity-90 sm:flex-none"
              >
                {saving === "scheduled" && <Loader2 className="h-4 w-4 animate-spin" />}
                Schedule post
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/25";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs font-medium text-white/55">
        {label}
        {hint && <span className="text-white/35">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-xl bg-white/[0.03] px-3 py-2">
      <dt className="shrink-0 text-white/50">{label}</dt>
      <dd className="min-w-0 text-right text-white/85">{children}</dd>
    </div>
  );
}
