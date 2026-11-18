"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Captions, Check, Sparkles, Youtube } from "lucide-react";
import { motion } from "framer-motion";
import { LogoIcon } from "@/components/ui/logo-icon";
import { AmbientBg, TikTokLogo } from "@/components/landing/feature-showcase";

const STROKE = { WebkitTextStroke: "1px black", paintOrder: "stroke fill" } as const;

const POINTS = [
  "AI finds the most viral moments",
  "Captions and 9:16 reframe, done for you",
  "Publish to TikTok, Shorts and Reels",
];

function FloatChip({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={`absolute z-20 ${className}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { duration: 0.5, delay },
        y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay },
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xl shadow-black/40 backdrop-blur-xl">
        {children}
      </div>
    </motion.div>
  );
}

/** Right-hand showcase: a live clip with floating status chips. */
function Showcase() {
  return (
    <div className="relative hidden overflow-hidden rounded-[2rem] border border-white/10 bg-[#07080f] lg:flex lg:flex-col lg:p-12 xl:p-14">
      <AmbientBg name="talking-head" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 10%, rgba(16,185,129,0.25), transparent 70%), radial-gradient(50% 50% at 90% 90%, rgba(20,184,166,0.18), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative">
        <p className="section-label-white mb-5">AI video clipping</p>
        <h2 className="max-w-xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white xl:text-5xl 2xl:text-6xl">
          One long video.{" "}
          <span className="block bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
            Dozens of shorts.
          </span>
        </h2>
        <ul className="mt-6 space-y-2.5">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-2.5 text-[15px] text-white/70">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-3 w-3 text-emerald-300" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex flex-1 items-center justify-center pt-8">
      <div className="relative h-[26rem] w-[14.625rem] 2xl:h-[30rem] 2xl:w-[16.875rem]">
        <div className="absolute inset-0 -z-0 scale-125 rounded-full bg-emerald-500/25 blur-3xl" aria-hidden />
        <div className="relative h-full overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl shadow-black/60">
          <video
            src="/assets/mockups/youtube.mp4"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <p
            className="absolute inset-x-3 bottom-[18%] text-center text-lg font-black uppercase leading-tight"
            style={STROKE}
          >
            <span className="text-white">No gear </span>
            <span className="text-yellow-300">needed</span>
          </p>
        </div>

        <FloatChip className="-left-24 top-10" delay={0.2}>
          <Sparkles className="h-4 w-4 text-lime-300" />
          Viral score <span className="text-lime-300">96</span>
        </FloatChip>
        <FloatChip className="-right-24 top-40" delay={0.8}>
          <Captions className="h-4 w-4 text-cyan-300" />
          Captions added
        </FloatChip>
        <FloatChip className="-left-20 -bottom-5" delay={1.4}>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-black ring-1 ring-white/20">
            <TikTokLogo className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600">
            <Youtube className="h-3.5 w-3.5 text-white" />
          </span>
          Ready to post
        </FloatChip>
      </div>
      </div>
    </div>
  );
}

/** Split-screen frame shared by /login and /register. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030014]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 40% at 25% 0%, rgba(16,185,129,0.14), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative grid min-h-screen gap-6 p-4 sm:p-6 lg:h-screen lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoIcon size={36} className="rounded-xl shadow-lg shadow-emerald-500/30" />
              <span className="text-lg font-bold text-white">
                Auto<span className="text-emerald-400">Clipr</span>
              </span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center py-10 lg:overflow-y-auto">{children}</div>
        </div>
        <Showcase />
      </div>
    </div>
  );
}
