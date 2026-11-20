"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownCircle,
  CalendarDays,
  Facebook,
  Instagram,
  Linkedin,
  RefreshCw,
  Wand2,
  Youtube,
} from "lucide-react";
import { Reveal } from "@/components/ui/motion";
import { AmbientBg, CroppedLoop, TikTokLogo, XLogo } from "@/components/landing/feature-showcase";

/**
 * "Your video creation process — now on autopilot": one wide card showing
 * the three automated steps — import, edit, schedule — joined by arrows.
 */

const STROKE = { WebkitTextStroke: "1px black", paintOrder: "stroke fill" } as const;

const PUBLISH_TO: { Logo: (p: { className?: string }) => ReactNode; bg: string }[] = [
  { Logo: Youtube, bg: "bg-red-600" },
  { Logo: Facebook, bg: "bg-blue-600" },
  { Logo: TikTokLogo, bg: "bg-black" },
  { Logo: Instagram, bg: "bg-gradient-to-br from-fuchsia-500 to-orange-400" },
  { Logo: Linkedin, bg: "bg-sky-600" },
  { Logo: XLogo, bg: "bg-black" },
];

/** Dashed arrow with a slowly spinning refresh icon in the middle. */
function FlowArrow() {
  return (
    <div className="hidden shrink-0 items-center gap-1.5 text-white/60 lg:flex" aria-hidden>
      <span className="w-6 border-t-2 border-dashed border-white/50" />
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur">
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
          <RefreshCw className="h-4 w-4 text-white" />
        </motion.span>
      </span>
      <span className="w-6 border-t-2 border-dashed border-white/50" />
      <span className="-ml-2 text-white/60">›</span>
    </div>
  );
}

function Step({
  visual,
  icon,
  title,
  children,
}: {
  visual: ReactNode;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-44 items-center justify-center sm:h-48">{visual}</div>
      <h3 className="mt-6 flex items-center gap-2.5 text-lg font-semibold text-white sm:text-xl">
        {icon}
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{children}</p>
    </div>
  );
}

/* ─── Step visuals ──────────────────────────────────────────────────────── */

function ImportVisual() {
  return (
    <div className="relative w-52 sm:w-56">
      {/* stacked cards behind */}
      <div className="absolute inset-x-3 -bottom-3 h-full rounded-xl bg-white/[0.08]" aria-hidden />
      <div className="absolute inset-x-1.5 -bottom-1.5 h-full rounded-xl bg-white/[0.12]" aria-hidden />
      <div className="relative overflow-hidden rounded-xl border border-white/10 shadow-xl shadow-black/50">
        <CroppedLoop name="podcast" className="aspect-video w-full" />
      </div>
      {/* New-upload notification */}
      <motion.div
        className="absolute bottom-1.5 right-1.5 z-10 w-[38%] rounded-md bg-white px-1.5 py-1 text-left shadow-lg"
        initial={{ opacity: 0, x: 12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <span className="absolute -right-1 -top-1.5 rounded bg-yellow-400 px-1 py-px text-[7px] font-bold text-black">
          New
        </span>
        <div className="flex items-center gap-0.5 text-[7px] text-black/55">
          <Youtube className="h-2.5 w-2.5 shrink-0 text-red-600" />
          <span className="font-semibold text-black">YouTube</span>
        </div>
        <p className="mt-0.5 truncate text-[9px] font-semibold leading-tight text-black">New episode</p>
        <p className="truncate text-[7px] text-black/45">1h 12m · just now</p>
      </motion.div>
    </div>
  );
}

function EditVisual() {
  return (
    <div className="relative h-44 w-[6.5rem] sm:h-48 sm:w-28">
      <div className="absolute inset-0 translate-x-3 -translate-y-1 rounded-xl bg-white/[0.1]" aria-hidden />
      <div className="absolute inset-0 translate-x-1.5 rounded-xl bg-white/[0.14]" aria-hidden />
      <div className="relative h-full overflow-hidden rounded-xl border border-white/10 shadow-xl shadow-black/50">
        <CroppedLoop name="podcast" region={{ x: 0.27, y: 0, w: 0.316, h: 1 }} offset={2} className="h-full w-full" />
        <p className="absolute inset-x-1 bottom-[28%] text-center text-[11px] font-black uppercase leading-tight" style={STROKE}>
          <span className="text-white">Trade </span>
          <span className="text-yellow-300">status</span>
        </p>
      </div>
    </div>
  );
}

function ScheduleVisual() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-44 w-[6.5rem] shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-xl shadow-black/50 sm:h-48 sm:w-28">
        <CroppedLoop name="talking-head" region={{ x: 0.34, y: 0, w: 0.316, h: 1 }} className="h-full w-full" />
      </div>
      <div className="text-left">
        <p className="text-sm font-medium text-white">New video</p>
        <div className="mt-2 flex -space-x-2">
          {PUBLISH_TO.map(({ Logo, bg }, i) => (
            <span
              key={i}
              className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white/20 ${bg}`}
              style={{ zIndex: PUBLISH_TO.length - i }}
            >
              <Logo className="h-4 w-4 text-white" />
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-white">9:00am IST</p>
        <p className="text-xs text-white/55">every day</p>
      </div>
    </div>
  );
}

/* ─── Section ───────────────────────────────────────────────────────────── */

export function WorkflowAutomation() {
  return (
    // id="how-it-works": target of the "How it works" links in the navbar,
    // footer and mobile menu.
    <section id="how-it-works" className="relative scroll-mt-16 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 text-center">
          <p className="section-label-white mx-auto mb-4">Workflow automation</p>
          <h2 className="mx-auto max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Your video creation process — now
            <br />
            on autopilot
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-white/55 sm:text-lg">
            Create and publish videos 10x faster with AutoClipr, so you can go on vacation and still
            keep your content rolling.
          </p>
        </Reveal>

        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 px-6 py-10 sm:px-12 sm:py-14">
            <AmbientBg name="podcast" />
            {/* Warm glow, like the reference */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(60% 80% at 25% 60%, rgba(180,120,80,0.35), transparent 70%)" }}
              aria-hidden
            />

            <div className="relative flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-4">
              <Step
                visual={<ImportVisual />}
                icon={<ArrowDownCircle className="h-5 w-5" />}
                title="Auto import"
              >
                Watches your YouTube channels and pulls in every new upload the moment it goes live, so
                you never miss a moment to clip and share.
              </Step>

              <div className="hidden h-44 items-center lg:flex sm:h-48">
                <FlowArrow />
              </div>

              <Step visual={<EditVisual />} icon={<Wand2 className="h-5 w-5" />} title="Auto editing">
                AI finds the best moments, then clips, captions and reframes them to 9:16 — scored and
                ready to post with no extra editing.
              </Step>

              <div className="hidden h-44 items-center lg:flex sm:h-48">
                <FlowArrow />
              </div>

              <Step
                visual={<ScheduleVisual />}
                icon={<CalendarDays className="h-5 w-5" />}
                title="Auto scheduling"
              >
                Publishes your clips across platforms on a schedule, so you stay consistent and show up
                everywhere without lifting a finger. Included in the Creator, Pro and Business plans.
              </Step>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
