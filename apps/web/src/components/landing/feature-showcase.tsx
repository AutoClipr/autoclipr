"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Captions,
  CheckCircle2,
  Facebook,
  Instagram,
  Link2,
  Linkedin,
  Pointer,
  Youtube,
  Crop,
  Radio,
  Scissors,
  Send,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tabbed, auto-advancing showcase of what AutoClipr does, shown under the hero
 * link box. Each panel is a scripted demo built from short silent loops in
 * /public/showcase — not a live editor.
 *
 * Only features AutoClipr actually ships are shown here.
 */

const ADVANCE_MS = 8000;

/** How long each slide stays before the carousel moves on. */
function slideMs(tab: TabId): number {
  return tab === "reframe" ? LAYOUTS.length * REFRAME_LAYOUT_MS : ADVANCE_MS;
}

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "clipping", label: "AI clipping", icon: Scissors },
  { id: "captions", label: "AI captions", icon: Captions },
  { id: "reframe", label: "Auto reframe", icon: Crop },
  { id: "monitor", label: "Channel monitoring", icon: Radio },
  { id: "publish", label: "Auto-publish", icon: Send },
];

type TabId = "clipping" | "captions" | "reframe" | "monitor" | "publish";

export function FeatureShowcase() {
  const [active, setActive] = useState<TabId>("clipping");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      const i = TABS.findIndex((tab) => tab.id === active);
      setActive(TABS[(i + 1) % TABS.length].id);
    }, slideMs(active));
    return () => clearTimeout(t);
  }, [active, paused]);

  const index = TABS.findIndex((tab) => tab.id === active);
  const go = (delta: number) =>
    setActive(TABS[(index + delta + TABS.length) % TABS.length].id);

  return (
    <div
      className="mt-12 w-full text-left"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Carousel: the active card is centred, its neighbours peek in dimmed. */}
      <div
        className="relative w-full overflow-clip py-2 [--card:min(64rem,calc(100vw-3rem))] [--gap:1.25rem] sm:[--card:min(60rem,calc(100vw-16rem))]"
      >
        <div
          className="relative left-1/2 flex gap-[var(--gap)] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: `translateX(calc(-1 * (${index} * (var(--card) + var(--gap)) + var(--card) / 2)))`,
          }}
        >
          {TABS.map((tab, i) => {
            const on = i === index;
            return (
              <div
                key={tab.id}
                aria-hidden={!on}
                onClick={on ? undefined : () => setActive(tab.id)}
                className={cn(
                  "relative aspect-[4/5] w-[var(--card)] shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-2xl shadow-black/40 transition-[opacity,transform] duration-700 sm:aspect-[16/9]",
                  on ? "opacity-100" : "scale-[0.96] cursor-pointer opacity-35 hover:opacity-50",
                )}
              >
                {/* Remount on activation so each demo's animation restarts. */}
                <div key={on ? `${tab.id}-on` : tab.id} className={cn("absolute inset-0", !on && "pointer-events-none")}>
                  {tab.id === "clipping" && <ClippingDemo />}
                  {tab.id === "captions" && <CaptionsDemo />}
                  {tab.id === "reframe" && <ReframeDemo />}
                  {tab.id === "monitor" && <MonitorDemo />}
                  {tab.id === "publish" && <PublishDemo />}
                </div>
              </div>
            );
          })}
        </div>

        {[-1, 1].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => go(d)}
            aria-label={d < 0 ? "Previous feature" : "Next feature"}
            className="absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.12] text-white/90 backdrop-blur-md transition hover:bg-white/20 hover:text-white sm:flex"
            style={{
              // Sit on the peeking neighbour cards, clear of the active card.
              left: d < 0 ? "calc(50% - var(--card) / 2 - 5.25rem)" : "calc(50% + var(--card) / 2 + 2.75rem)",
            }}
          >
            {d < 0 ? <ArrowLeft className="h-6 w-6" strokeWidth={1.75} /> : <ArrowRight className="h-6 w-6" strokeWidth={1.75} />}
          </button>
        ))}
      </div>

      <div
        role="tablist"
        aria-label="AutoClipr features"
        className="mx-auto mt-5 flex max-w-5xl flex-wrap items-center justify-center gap-2 px-4"
      >
        {TABS.map((tab) => {
          const on = tab.id === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(tab.id)}
              className={cn(
                "relative inline-flex items-center gap-2 overflow-hidden rounded-xl border px-3.5 py-2 text-sm transition-colors",
                on
                  ? "border-white/15 bg-white/[0.08] text-white"
                  : "border-white/[0.06] text-white/55 hover:text-white/85",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {on && !paused && (
                <motion.span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-emerald-400/80"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: slideMs(tab.id) / 1000, ease: "linear" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Shared pieces ─────────────────────────────────────────────────────── */

type Region = { x: number; y: number; w: number; h: number };

/**
 * Shows one region of a 16:9 source loop, scaled to fill its box — how the
 * demos fake a 9:16 reframe from a landscape video. `region` is in fractions
 * of the source frame; pick regions whose aspect matches the box.
 */
function CroppedLoop({
  name,
  region = { x: 0, y: 0, w: 1, h: 1 },
  offset = 0,
  className,
  style,
}: {
  name: string;
  region?: Region;
  offset?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || !offset) return;
    const seek = () => {
      v.currentTime = offset;
    };
    if (v.readyState >= 1) seek();
    else v.addEventListener("loadedmetadata", seek, { once: true });
  }, [offset]);

  return (
    <div className={cn("relative overflow-hidden bg-black", className)} style={style}>
      <video
        ref={ref}
        src={`/showcase/${name}.mp4`}
        poster={`/showcase/${name}.jpg`}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        className="absolute max-w-none object-fill"
        style={{
          width: `${100 / region.w}%`,
          height: `${100 / region.h}%`,
          left: `${(-region.x / region.w) * 100}%`,
          top: `${(-region.y / region.h) * 100}%`,
        }}
      />
    </div>
  );
}

/** Full-height 9:16 slice of a 16:9 frame, starting at `x`. */
const portrait = (x: number): Region => ({ x, y: 0, w: 0.316, h: 1 });

function useTicker(count: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, ms]);
  return i;
}

function Phone({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/15 shadow-xl shadow-black/50",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
      {children}
    </span>
  );
}

/** The slide's video, heavily blurred, as an ambient background. */
function AmbientBg({ name }: { name: string }) {
  return (
    <AnimatePresence>
      <motion.div
        key={name}
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        aria-hidden
      >
        <CroppedLoop name={name} className="h-full w-full scale-125 opacity-45 blur-3xl" />
        <div className="absolute inset-0 bg-black/35" />
      </motion.div>
    </AnimatePresence>
  );
}

function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

/* ─── 1. AI clipping ────────────────────────────────────────────────────── */

const SOURCES: { name: string; duration: string; crops: number[] }[] = [
  { name: "podcast", duration: "1:12:08", crops: [0.27, 0.3, 0.24, 0.29, 0.26] },
  { name: "whiteboard", duration: "17:23", crops: [0.2, 0.26, 0.22, 0.24, 0.18] },
  { name: "gameplay", duration: "9:14", crops: [0.35, 0.42, 0.3, 0.5, 0.38] },
  { name: "screenshare", duration: "21:55", crops: [0.62, 0.3, 0.68, 0.4, 0.65] },
];

const SCORES = [97, 99, 97, 98, 94, 92];

const PLATFORM_ICONS: { icon: LucideIcon; className: string }[] = [
  { icon: Youtube, className: "bg-red-600" },
  { icon: Instagram, className: "bg-gradient-to-br from-fuchsia-500 to-orange-400" },
  { icon: Linkedin, className: "bg-sky-600" },
  { icon: TikTokLogo as LucideIcon, className: "bg-black ring-1 ring-white/20" },
  { icon: Facebook, className: "bg-blue-600" },
  { icon: XLogo as LucideIcon, className: "bg-black ring-1 ring-white/20" },
];

type ClipPhase = "drop" | "click" | "ingest" | "fan" | "exit";

/** ms each phase lasts before moving to the next. */
const PHASE_MS: Record<ClipPhase, number> = {
  drop: 900,
  click: 500,
  ingest: 600,
  fan: 2200,
  exit: 550,
};
const PHASE_ORDER: ClipPhase[] = ["drop", "click", "ingest", "fan", "exit"];

/**
 * A long video drops in above a "Get clips" box, the cursor clicks, the video
 * is pulled in and a row of scored clips fans out — then it slides away and
 * the next source drops in.
 */
function ClippingDemo() {
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<ClipPhase>("drop");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = PHASE_ORDER[(PHASE_ORDER.indexOf(phase) + 1) % PHASE_ORDER.length];
      if (next === "drop") setCycle((c) => c + 1);
      setPhase(next);
    }, PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  const source = SOURCES[cycle % SOURCES.length];
  const ease = [0.22, 1, 0.36, 1] as const;
  const showSource = phase === "drop" || phase === "click" || phase === "ingest";
  const showRow = phase === "fan" || phase === "exit";

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AmbientBg name={source.name} />
      {/* Source video: drops in above the box, then gets pulled in. */}
      <AnimatePresence>
        {showSource && (
          <motion.div
            key={`src-${cycle}`}
            className="absolute inset-x-0 z-0 mx-auto w-36 sm:w-64"
            initial={{ top: "-40%", opacity: 0 }}
            animate={
              phase === "ingest"
                ? { top: "50%", scale: 0.85, opacity: 0.9 }
                : { top: "7%", scale: 1, opacity: 1 }
            }
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            transition={{ duration: phase === "ingest" ? 0.55 : 0.8, ease }}
          >
            <div className="relative aspect-video overflow-hidden rounded-xl border border-white/15 shadow-2xl shadow-black/60">
              <CroppedLoop name={source.name} className="h-full w-full" />
              <span className="absolute bottom-1 right-1.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white/90">
                {source.duration}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The input box with the "Get clips" button and a cursor. */}
      <div className="absolute left-1/2 top-[36%] z-10 w-[min(30rem,90%)] -translate-x-1/2 sm:top-[42%]">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#141821]/95 p-1.5 pl-4 shadow-xl sm:pl-5 shadow-black/50 backdrop-blur">
          <Link2 className="h-4 w-4 shrink-0 text-white/40 sm:h-5 sm:w-5" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-white sm:text-base">
            Drop a long video and…
          </span>
          <motion.span
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 sm:px-5 sm:py-2.5 sm:text-base"
            animate={{ scale: phase === "click" ? [1, 0.9, 1.06, 1] : 1 }}
            transition={{ duration: 0.45 }}
          >
            Get clips
          </motion.span>
        </div>
        <motion.div
          className="pointer-events-none absolute right-7 top-[32px] text-black drop-shadow sm:top-[36px]"
          animate={phase === "click" ? { x: [0, -2, 0], y: [0, -3, 0] } : { x: 0, y: 0 }}
          transition={{ duration: 0.4 }}
          aria-hidden
        >
          <Pointer className="h-6 w-6 fill-white" strokeWidth={1.75} />
        </motion.div>
      </div>

      {/* The clips it makes, each with a score and the platform it's for. */}
      <AnimatePresence>
        {showRow && (
          <motion.div
            key={`row-${cycle}`}
            className="absolute inset-x-0 top-[52%] z-0 flex items-end justify-center gap-1.5 px-3 sm:top-[58%] sm:gap-3"
            initial={{ opacity: 1, x: 0 }}
            animate={phase === "exit" ? { x: "70%", opacity: 0 } : { x: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease }}
          >
            {SCORES.map((score, i) => {
              const Platform = PLATFORM_ICONS[i];
              const wide = i === 0;
              return (
                <motion.div
                  key={i}
                  className={cn(
                    "relative shrink-0",
                    wide ? "w-20 sm:w-44" : "w-10 sm:w-[5.6rem]",
                  )}
                  initial={{ opacity: 0, scale: 0.6, x: (2.5 - i) * 40 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.5, ease }}
                >
                  <span
                    className={cn(
                      "absolute -top-2 left-1/2 z-10 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full sm:-top-2.5 sm:h-5 sm:w-5",
                      Platform.className,
                    )}
                  >
                    <Platform.icon className="h-2.5 w-2.5 text-white sm:h-3 sm:w-3" />
                  </span>
                  <div
                    className={cn(
                      "overflow-hidden rounded-lg border border-white/15 shadow-lg shadow-black/50",
                      wide ? "aspect-[16/11]" : "aspect-[9/16]",
                    )}
                  >
                    <CroppedLoop
                      name={source.name}
                      region={wide ? { x: 0.1, y: 0, w: 0.8, h: 0.95 } : portrait(source.crops[i - 1])}
                      offset={i * 1.1}
                      className="h-full w-full"
                    />
                  </div>
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] font-bold text-lime-300 sm:text-[10px]">
                    {score}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── 2. AI captions ────────────────────────────────────────────────────── */

const CAPTION_WORDS = ["You", "don't", "need", "expensive", "gear", "to", "start"];

/** Matches the styles the create form offers, plus "none". */
const CAPTION_PRESETS = [
  { id: "none", label: "No captions" },
  { id: "viral", label: "Viral Style" },
  { id: "karaoke", label: "Karaoke" },
  { id: "animated", label: "Animated" },
  { id: "emoji", label: "Emoji Captions" },
] as const;

type PresetId = (typeof CAPTION_PRESETS)[number]["id"];

const STROKE: CSSProperties = { WebkitTextStroke: "1px black", paintOrder: "stroke fill" };

/** One caption line in a given style; `word` is the index being spoken. */
function CaptionLine({
  preset,
  words,
  word,
  className,
}: {
  preset: PresetId;
  words: readonly string[];
  word: number;
  className?: string;
}) {
  if (preset === "none") return null;

  return (
    <p
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-[0.28em] text-center font-black uppercase leading-tight",
        preset === "animated" && "italic tracking-tight",
        className,
      )}
    >
      {words.map((w, i) => {
        const on = i === word;
        if (preset === "karaoke") {
          // Spoken word in green, the rest white.
          return (
            <span key={i} className={on ? "text-lime-400" : "text-white"} style={STROKE}>
              {w}
            </span>
          );
        }
        if (preset === "animated") {
          // Heavy italic; the spoken word pops in green.
          return (
            <motion.span
              key={i}
              animate={{ scale: on ? 1.15 : 1 }}
              className={cn("inline-block", on ? "text-lime-400" : "text-white")}
              style={{ ...STROKE, WebkitTextStroke: "1.5px black" }}
            >
              {w}
            </motion.span>
          );
        }
        if (preset === "emoji") {
          return (
            <span key={i} className="text-white" style={STROKE}>
              {w}
              {on && (w === "expensive" ? " 💸" : w === "start" ? " 🚀" : w === "need" ? " 👀" : w === "get" ? " ✨" : "")}
            </span>
          );
        }
        // Viral: bold white, spoken word in a bright yellow box.
        return (
          <span
            key={i}
            className={cn("rounded-[0.18em] px-[0.12em]", on ? "bg-yellow-300 text-black" : "text-white")}
            style={on ? undefined : STROKE}
          >
            {w}
          </span>
        );
      })}
    </p>
  );
}

const PRESET_TILE_PX = 44;
const PRESET_LABEL_PX = 20;
const PRESET_GAP_PX = 8;
const PRESET_STEP_PX = PRESET_TILE_PX + PRESET_LABEL_PX + PRESET_GAP_PX;
const PANEL_HEADER_PX = 44;

/** Order the cursor visits presets in — not top-to-bottom, like a real user. */
const PRESET_VISITS = [2, 1, 3, 4, 0, 3, 1, 2, 4];

/**
 * Video with live captions on the left; a frosted style panel on the right
 * where a hand cursor taps presets and the captions restyle to match.
 */
function CaptionsDemo() {
  const word = useTicker(CAPTION_WORDS.length, 420);
  const visit = useTicker(PRESET_VISITS.length, 1700);
  const presetIndex = PRESET_VISITS[visit];
  const preset = CAPTION_PRESETS[presetIndex].id;
  const start = Math.max(0, Math.min(word - 1, CAPTION_WORDS.length - 3));
  const visibleWords = CAPTION_WORDS.slice(start, start + 3);
  const cursorTop = PANEL_HEADER_PX + 12 + presetIndex * PRESET_STEP_PX + PRESET_TILE_PX / 2;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AmbientBg name="talking-head" />

      {/* Video with captions in the chosen style */}
      <div className="absolute left-[4%] top-1/2 w-[58%] -translate-y-1/2 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/50 sm:left-[6%] sm:w-[56%]">
        <CroppedLoop name="talking-head" className="aspect-video w-full" />
        <div className="absolute inset-x-0 bottom-[14%]">
          <CaptionLine
            preset={preset}
            words={visibleWords}
            word={word - start}
            className="px-3 text-sm sm:text-[1.7rem]"
          />
        </div>
      </div>

      {/* Frosted style panel, running off the bottom of the card */}
      <div className="absolute bottom-0 right-[3%] top-[8%] w-[34%] overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-white/[0.07] shadow-2xl shadow-black/40 backdrop-blur-xl sm:right-[4%] sm:w-[30%]">
        <div
          className="flex items-end gap-5 border-b border-white/[0.07] px-4 text-xs sm:text-sm"
          style={{ height: PANEL_HEADER_PX }}
        >
          <span className="border-b-2 border-white pb-2.5 font-medium text-white">Presets</span>
          <span className="pb-2.5 text-white/45">Font</span>
          <span className="pb-2.5 text-white/45">Effects</span>
        </div>

        <div className="relative px-3 pt-3" style={{ display: "grid", gap: PRESET_GAP_PX }}>
          {CAPTION_PRESETS.map((p, i) => (
            <div key={p.id} className="flex flex-col items-stretch">
              <div
                style={{ height: PRESET_TILE_PX }}
                className={cn(
                  "flex items-center justify-center rounded-lg border-2 bg-white/[0.08] transition-colors",
                  i === presetIndex ? "border-white" : "border-transparent",
                )}
              >
                {p.id === "none" ? (
                  <Ban className="h-5 w-5 text-white/55" aria-hidden />
                ) : (
                  <CaptionLine preset={p.id} words={["To", "get", "started"]} word={1} className="text-[11px] sm:text-[13px]" />
                )}
              </div>
              <span
                className="flex items-center justify-center text-[10px] text-white/55 sm:text-xs"
                style={{ height: PRESET_LABEL_PX }}
              >
                {p.label}
              </span>
            </div>
          ))}

          {/* Hand cursor that moves to and taps the selected preset */}
          <motion.div
            className="pointer-events-none absolute right-5 text-black drop-shadow"
            style={{ top: 0 }}
            animate={{ y: cursorTop - PANEL_HEADER_PX, scale: [1, 1, 0.82, 1] }}
            transition={{
              y: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              scale: { duration: 0.5, times: [0, 0.6, 0.8, 1] },
            }}
            aria-hidden
          >
            <Pointer className="h-6 w-6 fill-white" strokeWidth={1.75} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ─── 3. Auto reframe ───────────────────────────────────────────────────── */

const REFRAME_LAYOUT_MS = 4000;

const LAYOUTS: {
  label: string;
  source: string;
  /** Regions of the 16:9 source stacked top-to-bottom in the 9:16 output. */
  panes: Region[];
  captions: string[];
}[] = [
  { label: "Fill", source: "whiteboard", panes: [portrait(0.22)], captions: ["Pick your", "vehicle", "first"] },
  {
    label: "Gameplay",
    source: "gameplay",
    panes: [
      { x: 0, y: 0.02, w: 0.24, h: 0.38 },
      { x: 0.3, y: 0.2, w: 0.5, h: 0.79 },
    ],
    captions: ["That was", "insane"],
  },
  {
    label: "Screen share",
    source: "screenshare",
    panes: [
      { x: 0.15, y: 0.02, w: 0.55, h: 0.87 },
      { x: 0.7, y: 0.6, w: 0.24, h: 0.38 },
    ],
    captions: ["Just book", "the stay"],
  },
  { label: "Fill", source: "podcast", panes: [portrait(0.27)], captions: ["Long-term", "high status"] },
];

/** Four dots lighting up one after another, like a processing indicator. */
function ProgressDots() {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {[0, 1, 2, 3].map((d) => (
        <motion.span
          key={d}
          className="h-1.5 w-1.5 rounded-full bg-white"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.18 }}
        />
      ))}
    </div>
  );
}

function ReframeDemo() {
  const i = useTicker(LAYOUTS.length, REFRAME_LAYOUT_MS);
  const layout = LAYOUTS[i];
  const captionWord = useTicker(2, 900);
  const split = layout.panes.length > 1;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AmbientBg name={layout.source} />

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          className="relative flex h-full flex-col items-center justify-center gap-4 p-5 sm:flex-row sm:gap-12 sm:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Before: the 16:9 source with the tracked regions boxed in yellow. */}
          <div className="w-full max-w-[22rem] space-y-3 sm:w-[44%]">
            <div className="relative overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/50">
              <CroppedLoop name={layout.source} className="aspect-video w-full" />
              {layout.panes.map((r, p) => (
                <motion.div
                  key={p}
                  className="absolute rounded-sm border-2 border-yellow-300/90 bg-yellow-300/10"
                  style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                  initial={{ opacity: 0, scale: 1.08 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + p * 0.15, duration: 0.35 }}
                >
                  <span className="absolute -top-px left-1/2 -translate-x-1/2 rounded-b bg-yellow-300 px-1 text-[8px] font-bold leading-tight text-black">
                    AI
                  </span>
                </motion.div>
              ))}
            </div>
            <div className="flex justify-center">
              <Label>Before</Label>
            </div>
          </div>

          <ProgressDots />

          {/* After: the 9:16 result, with a couple of cards stacked behind it. */}
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 translate-x-2 rotate-[4deg] rounded-2xl bg-white/[0.07]" aria-hidden />
              <div className="absolute inset-0 -translate-x-1 -rotate-[3deg] rounded-2xl bg-white/[0.05]" aria-hidden />
              <Phone className="relative h-60 sm:h-80">
                <div className="flex h-full flex-col">
                  {layout.panes.map((region, p) => (
                    <CroppedLoop key={p} name={layout.source} region={region} className="min-h-0 flex-1" />
                  ))}
                </div>
                <div className={cn("absolute inset-x-0", split ? "top-1/2 -translate-y-1/2" : "bottom-[22%]")}>
                  <p className="px-2 text-center text-sm font-black italic uppercase leading-tight sm:text-lg">
                    {layout.captions.slice(0, 2).map((w, k) => (
                      <span
                        key={k}
                        className={cn("mx-[0.15em]", k === captionWord ? "text-yellow-300" : "text-white")}
                        style={STROKE}
                      >
                        {w}
                      </span>
                    ))}
                  </p>
                </div>
              </Phone>
            </div>
            <div className="flex justify-center">
              <Label>{layout.label} layout</Label>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─── 4. Channel monitoring ─────────────────────────────────────────────── */

const CHANNELS: { name: string; handle: string; source: string; face: Region }[] = [
  { name: "Ranked Daily", handle: "@rankeddaily", source: "gameplay", face: { x: 0.03, y: 0.06, w: 0.18, h: 0.32 } },
  { name: "The Founders Pod", handle: "@founderspod", source: "podcast", face: { x: 0.3, y: 0.08, w: 0.17, h: 0.3 } },
  { name: "Money Frameworks", handle: "@moneyframeworks", source: "whiteboard", face: { x: 0.27, y: 0.1, w: 0.15, h: 0.27 } },
];

/** Which channel posts the new upload in the demo. */
const UPLOADER = 1;

const MONITOR_STEPS = ["Transcribing…", "Finding the best moments…", "Adding captions…"];

const MONITOR_CLIPS = [
  { x: 0.27, offset: 0, score: 96, caption: "Scale is" },
  { x: 0.3, offset: 1.8, score: 93, caption: "Long-term" },
  { x: 0.24, offset: 3.4, score: 91, caption: "High status" },
  { x: 0.29, offset: 5, score: 88, caption: "Trade it" },
];

/**
 * Watched channels on the left; one posts, an alert pops, the upload is
 * processed step by step and finished clips fan out — no upload, no clicks.
 */
function MonitorDemo() {
  const [stage, setStage] = useState(0);

  // 0 watching · 1 upload detected · 2-4 processing steps · 5 clips ready
  useEffect(() => {
    const timers = [900, 1700, 2600, 3500, 4400].map((ms, s) => setTimeout(() => setStage(s + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const uploader = CHANNELS[UPLOADER];
  const processing = stage >= 2 && stage < 5;
  const progress = stage >= 5 ? 100 : stage >= 2 ? 20 + (stage - 2) * 30 : 0;
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AmbientBg name={uploader.source} />

      <div className="relative flex h-full flex-col items-center justify-center gap-4 p-4 sm:flex-row sm:items-center sm:gap-10 sm:p-10">
        {/* Watched channels */}
        <div className="w-full max-w-[22rem] rounded-2xl border border-white/10 bg-[#13161d]/90 p-3 shadow-xl sm:p-4 shadow-black/40 backdrop-blur sm:w-[36%]">
          <div className="mb-3 flex items-center gap-2 px-1 text-xs font-medium text-emerald-300 sm:text-base">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Watching {CHANNELS.length} channels
          </div>
          <div className="space-y-2">
            {CHANNELS.map((c, i) => {
              const hit = i === UPLOADER && stage >= 1;
              return (
                <motion.div
                  key={c.handle}
                  animate={hit ? { scale: [1, 1.04, 1] } : {}}
                  transition={{ duration: 0.4 }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-2.5 py-2 transition-colors sm:py-3",
                    hit ? "border-emerald-400/50 bg-emerald-400/10" : "border-transparent bg-white/[0.03]",
                  )}
                >
                  <CroppedLoop name={c.source} region={c.face} className="h-8 w-8 shrink-0 rounded-full sm:h-11 sm:w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white sm:text-base">{c.name}</p>
                    <p className="truncate text-[10px] text-white/40 sm:text-xs">{c.handle}</p>
                  </div>
                  {hit ? (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">New</span>
                  ) : (
                    <Radio className="h-4 w-4 text-white/25" aria-hidden />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* The upload being processed, then the clips it produced */}
        <div className="flex w-full max-w-[34rem] flex-col items-center gap-3 sm:w-auto sm:flex-1">
          <AnimatePresence mode="wait">
            {stage >= 1 && stage < 5 && (
              <motion.div
                key="upload"
                className="w-full rounded-2xl border border-white/10 bg-[#13161d]/90 p-3 shadow-xl shadow-black/40 backdrop-blur"
                initial={{ opacity: 0, x: -40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
                transition={{ duration: 0.45, ease }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <CroppedLoop name={uploader.source} className="aspect-video w-24 rounded-lg sm:w-32" />
                    <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[9px] text-white">1:12:08</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400">New upload detected</p>
                    <p className="truncate text-sm font-medium text-white">{uploader.name}</p>
                    <p className="truncate text-xs text-white/45">Long-form podcast · 1h 12m</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-white/55">
                    <span>{processing ? MONITOR_STEPS[stage - 2] : "Queued"}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {stage >= 5 && (
              <motion.div key="clips" className="flex flex-col items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex gap-2 sm:gap-3.5">
                  {MONITOR_CLIPS.map((clip, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 24, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.12, duration: 0.45, ease }}
                    >
                      <Phone className="w-[4.5rem] sm:w-32">
                        <CroppedLoop name={uploader.source} region={portrait(clip.x)} offset={clip.offset} className="h-full w-full" />
                        <p className="absolute inset-x-0 bottom-[22%] px-1 text-center text-[10px] font-black italic uppercase leading-tight text-yellow-300 sm:text-sm" style={STROKE}>
                          {clip.caption}
                        </p>
                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] font-bold text-lime-300 sm:text-[10px]">
                          {clip.score}
                        </span>
                        <CheckCircle2 className="absolute right-1 top-1 h-3.5 w-3.5 text-emerald-400 sm:h-4 sm:w-4" aria-hidden />
                      </Phone>
                    </motion.div>
                  ))}
                </div>
                <p className="text-sm text-white/75 sm:text-base">
                  <span className="font-semibold text-white">4 clips ready</span> — no upload, no clicks
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {stage === 0 && (
            <p className="text-sm text-white/45">Waiting for the next upload…</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 5. Auto-publish ───────────────────────────────────────────────────── */

const DESTINATIONS: { label: string; Logo: (p: { className?: string }) => React.ReactNode; color: string }[] = [
  { label: "TikTok", Logo: TikTokLogo, color: "text-white" },
  { label: "Instagram Reels", Logo: Instagram, color: "text-pink-400" },
  { label: "YouTube Shorts", Logo: Youtube, color: "text-red-500" },
  { label: "LinkedIn", Logo: Linkedin, color: "text-sky-400" },
  { label: "X", Logo: XLogo, color: "text-white" },
];

function PublishDemo() {
  const done = useTicker(DESTINATIONS.length + 3, 650);

  return (
    <div className="relative flex h-full items-center justify-center gap-6 p-5 sm:gap-14 sm:p-10">
      <AmbientBg name="talking-head" />

      <Phone className="h-full max-h-[24rem]">
        <CroppedLoop name="talking-head" region={portrait(0.34)} className="h-full w-full" />
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-lime-300">
          92
        </span>
      </Phone>

      <div className="relative w-52 space-y-2 sm:w-80 sm:space-y-3">
        <p className="text-xs font-semibold text-white/80 sm:text-sm">Publishing to</p>
        {DESTINATIONS.map(({ label, Logo, color }, i) => {
          const sent = i < done;
          return (
            <div
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-1.5 pr-3 text-xs transition-colors sm:gap-4 sm:p-2.5 sm:pr-4 sm:text-base",
                sent ? "border-emerald-400/40 bg-emerald-400/[0.08] text-white" : "border-white/[0.06] bg-black/20 text-white/50",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10 backdrop-blur-md sm:h-12 sm:w-12">
                <Logo className={cn("h-5 w-5 sm:h-7 sm:w-7", color)} />
              </span>
              <span className="flex-1">{label}</span>
              {sent ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 sm:h-5 sm:w-5" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-white/20 sm:h-5 sm:w-5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
