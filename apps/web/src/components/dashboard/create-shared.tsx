"use client";

/**
 * Shared building blocks for the Create screen (both the "From URL" and
 * "Upload File" tabs): clip settings, publishing targets, the summary panel
 * with credits and processing time, and the processing card.
 */

import { DEFAULT_LAYOUT, LayoutBar, layoutSummary, type LayoutConfig, type SubtitleInfo } from "./layout-subtitles";
import { BrandKitPicker } from "@/components/brand-kit/brand-kit-picker";
import { CAPTION_PRESETS, type BrandKit } from "@/lib/brand-kits";
import { formatMinutes, maxVideoSecondsFor } from "@/lib/plans";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Captions,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  FileVideo,
  LayoutGrid,
  Loader2,
  Send,
  Sparkles,
  Timer,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { apiFetch, type PlatformConnection, type Profile, type VideoPipeline } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { formatPipelineError } from "@/lib/pipeline-errors";
import { CAPTION_STYLES, DURATIONS, EXPORT_QUALITIES, LANGUAGES, PLATFORMS, formatClipLength } from "@/lib/video-sources";
import { cn } from "@/lib/utils";

export const PANEL = "rounded-2xl border border-[#253244] bg-[#101824]";
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

const DEFAULT_PLATFORMS = ["tiktok", "instagram", "youtube", "linkedin"];

export function useClipOptions() {
  const [clipCount, setClipCount] = useState(5);
  const [durations, setDurations] = useState<number[]>([30, 45, 60]);
  const [captionStyle, setCaptionStyle] = useState("viral");
  const [language, setLanguage] = useState("en");
  const [exportQuality, setExportQuality] = useState("hd");
  const [platforms, setPlatforms] = useState<string[]>(DEFAULT_PLATFORMS);
  // Kept here (not in the picker) so it survives re-renders and step changes.
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT);
  const [subtitle, setSubtitle] = useState<SubtitleInfo | null>(null);
  return {
    layout,
    setLayout,
    subtitle,
    setSubtitle,
    brandKit,
    setBrandKit,
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
    platforms,
    setPlatforms,
    /** Body fields shared by import-url and upload complete. */
    payload: () => ({
      clip_count: clipCount,
      // Nothing picked: let the AI choose among typical short-form lengths.
      durations: durations.length ? durations : [30, 45, 60],
      caption_style: captionStyle,
      caption_language: language,
      export_quality: exportQuality,
      platforms: platforms.length ? platforms : DEFAULT_PLATFORMS,
      ...(brandKit ? { brand_kit_id: brandKit.id } : {}),
      layout: {
        aspect_ratio: layout.aspect_ratio,
        layout: layout.layout,
        ...(layout.layout === "fill"
          ? { position: layout.position }
          : { crop_ratio: layout.crop_ratio, background: layout.background, ...(layout.background === "color" ? { background_color: layout.background_color } : {}) }),
      },
      ...(subtitle ? { subtitle_srt_path: subtitle.path } : {}),
    }),
  };
}

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null);
  const [costPerClip, setCostPerClip] = useState(1);
  const [tier, setTier] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const res = await apiFetch<Profile>("/api/v1/users/me", { token, skipGlobalLoader: true });
      if (res.success && res.data) {
        setCredits(res.data.credits);
        setCostPerClip(res.data.clip_credit_cost ?? 1);
        setTier(res.data.subscription_tier ?? "starter");
      }
    })();
  }, []);
  return { credits, costPerClip, tier, maxVideoSeconds: maxVideoSecondsFor(tier) };
}

/** "Your Starter plan supports videos up to 5 min · Upgrade" under the source picker. */
export function PlanLimitHint({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const max = maxVideoSecondsFor(tier);
  return (
    <p className="mt-3 text-xs text-[#94A3B8]">
      Your plan supports source videos up to <span className="font-medium text-[#F8FAFC]">{formatMinutes(max)}</span>
      {max < 30 * 60 && (
        <>
          {" · "}
          <Link href="/pricing" className="text-[#54D045] hover:underline">
            Upgrade for longer videos
          </Link>
        </>
      )}
    </p>
  );
}

/** Which social accounts are connected for posting. null while loading or unavailable. */
function usePlatformConnections() {
  const [rows, setRows] = useState<PlatformConnection[] | null>(null);
  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const res = await apiFetch<PlatformConnection[]>("/api/v1/platforms", { token, skipGlobalLoader: true });
      if (res.success && res.data) setRows(res.data);
    })();
  }, []);
  return rows;
}

/* ---------------------------------------------------------- small pieces */

export function StepHeader({
  step,
  title,
  description,
  action,
}: {
  step: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">STEP {step}</p>
        <h2 className="mt-0.5 text-base font-semibold text-[#F8FAFC]">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-[#94A3B8]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, hint }: { icon: typeof Captions; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#253244] bg-[#0A111B] text-[#94A3B8]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-semibold text-[#F8FAFC]">{title}</span>
      {hint && <span className="text-xs text-[#64748B]">{hint}</span>}
    </div>
  );
}

function FieldSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ id: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer rounded-lg border border-[#253244] bg-[#0A111B] px-3 text-sm font-medium text-[#F8FAFC] outline-none transition-colors hover:border-[#35445a] focus:border-[#54D045]/60"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#101824]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Thumbnail tile with a dimmed overlay; children render on top. */
/** Short ETA like "4m" / "45s". */
function etaLabel(seconds: number | null): string | null {
  if (seconds == null) return null;
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

/**
 * Progress pill over the thumbnail: "🕑 58% (ETA 1m)". The background fills
 * left-to-right with the progress, so it reads at a glance.
 */
export function EtaBadge({ percent, remainingSeconds, queued }: { percent: number; remainingSeconds: number | null; queued?: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const eta = etaLabel(remainingSeconds);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={queued ? "Queued" : `${pct}% done${eta ? `, about ${eta} left` : ""}`}
        className="relative overflow-hidden rounded-xl border border-[#54D045]/40 bg-black/75 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.9)] backdrop-blur-sm"
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#54D045]/45 to-[#35D6E8]/45 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        <span className="relative flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold tabular-nums text-[#bdf5b4]">
          <Clock className="h-4 w-4" aria-hidden />
          {queued ? "Queued" : `${pct}%${eta ? ` (ETA ${eta})` : ""}`}
        </span>
      </div>
    </div>
  );
}

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
    <div className={cn("relative overflow-hidden rounded-xl border border-[#253244] bg-[#0A111B]", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <FileVideo className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-[#253244]" />
      )}
      {src && <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />}
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
  emoji: (
    <span className="text-[15px] font-bold leading-tight text-white [text-shadow:0_2px_0_#000]">
      <span className="text-[#54D045]">$</span> To get started
    </span>
  ),
  karaoke: (
    <span className="text-[15px] font-black uppercase leading-tight text-white [text-shadow:0_2px_0_#000]">
      <span className="text-[#8B5CF6]">To get sta</span>rted
    </span>
  ),
  marker: (
    <span className="text-[15px] font-black uppercase leading-tight text-white">
      To get <span className="rounded-md bg-[#8B5CF6] px-1">started</span>
    </span>
  ),
  punch: (
    <span className="text-[22px] font-black uppercase leading-none text-[#FFD700] [-webkit-text-stroke:1.5px_#000] [text-shadow:0_3px_0_#000]">
      Started
    </span>
  ),
  lime: (
    <span className="text-[16px] font-black uppercase leading-tight text-white [text-shadow:0_2px_0_#000]">
      To get <span className="text-[#54D045]">started</span>
    </span>
  ),
  typewriter: (
    <span className="rounded bg-black/60 px-1.5 font-mono text-[13px] leading-tight text-white">
      To get started<span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-white" />
    </span>
  ),
  neon: (
    <span className="text-[15px] font-extrabold uppercase leading-tight text-[#FFE6FF] [text-shadow:0_0_6px_#FF1ED2,0_0_14px_#FF1ED2]">
      To get started
    </span>
  ),
  sticker: (
    <span className="inline-block rotate-[-2deg] rounded-md bg-white px-2 py-0.5 text-[14px] font-extrabold leading-tight text-[#111]">
      To get started
    </span>
  ),
  comic: (
    <span className="inline-block -rotate-3 text-[16px] font-black uppercase leading-tight text-[#FFE100] [-webkit-text-stroke:1.5px_#000] [text-shadow:2px_3px_0_#000]">
      To get started
    </span>
  ),
  retro: (
    <span className="text-[16px] font-black uppercase leading-tight text-[#FFC800] [text-shadow:3px_3px_0_#A02000]">
      To get started
    </span>
  ),
  editorial: (
    <span className="font-serif text-[17px] italic leading-tight text-white [text-shadow:0_2px_4px_#000]">
      to get <span className="text-[#F0C870]">started</span>
    </span>
  ),
  handwritten: (
    <span className="text-[17px] leading-tight text-white [font-family:'Brush_Script_MT',cursive] [text-shadow:0_2px_3px_#000]">
      To get <span className="text-[#FFD722]">started</span>
    </span>
  ),
  minimal: <span className="text-[13px] font-semibold leading-tight text-white [text-shadow:0_1px_3px_#000]">To get started</span>,
};

/** Sample footage behind each caption preview (public/showcase). */
const FOOTAGE = ["talking-head", "podcast", "screenshare", "gameplay", "whiteboard"];
const CAPTION_FOOTAGE: Record<string, string> = Object.fromEntries(
  CAPTION_STYLES.map((s, i) => [s.id, FOOTAGE[i % FOOTAGE.length]]),
);

/** Caption style card: still frame, plays its clip on hover and while selected. */
function CaptionCard({
  id,
  label,
  on,
  onSelect,
  className,
}: {
  id: string;
  label: string;
  on: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);
  const clip = CAPTION_FOOTAGE[id] ?? "talking-head";
  const playing = on || hover;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [playing]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      data-caption-id={id}
      className={cn("group text-left", className)}
    >
      <span
        className={cn(
          "relative flex aspect-[4/3] items-end justify-center overflow-hidden rounded-xl border-2 bg-[#0A111B] px-2 pb-3 transition-all",
          on ? "border-[#54D045]" : "border-[#253244] group-hover:border-[#35445a]",
        )}
      >
        <video
          ref={videoRef}
          src={`/showcase/${clip}.mp4`}
          poster={`/showcase/${clip}.jpg`}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {on && (
          <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#54D045] text-[#070B12]">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
        <span className="relative z-10 text-center">{CAPTION_PREVIEW[id]}</span>
      </span>
      <span className={cn("mt-2 block text-xs font-medium", on ? "text-[#F8FAFC]" : "text-[#94A3B8]")}>{label}</span>
    </button>
  );
}

/** Caption styles in one scrollable row, with arrows and a "view all" popup. */
function CaptionPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [open, setOpen] = useState(false);

  const updateArrows = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Bring the selected style into view after it changes (e.g. picked in the popup).
  // Scroll only the row, never the page.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const row = rowRef.current;
    const card = row?.querySelector<HTMLElement>(`[data-caption-id="${value}"]`);
    if (!row || !card) return;
    const left = card.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + card.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 12), behavior: "smooth" });
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const scrollBy = (dir: 1 | -1) => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const arrow =
    "absolute top-[calc(50%-14px)] z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#253244] bg-[#F8FAFC] text-[#070B12] shadow-[0_6px_20px_-4px_rgba(0,0,0,0.8)] transition-opacity hover:bg-white";

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={Captions} title="Caption style" hint={`${CAPTION_STYLES.length} styles`} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#8fe383] hover:underline"
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative mt-4">
        {canLeft && (
          <button type="button" aria-label="Scroll caption styles left" onClick={() => scrollBy(-1)} className={cn(arrow, "-left-3")}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {canRight && (
          <button type="button" aria-label="Scroll caption styles right" onClick={() => scrollBy(1)} className={cn(arrow, "-right-3")}>
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        <div
          ref={rowRef}
          onScroll={updateArrows}
          role="radiogroup"
          aria-label="Caption style"
          className="flex snap-x gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CAPTION_STYLES.map((s) => (
            <CaptionCard
              key={s.id}
              id={s.id}
              label={s.label}
              on={value === s.id}
              onSelect={() => onChange(s.id)}
              className="w-[150px] shrink-0 snap-start sm:w-[160px]"
            />
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-[150px] shrink-0 snap-start flex-col sm:w-[160px]"
          >
            <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#253244] bg-[#0A111B] text-[#94A3B8] transition-colors hover:border-[#54D045]/50 hover:text-[#F8FAFC]">
              <LayoutGrid className="h-5 w-5" />
              <span className="text-xs font-medium">View all {CAPTION_STYLES.length}</span>
            </span>
            <span className="mt-2 flex items-center gap-1 text-xs font-medium text-[#94A3B8]">
              Browse styles <ChevronRight className="h-3 w-3" />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070B12]/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="caption-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#253244] bg-[#101824] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]"
          >
            <div className="flex items-center justify-between border-b border-[#253244] px-5 py-4">
              <h3 id="caption-dialog-title" className="text-base font-semibold text-[#F8FAFC]">
                Caption styles
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              className="grid grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 md:grid-cols-4"
              role="radiogroup"
              aria-label="All caption styles"
            >
              {CAPTION_STYLES.map((s) => (
                <CaptionCard
                  key={s.id}
                  id={s.id}
                  label={s.label}
                  on={value === s.id}
                  onSelect={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Step 2: clip count, length, language, quality and captions. Extra sections go in children. */
export function ClipSettingsPanel({ opts, children }: { opts: ClipOptions; children?: React.ReactNode }) {
  return (
    <section className={cn(PANEL, "p-5 sm:p-6")}>
      <StepHeader step="02" title="AI clip configuration" description="Tell the AI what kind of clips you want." />

      <div className="space-y-6">
        <BrandKitPicker value={opts.brandKit} onChange={opts.setBrandKit} />

        {/* Clip count */}
        <div>
          <p className="mb-2.5 text-sm font-medium text-[#F8FAFC]">How many clips do you want?</p>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Number of clips">
            {CLIP_COUNTS.map((n) => {
              const on = opts.clipCount === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => opts.setClipCount(n)}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center rounded-xl border transition-all",
                    on
                      ? "border-[#54D045]/60 bg-[#54D045]/10 text-[#F8FAFC] shadow-[0_0_0_1px_rgba(84,208,69,0.25)]"
                      : "border-[#253244] bg-[#0A111B] text-[#94A3B8] hover:border-[#35445a] hover:text-[#F8FAFC]",
                  )}
                >
                  <span className="text-base font-semibold tabular-nums">{n}</span>
                  <span className="text-[10px]">clips</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration */}
        <div>
          <p className="mb-2.5 text-sm font-medium text-[#F8FAFC]">
            Preferred clip length <span className="font-normal text-[#64748B]">· pick one or more</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((sec) => {
              const on = opts.durations.includes(sec);
              return (
                <button
                  key={sec}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    opts.setDurations((d) => (on ? d.filter((x) => x !== sec) : [...d, sec].sort((a, b) => a - b)))
                  }
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                    on
                      ? "border-[#54D045]/60 bg-[#54D045]/10 text-[#F8FAFC]"
                      : "border-[#253244] bg-[#0A111B] text-[#94A3B8] hover:border-[#35445a] hover:text-[#F8FAFC]",
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5 text-[#54D045]" />}
                  {formatClipLength(sec)}
                </button>
              );
            })}
          </div>
          {opts.durations.length === 0 && (
            <p className="mt-2 text-xs text-[#94A3B8]">No length picked — the AI will choose 30–60s for each clip.</p>
          )}
        </div>

        {/* Language + quality */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSelect id="opt-language" label="Video language" value={opts.language} onChange={opts.setLanguage} options={LANGUAGES} />
          <FieldSelect
            id="opt-quality"
            label="Output quality"
            value={opts.exportQuality}
            onChange={opts.setExportQuality}
            options={EXPORT_QUALITIES}
          />
        </div>

        {/* Captions */}
        <div className="border-t border-[#253244] pt-6">
          <CaptionPicker value={opts.captionStyle} onChange={opts.setCaptionStyle} />
        </div>

        {children}
      </div>
    </section>
  );
}

/** Layout + SRT bar shown under the video in Step 1. */
export function SourceLayoutBar({ opts, tier }: { opts: ClipOptions; tier: string | null }) {
  return (
    <LayoutBar tier={tier} layout={opts.layout} onLayoutChange={opts.setLayout} subtitle={opts.subtitle} onSubtitleChange={opts.setSubtitle} />
  );
}

/* ------------------------------------------------------- publishing targets */

/** Which platforms clips are formatted for; shows real connection status. */
export function PublishTargets({ opts }: { opts: ClipOptions }) {
  const connections = usePlatformConnections();

  function status(id: string): { label: string; tone: "ok" | "warn" | "muted" } | null {
    if (!connections) return null;
    const conn = connections.find((c) => c.platform === id);
    if (id === "youtube" || id === "instagram") {
      if (!conn) return { label: "Not connected", tone: "muted" };
      return conn.can_post === false ? { label: "Reconnect", tone: "warn" } : { label: "Connected", tone: "ok" };
    }
    return { label: "Download & post", tone: "muted" };
  }

  return (
    <div className="border-t border-[#253244] pt-6">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={Send} title="Made for" />
        <Link
          href="/setup/platforms?from=dashboard"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#8fe383] hover:underline"
        >
          Manage connections <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="mt-2 text-xs text-[#94A3B8]">
        Clips are tagged for these platforms. Nothing is posted automatically — publish from My Clips or the Content
        Scheduler.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const on = opts.platforms.includes(p.id);
          const st = status(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                opts.setPlatforms((prev) => (on ? prev.filter((x) => x !== p.id) : [...prev, p.id]))
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                on
                  ? "border-[#54D045]/50 bg-[#54D045]/[0.08] text-[#F8FAFC]"
                  : "border-[#253244] bg-[#0A111B] text-[#94A3B8] hover:border-[#35445a] hover:text-[#F8FAFC]",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border",
                  on ? "border-[#54D045] bg-[#54D045] text-[#070B12]" : "border-[#475569]",
                )}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              {p.label}
              {st && (
                <span
                  className={cn(
                    "text-[10px]",
                    st.tone === "ok" && "text-[#8fe383]",
                    st.tone === "warn" && "text-amber-300",
                    st.tone === "muted" && "text-[#64748B]",
                  )}
                >
                  {st.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
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
  // Display only — the API computes and charges the real cost.
  const totalCost = opts.clipCount * costPerClip;
  const notEnough = credits !== null && credits < totalCost;
  const estimate = estimateProcessingSeconds(videoSeconds, opts.clipCount);
  const quality = EXPORT_QUALITIES.find((q) => q.id === opts.exportQuality)?.label ?? "–";

  return (
    <aside className={cn(PANEL, "p-5 lg:sticky lg:top-24")} aria-label="Generation summary">
      <StepHeader step="03" title="Generate" />
      <dl className="space-y-2.5 text-sm">
        <Row label="Video length" value={videoSeconds != null ? formatDuration(videoSeconds) : (videoLengthLabel ?? "–")} />
        <Row label="Clips" value={`${opts.clipCount}`} />
        <Row
          label="Clip length"
          value={opts.durations.length ? opts.durations.map(formatClipLength).join(", ") : "Auto"}
        />
        <Row label="Brand kit" value={opts.brandKit?.name ?? "No brand kit"} />
        {opts.brandKit ? (
          <>
            <Row label="Logo" value={opts.brandKit.logo_path ? "Applied" : "None"} />
            <Row label="Captions" value={CAPTION_PRESETS.find((p) => p.id === opts.brandKit!.captions?.preset)?.label ?? "Brand style"} />
            <Row label="Intro" value={opts.brandKit.intro_enabled ? "Enabled" : "Off"} />
            <Row label="Outro" value={opts.brandKit.outro_enabled ? "Enabled" : "Off"} />
          </>
        ) : (
          <Row label="Captions" value={CAPTION_STYLES.find((s) => s.id === opts.captionStyle)?.label ?? "–"} />
        )}
        <Row label="Aspect ratio" value={opts.layout.aspect_ratio} />
        <Row label="Layout" value={layoutSummary(opts.layout)} />
        <Row label="Subtitles" value={opts.subtitle ? `SRT · ${opts.subtitle.filename}` : "AI captions"} />
        <Row label="Quality" value={quality} />
        <Row
          label="Processing time"
          value={videoSeconds != null ? `~${formatEstimate(estimate)}` : "Depends on length"}
          icon={Clock}
        />
      </dl>

      <div className="my-4 border-t border-[#253244]" />

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span>
            {opts.clipCount} clips × {costPerClip} credit{costPerClip === 1 ? "" : "s"}
          </span>
          {credits !== null && <span>{credits.toLocaleString()} available</span>}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#F8FAFC]">Total</span>
          <span className="flex items-center gap-1 text-base font-semibold text-[#F8FAFC]">
            <Zap className="h-4 w-4 fill-[#54D045] text-[#54D045]" />
            {totalCost} credits
          </span>
        </div>
      </div>

      {notEnough && (
        <div className="mt-4 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-3" role="alert">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" /> Not enough credits
          </p>
          <p className="mt-1 text-xs text-amber-100/80">
            You need {totalCost} and have {credits}. Pick fewer clips or add credits.
          </p>
          <Link
            href="/subscription"
            className="mt-2.5 inline-flex h-8 items-center gap-1 rounded-lg bg-amber-300 px-3 text-xs font-semibold text-[#070B12] hover:bg-amber-200"
          >
            Add credits <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-2.5 text-xs text-[#fca5a5]" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onCreate}
        disabled={disabled || busy || notEnough}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#54D045] text-[15px] font-semibold text-[#070B12] shadow-[0_10px_30px_-12px_rgba(84,208,69,0.7)] transition-colors hover:bg-[#62dc53] disabled:cursor-not-allowed disabled:bg-[#19251F] disabled:text-[#94A3B8] disabled:shadow-none"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {buttonLabel}
      </button>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-[#64748B]">
        By continuing, you confirm you have the rights to use this video.
      </p>
    </aside>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Clock }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-[#94A3B8]">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className="truncate text-right font-medium text-[#F8FAFC]">{value}</dd>
    </div>
  );
}

/* --------------------------------------------------------- processing card */

/**
 * Polls the pipeline, shows the real stage list with elapsed and remaining
 * time, and opens the clips once the video is ready.
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

  const progress = pipeline?.progress_percent ?? 0;
  const queued = pipeline?.job?.status === "queued";
  const steps = pipeline?.steps ?? [];
  const elapsed = Math.floor((now - startedAt) / 1000);
  const liveEta = pipeline?.estimated_completion_at
    ? Math.max(0, Math.round((new Date(pipeline.estimated_completion_at).getTime() - now) / 1000))
    : null;
  const remaining = liveEta ?? (estimateSeconds != null ? Math.max(0, estimateSeconds - elapsed) : null);

  return (
    <div className={cn(PANEL, "grid gap-6 p-5 sm:p-6 md:grid-cols-[260px_1fr]")}>
      <div>
        <VideoThumb src={thumbnail} className="aspect-video">
          {!failed && <EtaBadge percent={progress} remainingSeconds={remaining} queued={queued} />}
        </VideoThumb>
        <h2 className="mt-3 line-clamp-2 text-sm font-semibold text-[#F8FAFC]">{pipeline?.title || title}</h2>
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                failed ? "border-[#EF4444]/35 text-[#fca5a5]" : "border-[#54D045]/35 text-[#8fe383]",
              )}
            >
              {!failed && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#54D045]" />}
              {failed ? "Failed" : queued ? "Queued" : "Generating"}
            </span>
            <p className="mt-2 text-lg font-semibold text-[#F8FAFC]">
              {failed ? "Something went wrong" : queued ? "Waiting for a free worker" : "Creating your clips"}
            </p>
          </div>
          {!failed && pipeline && <span className="text-2xl font-semibold tabular-nums text-[#F8FAFC]">{progress}%</span>}
        </div>

        {failed ? (
          <div className="mt-4 rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/[0.08] p-3 text-sm text-[#fca5a5]">
            {formatPipelineError(pipeline?.job?.error ?? pipeline?.error_message)}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onReset}
                className="h-9 rounded-lg bg-[#F8FAFC] px-3 text-xs font-semibold text-[#070B12] hover:bg-white"
              >
                Try another video
              </button>
              <Link
                href="/clips"
                className="inline-flex h-9 items-center rounded-lg border border-[#253244] px-3 text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.04]"
              >
                Go to My Clips
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#0A111B]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#54D045] to-[#35D6E8] transition-[width] duration-700"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
              <span className="flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" /> Elapsed {formatDuration(elapsed)}
              </span>
              {remaining != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {remaining > 0 ? `~${formatEstimate(remaining)} left` : "Finishing up"}
                </span>
              )}
            </div>

            {steps.length > 0 && (
              <ol className="mt-5 space-y-2">
                {steps.map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5 text-sm">
                    {s.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#54D045]" />
                    ) : s.status === "active" ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#35D6E8]" />
                    ) : s.status === "failed" ? (
                      <XCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-[#253244]" />
                    )}
                    <span
                      className={cn(
                        s.status === "active" ? "font-medium text-[#F8FAFC]" : s.status === "completed" ? "text-[#cbd5e1]" : "text-[#64748B]",
                      )}
                    >
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#253244] pt-4">
              <p className="text-xs text-[#94A3B8]">You can leave this page — clips appear in My Clips when they&apos;re ready.</p>
              <Link href="/clips" className="inline-flex items-center gap-1 text-xs font-semibold text-[#8fe383] hover:underline">
                Go to My Clips <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
