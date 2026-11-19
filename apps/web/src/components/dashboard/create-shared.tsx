"use client";

/**
 * Shared building blocks for the Create screen (both the "From URL" and
 * "Upload File" tabs): clip settings, the summary panel with credits and
 * processing time, and the processing card with elapsed / remaining time.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Captions, Clock, FileVideo, Loader2, Scissors, Timer, Zap } from "lucide-react";
import { apiFetch, type Profile, type VideoPipeline } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { formatPipelineError } from "@/lib/pipeline-errors";
import { CAPTION_STYLES, DURATIONS, EXPORT_QUALITIES, LANGUAGES } from "@/lib/video-sources";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const PANEL = "rounded-2xl border border-white/[0.08] bg-[#111312]";
export const CLIP_COUNTS = [5, 8, 10, 15, 20];
const PIPELINE_POLL_MS = 3000;

/* ------------------------------------------------------------------ helpers */

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "–";
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * Rough processing time before live progress exists: download/transcribe
 * scales with video length, rendering with the number of clips.
 */
export function estimateProcessingSeconds(videoSeconds: number | null, clipCount: number): number {
  const length = videoSeconds ?? 600;
  return Math.round(45 + length * 0.35 + clipCount * 15);
}

export function formatEstimate(seconds: number): string {
  if (seconds < 90) return "about 1 min";
  const low = Math.max(1, Math.floor(seconds / 60));
  const high = Math.ceil((seconds * 1.4) / 60);
  return low === high ? `about ${low} min` : `${low}–${high} min`;
}

/* -------------------------------------------------------------------- hooks */

export type ClipOptions = ReturnType<typeof useClipOptions>;

export function useClipOptions() {
  const [clipCount, setClipCount] = useState(5);
  const [durations, setDurations] = useState<number[]>([30, 45, 60]);
  const [captionStyle, setCaptionStyle] = useState("viral");
  const [language, setLanguage] = useState("en");
  const [exportQuality, setExportQuality] = useState("hd");
  return {
    clipCount,
    setClipCount,
    durations,
    setDurations,
    captionStyle,
    setCaptionStyle,
    language,
    setLanguage,
    exportQuality,
    setExportQuality,
    /** Body fields shared by import-url and upload complete. */
    payload: () => ({
      clip_count: clipCount,
      durations: durations.length ? durations : [...DURATIONS],
      caption_style: captionStyle,
      caption_language: language,
      export_quality: exportQuality,
    }),
  };
}

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null);
  const [costPerClip, setCostPerClip] = useState(1);
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
  return { credits, costPerClip };
}

/* ---------------------------------------------------------- small pieces */

export function SectionTitle({ icon: Icon, title }: { icon: typeof Scissors; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[15px] font-semibold text-white">{title}</span>
    </div>
  );
}

export function InlineSelect({
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

/** Language + quality, shown under the video on both tabs. */
export function VideoOptionsRow({ opts }: { opts: ClipOptions }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      <InlineSelect label="Speech language" value={opts.language} onChange={opts.setLanguage} options={LANGUAGES} />
      <InlineSelect label="Quality" value={opts.exportQuality} onChange={opts.setExportQuality} options={EXPORT_QUALITIES} />
    </div>
  );
}

/** Thumbnail tile with a dimmed overlay; children render on top. */
export function VideoThumb({
  src,
  className,
  children,
}: {
  src: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <FileVideo className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-white/25" />
      )}
      <div className="absolute inset-0 bg-black/35" />
      {children}
    </div>
  );
}

/* ---------------------------------------------------------- settings panel */

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

/** Clipping + captions settings; extra sections (e.g. platforms) go in children. */
export function ClipSettingsPanel({ opts, children }: { opts: ClipOptions; children?: React.ReactNode }) {
  return (
    <div className={cn(PANEL, "space-y-6 p-5 sm:p-6")}>
      <section>
        <SectionTitle icon={Scissors} title="Clipping" />
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <InlineSelect
            label="AI picks"
            value={String(opts.clipCount)}
            onChange={(v) => opts.setClipCount(Number(v))}
            options={CLIP_COUNTS.map((n) => ({ id: String(n), label: `${n} clips` }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-white/45">Clip length:</span>
            {DURATIONS.map((sec) => {
              const on = opts.durations.includes(sec);
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() =>
                    opts.setDurations((d) => (on ? d.filter((x) => x !== sec) : [...d, sec].sort((a, b) => a - b)))
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
            const on = opts.captionStyle === s.id;
            return (
              <button key={s.id} type="button" onClick={() => opts.setCaptionStyle(s.id)} className="text-center">
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

      {children}
    </div>
  );
}

/* ----------------------------------------------------------- summary panel */

export function SummaryPanel({
  opts,
  videoSeconds,
  videoLengthLabel,
  credits,
  costPerClip,
  error,
  buttonLabel,
  busy,
  disabled,
  onCreate,
}: {
  opts: ClipOptions;
  videoSeconds: number | null;
  /** Shown instead of a duration when it isn't known yet (e.g. URL imports). */
  videoLengthLabel?: string;
  credits: number | null;
  costPerClip: number;
  error: string | null;
  buttonLabel: string;
  busy: boolean;
  disabled: boolean;
  onCreate: () => void;
}) {
  const totalCost = opts.clipCount * costPerClip;
  const notEnough = credits !== null && credits < totalCost;
  const estimate = estimateProcessingSeconds(videoSeconds, opts.clipCount);

  return (
    <aside className={cn(PANEL, "p-5 lg:sticky lg:top-24")}>
      <h3 className="text-[15px] font-semibold text-white">Summary</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Video length" value={videoSeconds != null ? formatDuration(videoSeconds) : (videoLengthLabel ?? "–")} />
        <Row label="Clips" value={`${opts.clipCount}`} />
        <Row
          label="Clip length"
          value={opts.durations.length ? opts.durations.map((d) => `${d}s`).join(", ") : "Auto"}
        />
        <Row label="Captions" value={CAPTION_STYLES.find((s) => s.id === opts.captionStyle)?.label ?? "–"} />
        <Row
          label="Processing time"
          value={videoSeconds != null ? `~${formatEstimate(estimate)}` : "Depends on length"}
          icon={Clock}
        />
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
        <p className={cn("mt-1 text-right text-xs", notEnough ? "text-rose-300" : "text-white/40")}>
          {notEnough ? `You have ${credits} — pick fewer clips or add credits` : `${credits} available`}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-rose-500/25 bg-rose-500/[0.08] p-2.5 text-xs text-rose-200">{error}</p>
      )}

      <button
        type="button"
        onClick={onCreate}
        disabled={disabled || busy || notEnough}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {buttonLabel}
      </button>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">
        By continuing, you confirm you have the rights to use this video.
      </p>
    </aside>
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

/* --------------------------------------------------------- processing card */

/**
 * Polls the pipeline, shows progress with elapsed and remaining time, and
 * opens the clips once the video is ready.
 */
export function ProcessingCard({
  videoId,
  title,
  thumbnail,
  estimateSeconds,
  onReset,
}: {
  videoId: string;
  title: string;
  thumbnail: string | null;
  estimateSeconds: number | null;
  onReset: () => void;
}) {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<VideoPipeline | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const failed = pipeline?.job?.status === "failed" || pipeline?.status === "failed";
  const ready = pipeline?.status === "ready";

  useEffect(() => {
    if (failed) return;
    if (ready) {
      router.push(`/clips?video=${videoId}`);
      router.refresh();
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      const res = await apiFetch<VideoPipeline>(`/api/v1/videos/${videoId}/pipeline`, {
        token,
        skipGlobalLoader: true,
      });
      if (!cancelled && res.success && res.data) setPipeline(res.data);
    };
    void poll();
    const id = setInterval(poll, PIPELINE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [videoId, failed, ready, router]);

  useEffect(() => {
    if (failed) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [failed]);

  const progress = pipeline?.progress_percent ?? 2;
  const queued = pipeline?.job?.status === "queued";
  const activeStep = pipeline?.steps.find((s) => s.status === "active")?.label;
  const elapsed = Math.floor((now - startedAt) / 1000);
  const liveEta = pipeline?.estimated_completion_at
    ? Math.max(0, Math.round((new Date(pipeline.estimated_completion_at).getTime() - now) / 1000))
    : null;
  const remaining = liveEta ?? (estimateSeconds != null ? Math.max(0, estimateSeconds - elapsed) : null);

  return (
    <div className={cn(PANEL, "grid gap-6 p-5 sm:grid-cols-[220px_1fr] sm:p-6")}>
      <VideoThumb src={thumbnail} className="aspect-video sm:aspect-[4/3]" />
      <div className="flex min-w-0 flex-col justify-center">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                failed ? "border-rose-400/30 text-rose-300" : "border-emerald-400/30 text-emerald-300",
              )}
            >
              {failed ? "Failed" : queued ? "Queued" : "Processing"}
            </span>
            <h2 className="mt-2 truncate text-lg font-bold text-white">{pipeline?.title || title}</h2>
          </div>
          {!failed && <Loader2 className="h-6 w-6 shrink-0 animate-spin text-emerald-400" />}
        </div>

        {failed ? (
          <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] p-3 text-sm text-rose-200">
            {formatPipelineError(pipeline?.job?.error)}{" "}
            <button type="button" onClick={onReset} className="font-semibold text-white underline-offset-2 hover:underline">
              Try another video
            </button>
          </div>
        ) : (
          <>
            <Progress value={progress} className="mt-4 h-2" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
              <span>
                {progress}% · {activeStep ?? (queued ? "Waiting for a worker" : "Preparing")}
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  Elapsed {formatDuration(elapsed)}
                </span>
                {remaining != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {remaining > 0 ? `~${formatEstimate(remaining)} left` : "Finishing up"}
                  </span>
                )}
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
