"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Captions,
  CheckCircle2,
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

  return (
    <div
      className="mx-auto mt-12 w-full max-w-5xl px-4 text-left sm:px-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-2xl shadow-black/40 sm:aspect-[16/9]">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.35 }}
          >
            {active === "clipping" && <ClippingDemo />}
            {active === "captions" && <CaptionsDemo />}
            {active === "reframe" && <ReframeDemo />}
            {active === "monitor" && <MonitorDemo />}
            {active === "publish" && <PublishDemo />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        role="tablist"
        aria-label="AutoClipr features"
        className="mt-5 flex flex-wrap items-center justify-center gap-2"
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

const CLIPS = [
  { x: 0.2, offset: 0, score: 94, title: "The idiot index" },
  { x: 0.26, offset: 2.4, score: 88, title: "Pick your vehicle" },
  { x: 0.22, offset: 4.6, score: 81, title: "Moat-built businesses" },
];

function ClippingDemo() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-5 sm:flex-row sm:gap-10 sm:p-10">
      <motion.div
        className="w-full max-w-[22rem] space-y-2 sm:w-[42%]"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <CroppedLoop name="whiteboard" className="aspect-video rounded-xl border border-white/10" />
        <p className="text-center text-xs text-white/50">1 long video · 17 min</p>
      </motion.div>

      <div className="flex gap-2.5 sm:gap-3">
        {CLIPS.map((clip, i) => (
          <motion.div
            key={clip.title}
            initial={{ opacity: 0, y: 30, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.25, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-[5.5rem] sm:w-36"
          >
            <Phone>
              <CroppedLoop name="whiteboard" region={portrait(clip.x)} offset={clip.offset} className="h-full w-full" />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                {clip.score}🔥
              </span>
            </Phone>
            <p className="mt-1.5 truncate text-center text-[11px] text-white/60">{clip.title}</p>
          </motion.div>
        ))}
      </div>
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
