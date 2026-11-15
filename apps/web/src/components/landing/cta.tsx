"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Instagram, Link2, Youtube } from "lucide-react";
import { Reveal, motion } from "@/components/ui/motion";
import { AmbientBg, TikTokLogo } from "@/components/landing/feature-showcase";

const TRUST = ["3-day free trial", "No credit card needed", "Cancel anytime"];

const STROKE = {
  WebkitTextStroke: "1px black",
  paintOrder: "stroke fill",
} as const;

/** The fan of clips on the right: back-left, back-right, then the front one. */
const CLIPS: {
  src: string;
  score: number;
  caption: [string, string];
  Logo: (p: { className?: string }) => ReactNode;
  logoBg: string;
  style: string;
  float: number;
}[] = [
  {
    src: "/assets/mockups/instagram.mp4",
    score: 88,
    caption: ["Pick your", "vehicle"],
    Logo: Instagram,
    logoBg: "bg-gradient-to-br from-fuchsia-500 to-orange-400",
    style: "-rotate-[10deg] -translate-x-[78%] translate-y-4 scale-90",
    float: 0,
  },
  {
    src: "/assets/mockups/tiktok.mp4",
    score: 91,
    caption: ["That was", "insane"],
    Logo: TikTokLogo,
    logoBg: "bg-black",
    style: "rotate-[10deg] translate-x-[78%] translate-y-4 scale-90",
    float: 0.6,
  },
  {
    src: "/assets/mockups/youtube.mp4",
    score: 96,
    caption: ["No gear", "needed"],
    Logo: Youtube,
    logoBg: "bg-red-600",
    style: "z-10",
    float: 1.2,
  },
];

/** "Paste a link → Get free clips", same behaviour as the hero box. */
function CtaUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = url.trim();
    router.push(value ? `/create?url=${encodeURIComponent(value)}` : "/create");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 flex w-full max-w-md items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] p-1.5 pl-4 backdrop-blur focus-within:border-emerald-400/60"
    >
      <Link2 className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
      <input
        type="text"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a YouTube or video link"
        aria-label="Video link"
        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
      />
      <button
        type="submit"
        className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
      >
        Get free clips
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </form>
  );
}

export function CTA() {
  return (
    <section className="px-4 py-16 sm:px-6">
      <Reveal
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#07080f]"
        variant={{
          hidden: { opacity: 0, scale: 0.96, y: 24 },
          show: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
          },
        }}
      >
        {/* Blurred video + green glow behind everything */}
        <AmbientBg name="talking-head" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 70% at 15% 30%, rgba(16,185,129,0.28), transparent 70%), radial-gradient(45% 60% at 90% 80%, rgba(20,184,166,0.18), transparent 70%)",
          }}
          aria-hidden
        />
        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
          aria-hidden
        />

        <div className="relative grid items-center gap-12 px-6 py-14 sm:px-12 sm:py-16 lg:grid-cols-[1.1fr_1fr]">
          {/* Left: pitch + link box */}
          <div className="text-center lg:text-left">
            <p className="section-label-white mb-6">Start creating today</p>
            <h2 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ready to clip{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                smarter?
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-lg text-white/65 lg:mx-0">
              Paste one long video and get scored, captioned shorts ready for
              every platform — in minutes, with no editing.
            </p>

            <div className="flex justify-center lg:justify-start">
              <CtaUrlForm />
            </div>

            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
              {TRUST.map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-1.5 text-sm text-white/60"
                >
                  <Check className="h-4 w-4 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: a floating fan of finished clips */}
          <div className="relative mx-auto flex h-[22rem] w-full max-w-sm items-center justify-center sm:h-[26rem]">
            <div
              className="absolute h-56 w-56 rounded-full bg-emerald-500/25 blur-3xl"
              aria-hidden
            />
            {CLIPS.map((clip) => (
              // Outer div holds the tilt/offset; the inner one floats, so the
              // animation's transform doesn't override the tilt.
              <div
                key={clip.src}
                className={`absolute aspect-[9/16] w-36 sm:w-44 ${clip.style}`}
              >
                <motion.div
                  className="h-full"
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: clip.float,
                  }}
                >
                  <div className="relative h-full overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl shadow-black/60">
                    <video
                      src={clip.src}
                      autoPlay
                      muted
                      loop
                      playsInline
                      aria-hidden
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <span
                      className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg ${clip.logoBg}`}
                    >
                      <clip.Logo className="h-4 w-4 text-white" />
                    </span>
                    <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-lime-300">
                      {clip.score}
                    </span>
                    <p
                      className="absolute inset-x-2 bottom-[18%] text-center text-sm font-black uppercase leading-tight sm:text-base"
                      style={STROKE}
                    >
                      <span className="text-white">{clip.caption[0]} </span>
                      <span className="text-yellow-300">{clip.caption[1]}</span>
                    </p>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
