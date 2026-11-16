"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Facebook, Instagram, Link2, Youtube, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureShowcase, TikTokLogo } from "@/components/landing/feature-showcase";
import { motion, Stagger, MotionItem } from "@/components/ui/motion";

/** Self-hosted 9:16 loops (shared with the platform cards further down). */
const CLIPS: {
  src: string;
  score: number;
  platform: string;
  Logo: (p: { className?: string }) => React.ReactNode;
  logoColor: string;
  caption: string[];
}[] = [
  { src: "/assets/mockups/youtube.mp4", score: 94, platform: "Shorts", Logo: Youtube, logoColor: "text-red-500", caption: ["No", "gear", "needed"] },
  { src: "/assets/mockups/instagram.mp4", score: 88, platform: "Reels", Logo: Instagram, logoColor: "text-pink-400", caption: ["Pick", "your", "vehicle"] },
  { src: "/assets/mockups/tiktok.mp4", score: 91, platform: "TikTok", Logo: TikTokLogo, logoColor: "text-white", caption: ["That", "was", "insane"] },
  { src: "/assets/mockups/facebook.mp4", score: 79, platform: "Reels", Logo: Facebook, logoColor: "text-blue-400", caption: ["Long-term", "high", "status"] },
];

const CAPTION_STROKE = { WebkitTextStroke: "1px black", paintOrder: "stroke fill" } as const;


const EASE = [0.22, 1, 0.36, 1] as const;


export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-12 pt-2 sm:px-6 lg:pt-2">
      {/* Ambient drifting orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <motion.div
          className="absolute left-[8%] top-[6%] h-72 w-72 rounded-full bg-emerald-500/[0.07] blur-3xl"
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[6%] top-[18%] h-80 w-80 rounded-full bg-violet-500/[0.06] blur-3xl"
          animate={{ x: [0, -50, 30, 0], y: [0, 40, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[10%] left-[35%] h-64 w-64 rounded-full bg-teal-500/[0.06] blur-3xl"
          animate={{ x: [0, 30, -40, 0], y: [0, -20, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <Stagger className="relative mx-auto max-w-[100vw] text-center" amount={0.1}>
        <MotionItem>
          <h1
            className="font-bold tracking-[-1.28px] leading-[1.1] px-2 text-darks-off-white"
            style={{ fontSize: "clamp(2rem, 5vw, 5rem)" }}
          >
            Turn long videos into
            <br />
            <RotatingPhrase />10x faster
          </h1>
        </MotionItem>

        <MotionItem>
          <p className="mx-auto mt-6 max-w-4xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Paste a link or drop a raw take, and AutoClipr clips, edits, sizes and publishes{" "}
            <br className="hidden sm:block" />
            them to all social platforms in one click.
          </p>
        </MotionItem>

        <MotionItem>
          <HeroUrlForm />
        </MotionItem>

        <MotionItem>
          <FeatureShowcase />
        </MotionItem>
      </Stagger>

      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, ease: EASE }}
        className="relative mx-auto mt-20 max-w-4xl"
      >
        <div className="glow-line mb-6 w-full opacity-80" />
        <motion.div
          className="gradient-border shadow-glow-lg"
          whileHover={{ y: -4, transition: { duration: 0.3, ease: EASE } }}
        >
          <div className="overflow-hidden p-1">
            <div className="relative overflow-hidden rounded-[calc(1rem-2px)] p-6 sm:p-8">
              {/* Blurred video background, like the showcase slides */}
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                <video
                  src="/showcase/podcast.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full scale-125 object-cover opacity-45 blur-3xl"
                />
                <div className="absolute inset-0 bg-black/40" />
              </div>

              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-left lg:max-w-[16rem]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                      Live monitoring
                    </span>
                  </div>
                  <p className="text-lg font-semibold sm:text-xl">
                    New upload detected → 4 clips ready in 2 minutes
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Auto subtitles · 9:16 export · TikTok, Reels & Shorts
                  </p>
                </div>
                <div className="flex shrink-0 justify-center gap-2.5 sm:gap-3">
                  {CLIPS.map((clip, i) => (
                    <motion.div
                      key={clip.src}
                      className="relative aspect-[9/16] w-[4.6rem] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-xl shadow-black/50 sm:w-32"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + i * 0.12, duration: 0.5, ease: EASE }}
                      whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.25 } }}
                    >
                      <video
                        src={clip.src}
                        autoPlay
                        muted
                        loop
                        playsInline
                        aria-hidden
                        className="absolute inset-0 h-full w-full object-cover"
                      />

                      {/* Platform logo in a frosted tile */}
                      <span className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/15 backdrop-blur-md sm:h-8 sm:w-8">
                        <clip.Logo className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${clip.logoColor}`} />
                      </span>

                      {/* Score — no fire icon */}
                      <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 sm:text-[11px]">
                        {clip.score}
                      </span>

                      {/* White caption with the key word in yellow */}
                      <p
                        className="absolute inset-x-1 bottom-[22%] z-10 text-center text-[10px] font-black uppercase leading-tight sm:text-sm"
                        style={CAPTION_STROKE}
                      >
                        {clip.caption.map((w, k) => (
                          <span key={k} className={k === 1 ? "text-yellow-300" : "text-white"}>
                            {w}{" "}
                          </span>
                        ))}
                      </p>

                      <span className="absolute bottom-1.5 left-1.5 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/85 backdrop-blur-sm sm:text-[10px]">
                        {clip.platform}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-400" />
            No credit card required
          </span>
          <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
          <span>30 credits free to start</span>
          <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
          <span>Cancel anytime</span>
        </div>
      </motion.div>
    </section>
  );
}

/**
 * "Paste a link → Get free clips" box. Sends the link to /create?url=…, which
 * prefills it. Signed-out visitors are bounced through /login by the
 * middleware, which keeps the ?url= in the redirect.
 */
function HeroUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = url.trim();
    router.push(value ? `/create?url=${encodeURIComponent(value)}` : "/create");
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-10 w-full max-w-2xl px-4 sm:px-0">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-2 pl-5 backdrop-blur focus-within:border-emerald-400/50">
        <Link2 className="h-5 w-5 shrink-0 text-white/40" aria-hidden />
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Drop a YouTube or video link"
          aria-label="Video link"
          className="min-w-0 flex-1 bg-transparent py-3 text-base text-white placeholder:text-white/40 focus:outline-none"
        />
        <Button type="submit" className="h-12 shrink-0 rounded-full bg-gradient-brand px-7 text-base text-white shadow-glow hover:scale-[1.02] hover:opacity-100 hover:shadow-glow-lg active:scale-[0.98]">
          Get free clips
        </Button>
      </div>
    </form>
  );
}

const PHRASES = ["viral shorts", "10 scored clips", "a week of posts", "captioned Reels"];

/**
 * The headline's rotating phrase: sits in a pill with a soft, blurred colour
 * wash; every few seconds the phrase blurs out, the next blurs in and the
 * pill resizes to fit.
 */
function RotatingPhrase() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % PHRASES.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <motion.span
        layout
        transition={{ layout: { duration: 0.45, ease: EASE } }}
        className="relative ml-[0.06em] mr-[0.28em] mt-[0.18em] inline-flex items-center overflow-hidden rounded-full bg-[#1b2528] px-[0.42em] py-[0.06em] align-baseline"
      >
        {/* A single soft glow in the middle, like a blurred video frame */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[190%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(236,160,170,0.55), rgba(196,140,150,0.28) 55%, transparent)",
          }}
        />

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={PHRASES[i]}
            layout="position"
            className="relative whitespace-nowrap text-[0.92em] font-semibold text-white/95"
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {PHRASES[i]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  );
}
