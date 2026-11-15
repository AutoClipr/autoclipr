"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Reveal } from "@/components/ui/motion";
import { AmbientBg, CroppedLoop, type Region } from "@/components/landing/feature-showcase";
import { cn } from "@/lib/utils";

/**
 * "AI that understands every pixel of your video" — two large demo cards:
 * prompt-driven clip finding and subject-tracking reframe. Scripted demos
 * built from the silent loops in /public/showcase.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

function useTicker(count: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, ms]);
  return i;
}

/* ─── Clip finder card ──────────────────────────────────────────────────── */

const MOMENTS: { tag: string; offset: number; x: number }[] = [
  { tag: "Big idea", offset: 0, x: 0.3 },
  { tag: "Hot take", offset: 2.4, x: 0.36 },
  { tag: "Punchline", offset: 4.6, x: 0.35 },
];

function ClipFinderDemo() {
  const active = useTicker(MOMENTS.length, 2600);
  const moment = MOMENTS[active];

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 sm:aspect-[3/2]">
      <AmbientBg name="whiteboard" />

      <div className="relative flex h-full gap-4 p-5 sm:gap-6 sm:p-8">
        {/* Left: prompt, matched moment, tags and film strip */}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-xs font-semibold text-white sm:text-sm">Prompt</p>
          <div className="mt-2 truncate rounded-lg border border-white/10 bg-white/[0.08] px-3 py-2 text-[11px] text-white/85 backdrop-blur sm:text-sm">
            Moment most likely to go viral on social media
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <CroppedLoop
                  name="whiteboard"
                  offset={moment.offset}
                  className="aspect-video w-28 rounded-lg border border-white/10 sm:w-40"
                />
              </motion.div>
            </AnimatePresence>
            <div className="flex flex-wrap justify-center gap-1.5">
              {MOMENTS.map((m, i) => (
                <span
                  key={m.tag}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-medium transition-colors sm:text-xs",
                    i === active ? "bg-white/30 text-white" : "bg-white/10 text-white/70",
                  )}
                >
                  {m.tag}
                </span>
              ))}
            </div>
          </div>

          {/* Film strip with the matched moment highlighted */}
          <div className="relative flex overflow-hidden rounded-lg border-2 border-white/80">
            {MOMENTS.map((m) => (
              <CroppedLoop
                key={m.tag}
                name="whiteboard"
                offset={m.offset}
                className="aspect-video min-w-0 flex-1 opacity-60"
              />
            ))}
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-md border-2 border-yellow-400 bg-yellow-400/20"
              animate={{ left: `${(active * 100) / MOMENTS.length}%` }}
              transition={{ duration: 0.5, ease: EASE }}
            />
          </div>
        </div>

        {/* Right: the clip it produced */}
        <div className="relative aspect-[9/16] h-full shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <CroppedLoop
                name="whiteboard"
                region={{ x: moment.x, y: 0, w: 0.316, h: 1 }}
                offset={moment.offset}
                className="h-full w-full"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Reframe card ──────────────────────────────────────────────────────── */

const ASPECTS: { label: string; region: Region; box: string }[] = [
  { label: "9:16", region: { x: 0.27, y: 0, w: 0.316, h: 1 }, box: "aspect-[9/16] h-[78%]" },
  { label: "1:1", region: { x: 0.15, y: 0, w: 0.5625, h: 1 }, box: "aspect-square h-[58%]" },
  { label: "16:9", region: { x: 0, y: 0, w: 1, h: 1 }, box: "aspect-video w-[44%]" },
];

function ReframeDemo() {
  const i = useTicker(ASPECTS.length, 2800);
  const aspect = ASPECTS[i];
  const r = aspect.region;

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 sm:aspect-[3/2]">
      <AmbientBg name="podcast" />

      <div className="relative flex h-full items-center justify-center gap-4 p-5 sm:gap-8 sm:p-8">
        {/* Source with the tracked subject boxed in green */}
        <div className="relative w-[38%] shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-xl shadow-black/40">
          <CroppedLoop name="podcast" className="aspect-video w-full" />
          <motion.div
            className="absolute rounded-md border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
            animate={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
            }}
            transition={{ duration: 0.5, ease: EASE }}
          />
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2, 3].map((d) => (
            <motion.span
              key={d}
              className="h-1.5 w-1.5 rounded-full bg-white"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.18 }}
            />
          ))}
        </div>

        {/* Output in the current aspect ratio */}
        <div className="flex h-full w-[42%] shrink-0 flex-col items-center justify-center gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={aspect.label}
              className={cn("relative max-w-full overflow-hidden rounded-lg border border-white/10 shadow-2xl shadow-black/50", aspect.box, aspect.label === "16:9" && "w-full")}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <CroppedLoop name="podcast" region={r} className="absolute inset-0" />
            </motion.div>
          </AnimatePresence>
          <span className="text-xs font-semibold text-white sm:text-sm">{aspect.label}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Section ───────────────────────────────────────────────────────────── */

export function AiModels() {
  return (
    <section className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 text-center">
          <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60 sm:text-sm">
            <Sparkles className="h-4 w-4" />
            AI editing models
          </p>
          <h2 className="mx-auto max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
            AI that understands every pixel of
            <br />
            your video
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-white/55 sm:text-lg">
            AI editing that works on any video. Built for speed, accuracy, and creative flexibility.
          </p>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal>
            <ClipFinderDemo />
            <h3 className="mt-5 text-xl font-semibold text-white sm:text-2xl">AI Clip Finder</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50 sm:text-base">
              Not just podcasts. AutoClipr finds the moments worth posting in any genre — vlogs,
              gaming, interviews, explainers — and turns them into scored, captioned clips in one click.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <ReframeDemo />
            <h3 className="mt-5 text-xl font-semibold text-white sm:text-2xl">AI Reframe</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50 sm:text-base">
              Resize any video for any platform — 9:16, 1:1 or 16:9 — while AI tracking keeps the
              speaker centred in every frame.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
