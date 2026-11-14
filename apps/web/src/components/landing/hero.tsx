"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Link2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { motion, Stagger, MotionItem } from "@/components/ui/motion";

const CLIPS = [
  { id: "LmxTVsJfInQ", score: 94, platform: "TikTok", border: "from-violet-500 to-pink-500" },
  { id: "mXTlAKm0VEo", score: 88, platform: "Reels",  border: "from-rose-500 to-orange-400" },
  { id: "Ypbsei0ug7w", score: 91, platform: "Shorts", border: "from-cyan-500 to-blue-500"   },
  { id: "aiQrLxzu9ug", score: 79, platform: "TikTok", border: "from-emerald-500 to-teal-400" },
];


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
          <motion.span
            className="section-label mx-auto mb-8 inline-flex"
            whileHover={{ scale: 1.04 }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Video Clipping
          </motion.span>
        </MotionItem>

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
            <div className="rounded-[calc(1rem-2px)] bg-gradient-brand-subtle p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-left">
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
                <div className="flex shrink-0 gap-2.5">
                  {CLIPS.map((clip, i) => (
                    <motion.div
                      key={clip.id}
                      className="group relative h-44 w-24 overflow-hidden rounded-2xl bg-black shadow-xl sm:h-52 sm:w-28"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + i * 0.12, duration: 0.5, ease: EASE }}
                      whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.25 } }}
                    >
                      {/* Gradient border ring */}
                      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${clip.border} p-[1.5px]`}>
                        <div className="h-full w-full rounded-2xl bg-black" />
                      </div>

                      {/* YouTube Short iframe */}
                      {/* credentialless attr needed for COEP credentialless policy */}
                      <iframe
                        src={`https://www.youtube.com/embed/${clip.id}?autoplay=1&mute=1&loop=1&playlist=${clip.id}&controls=0&modestbranding=1&rel=0&showinfo=0`}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        // @ts-expect-error credentialless is a newer attr not yet in React types
                        credentialless=""
                        className="absolute inset-0 h-full w-full scale-[1.35] rounded-2xl"
                        style={{ border: "none", pointerEvents: "none" }}
                      />

                      {/* Score badge */}
                      <div className="absolute left-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 backdrop-blur-sm">
                        <span className="text-[9px] font-bold text-emerald-400">{clip.score}</span>
                        <span className="text-[8px]">🔥</span>
                      </div>

                      {/* Platform badge */}
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10 rounded-lg bg-black/70 px-1.5 py-1 backdrop-blur-sm">
                        <span className="text-[9px] font-semibold text-white/80">{clip.platform}</span>
                        <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-white/20">
                          <div className={`h-full rounded-full bg-gradient-to-r ${clip.border}`} style={{ width: `${clip.score}%` }} />
                        </div>
                      </div>
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
        <Button type="submit" variant="gradient" className="h-12 shrink-0 rounded-full px-7 text-base">
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
