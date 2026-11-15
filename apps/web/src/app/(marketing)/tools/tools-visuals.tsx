"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { CroppedLoop } from "@/components/landing/feature-showcase";

/** Small animated previews for the featured tool cards on /tools. */

function useTicker(count: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, ms]);
  return i;
}

const SEGMENTS = ["15s", "30s", "45s", "60s"];

/** Video with a timeline split into clips; the active segment moves along. */
export function SlicerVisual() {
  const active = useTicker(SEGMENTS.length, 1100);
  return (
    <div className="w-full">
      <CroppedLoop name="podcast" className="aspect-video w-full rounded-xl border border-white/10" />
      <div className="mt-3 flex gap-1.5">
        {SEGMENTS.map((s, i) => (
          <div
            key={s}
            className={`flex h-9 flex-1 items-center justify-center rounded-lg border text-[11px] font-semibold transition-all duration-300 ${
              i === active
                ? "border-emerald-400 bg-emerald-400/20 text-emerald-200 shadow-[0_0_16px_-4px_rgba(52,211,153,0.7)]"
                : "border-white/10 bg-white/[0.04] text-white/45"
            }`}
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

const FORMATS: [string, string][] = [
  ["MP4", "WebM"],
  ["MOV", "MP4"],
  ["MP4", "GIF"],
  ["MP4", "MP3"],
];

/** "MP4 → WebM" style chips that cycle through conversions. */
export function ConverterVisual() {
  const i = useTicker(FORMATS.length, 1600);
  const [from, to] = FORMATS[i];
  return (
    <div className="flex items-center justify-center gap-3">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={`f-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white"
        >
          {from}
        </motion.span>
      </AnimatePresence>
      <ArrowRight className="h-5 w-5 text-violet-300" />
      <AnimatePresence mode="popLayout">
        <motion.span
          key={`t-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-xl border border-violet-400/50 bg-violet-500/20 px-4 py-2.5 text-sm font-bold text-violet-100 shadow-[0_0_20px_-6px_rgba(167,139,250,0.8)]"
        >
          {to}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/** A 16:9 frame next to its 9:16 reframe. */
export function ReframeVisual() {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="space-y-1.5 text-center">
        <CroppedLoop name="podcast" className="aspect-video w-28 rounded-lg border border-white/10" />
        <p className="text-[10px] font-semibold text-white/50">16:9</p>
      </div>
      <ArrowRight className="h-4 w-4 text-orange-300" />
      <div className="space-y-1.5 text-center">
        <CroppedLoop
          name="podcast"
          region={{ x: 0.27, y: 0, w: 0.316, h: 1 }}
          className="aspect-[9/16] w-16 rounded-lg border border-orange-400/50 shadow-[0_0_20px_-6px_rgba(251,146,60,0.8)]"
        />
        <p className="text-[10px] font-semibold text-orange-200">9:16</p>
      </div>
    </div>
  );
}
