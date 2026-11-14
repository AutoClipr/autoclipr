"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Captions,
  CheckCircle2,
  Facebook,
  Instagram,
  Link2,
  Linkedin,
  Pointer,
  Music2,
  Twitter,
  Youtube,
  ChevronLeft,
  ChevronRight,
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
    }, ADVANCE_MS);
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
            className="absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 backdrop-blur transition hover:bg-black/80 hover:text-white sm:flex"
            style={{
              left: d < 0 ? "calc(50% - var(--card) / 2 - 1.25rem)" : "calc(50% + var(--card) / 2 - 1.25rem)",
            }}
          >
            {d < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
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
                  transition={{ duration: ADVANCE_MS / 1000, ease: "linear" }}
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
  { icon: Music2, className: "bg-black ring-1 ring-white/20" },
  { icon: Facebook, className: "bg-blue-600" },
  { icon: Twitter, className: "bg-black ring-1 ring-white/20" },
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

const CAPTION_PRESETS = [
  { id: "viral", label: "Viral Style" },
  { id: "karaoke", label: "Karaoke" },
  { id: "animated", label: "Animated" },
  { id: "emoji", label: "Emoji Captions" },
] as const;

type PresetId = (typeof CAPTION_PRESETS)[number]["id"];

function CaptionLine({ preset, word }: { preset: PresetId; word: number }) {
  // Show a 3-word window that slides with the spoken word.
  const start = Math.max(0, Math.min(word - 1, CAPTION_WORDS.length - 3));
  const words = CAPTION_WORDS.slice(start, start + 3);

  return (
    <p className="flex flex-wrap justify-center gap-x-1.5 px-2 text-center text-[15px] font-black uppercase leading-tight sm:text-lg">
      {words.map((w, i) => {
        const on = start + i === word;
        if (preset === "karaoke") {
          return (
            <span key={w} className={cn("transition-colors", on ? "text-yellow-300" : "text-white")} style={{ WebkitTextStroke: "1px black" }}>
              {w}
            </span>
          );
        }
        if (preset === "animated") {
          return (
            <motion.span
              key={w}
              animate={{ scale: on ? 1.25 : 1, y: on ? -3 : 0 }}
              className={cn("inline-block", on ? "text-white" : "text-white/80")}
              style={{ WebkitTextStroke: "1px black" }}
            >
              {w}
            </motion.span>
          );
        }
        if (preset === "emoji") {
          return (
            <span key={w} className="text-white" style={{ WebkitTextStroke: "1px black" }}>
              {w}
              {on && w === "expensive" ? " 💸" : on && w === "start" ? " 🚀" : ""}
            </span>
          );
        }
        return (
          <span
            key={w}
            className={cn("rounded px-1", on ? "bg-emerald-400 text-black" : "text-white")}
            style={on ? undefined : { WebkitTextStroke: "1px black" }}
          >
            {w}
          </span>
        );
      })}
    </p>
  );
}

function CaptionsDemo() {
  const word = useTicker(CAPTION_WORDS.length, 420);
  const presetIndex = useTicker(CAPTION_PRESETS.length, 2000);
  const preset = CAPTION_PRESETS[presetIndex].id;

  return (
    <div className="flex h-full items-center justify-center gap-5 p-5 sm:gap-12 sm:p-10">
      <Phone className="h-full max-h-[26rem]">
        <CroppedLoop name="talking-head" region={portrait(0.34)} className="h-full w-full" />
        <div className="absolute inset-x-0 bottom-[22%]">
          <CaptionLine preset={preset} word={word} />
        </div>
      </Phone>

      <div className="w-40 rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur sm:w-56">
        <p className="mb-2 text-xs font-semibold text-white/80">Caption style</p>
        <div className="space-y-1.5">
          {CAPTION_PRESETS.map((p) => (
            <div
              key={p.id}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs transition-all",
                p.id === preset
                  ? "border-emerald-400/70 bg-emerald-400/10 text-white"
                  : "border-white/[0.06] bg-white/[0.03] text-white/50",
              )}
            >
              {p.label}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-white/40">Word-by-word captions in 6 languages</p>
      </div>
    </div>
  );
}

/* ─── 3. Auto reframe ───────────────────────────────────────────────────── */

const LAYOUTS: {
  label: string;
  source: string;
  panes: Region[];
}[] = [
  { label: "Fill", source: "podcast", panes: [portrait(0.27)] },
  {
    label: "Gameplay",
    source: "gameplay",
    panes: [
      { x: 0, y: 0.02, w: 0.24, h: 0.38 },
      { x: 0.3, y: 0.2, w: 0.5, h: 0.79 },
    ],
  },
  {
    label: "Screen share",
    source: "screenshare",
    panes: [
      { x: 0.15, y: 0.02, w: 0.55, h: 0.87 },
      { x: 0.7, y: 0.6, w: 0.24, h: 0.38 },
    ],
  },
];

function ReframeDemo() {
  const i = useTicker(LAYOUTS.length, ADVANCE_MS / LAYOUTS.length);
  const layout = LAYOUTS[i];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-5 sm:flex-row sm:gap-10 sm:p-10">
      <div className="w-full max-w-[22rem] space-y-2 sm:w-[46%]">
        <CroppedLoop key={layout.source} name={layout.source} className="aspect-video rounded-xl border border-white/10" />
        <div className="flex justify-center">
          <Label>Before · 16:9</Label>
        </div>
      </div>

      <div className="flex gap-1.5 text-white/30" aria-hidden>
        {[0, 1, 2].map((d) => (
          <motion.span
            key={d}
            className="h-1.5 w-1.5 rounded-full bg-current"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.2 }}
          />
        ))}
      </div>

      <div className="space-y-2">
        <Phone className="h-56 sm:h-80">
          <AnimatePresence mode="wait">
            <motion.div
              key={layout.label}
              className="flex h-full flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {layout.panes.map((region, p) => (
                <CroppedLoop key={p} name={layout.source} region={region} className="min-h-0 flex-1" />
              ))}
            </motion.div>
          </AnimatePresence>
        </Phone>
        <div className="flex justify-center">
          <Label>{layout.label} layout · 9:16</Label>
        </div>
      </div>
    </div>
  );
}

/* ─── 4. Channel monitoring ─────────────────────────────────────────────── */

function MonitorDemo() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [800, 2600, 4600].map((ms, s) => setTimeout(() => setStage(s + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-5 sm:gap-6 sm:p-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Watching 3 YouTube channels
        </div>

        <AnimatePresence>
          {stage >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-3 rounded-xl bg-white/[0.05] p-2.5"
            >
              <CroppedLoop name="podcast" className="aspect-video w-24 shrink-0 rounded-md" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">New upload detected</p>
                <p className="truncate text-xs text-white/50">Long-form podcast · 1h 12m</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {stage >= 2 && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-white/50">
              <span>{stage >= 3 ? "Done" : "Finding the best moments…"}</span>
              <span>{stage >= 3 ? "100%" : ""}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
                initial={{ width: "4%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2.5">
        {[0.27, 0.3, 0.25, 0.29].map((x, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={stage >= 3 ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.15 }}
          >
            <Phone className="w-16 sm:w-24">
              <CroppedLoop name="podcast" region={portrait(x)} offset={i * 1.6} className="h-full w-full" />
            </Phone>
          </motion.div>
        ))}
      </div>
      {stage >= 3 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-white/70">
          4 clips ready — no upload, no clicks
        </motion.p>
      )}
    </div>
  );
}

/* ─── 5. Auto-publish ───────────────────────────────────────────────────── */

const DESTINATIONS = ["TikTok", "Instagram Reels", "YouTube Shorts", "LinkedIn", "X"];

function PublishDemo() {
  const done = useTicker(DESTINATIONS.length + 3, 650);

  return (
    <div className="flex h-full items-center justify-center gap-6 p-5 sm:gap-14 sm:p-10">
      <Phone className="h-full max-h-[24rem]">
        <CroppedLoop name="talking-head" region={portrait(0.34)} className="h-full w-full" />
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
          92🔥
        </span>
      </Phone>

      <div className="w-44 space-y-2 sm:w-60">
        <p className="text-xs font-semibold text-white/80">Publishing to</p>
        {DESTINATIONS.map((d, i) => {
          const sent = i < done;
          return (
            <div
              key={d}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors",
                sent ? "border-emerald-400/40 bg-emerald-400/[0.08] text-white" : "border-white/[0.06] text-white/45",
              )}
            >
              {d}
              {sent ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-white/20" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
