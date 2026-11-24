"use client";

/**
 * Video enhancements on the Create screen, grouped like an editor sidebar.
 * Toggling or previewing never charges: credits are taken when clips are
 * generated, estimated per minute and settled to the real clip lengths.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight, AudioLines, Clapperboard, Crown, Eye, Globe, Languages, Loader2, Maximize2, Palette, Scissors, Smile, Volume2, Wand2, Zap,
} from "lucide-react";
import { PlanUpgradeCard } from "@/components/billing/plan-upgrade-card";
import {
  DEFAULT_SETTINGS, GROUPS, LANGUAGES, estimateCredits, fetchEnhancements,
  type Enhancement, type EnhancementId, type EnhancementSettings,
} from "@/lib/enhancements";
import { cn } from "@/lib/utils";

const ICONS: Record<EnhancementId, typeof Wand2> = {
  motion_graphics: Wand2, ai_emojis: Smile, speech_cleanup: Scissors, enhance_audio: Volume2, auto_sfx: AudioLines,
  auto_zoom: Maximize2, transitions: ArrowLeftRight, color_correction: Palette, eye_contact: Eye, voice_dubbing: Globe, caption_translation: Languages,
};
const SAMPLE = "/showcase/podcast.jpg";

export function useEnhancementList() {
  const [data, setData] = useState<{ access: "basic" | "all"; items: Enhancement[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = (force = false) => {
    setError(null);
    fetchEnhancements(force).then(setData, (e: Error) => setError(e.message));
  };
  useEffect(() => load(), []);
  return { data, error, retry: () => load(true) };
}

export function EnhancementsPanel({
  value, onChange, clipCount, durations, image, hasJoins,
}: {
  value: EnhancementSettings;
  onChange: (v: EnhancementSettings) => void;
  clipCount: number;
  durations: number[];
  /** Still from the user's video for previews. */
  image?: string | null;
  /** Whether the clips will have parts to join (hook card / brand intro or outro). */
  hasJoins: boolean;
}) {
  const { data, error, retry } = useEnhancementList();
  const [upsell, setUpsell] = useState(false);
  const est = estimateCredits(data?.items, value, clipCount, durations);

  function toggle(e: Enhancement) {
    if (!e.available) return;
    if (value[e.id as keyof EnhancementSettings]) {
      const next = { ...value };
      delete next[e.id as keyof EnhancementSettings];
      return onChange(next);
    }
    if (!e.allowed) return setUpsell(true);
    const key = e.id as keyof EnhancementSettings;
    const next: EnhancementSettings = { ...value, [key]: { ...DEFAULT_SETTINGS[key] } };
    // Dubbing and caption translation share one language.
    if (key === "voice_dubbing" && value.caption_translation) next.voice_dubbing = { language: value.caption_translation.language };
    if (key === "caption_translation" && value.voice_dubbing) next.caption_translation = { language: value.voice_dubbing.language };
    onChange(next);
  }

  function set<K extends keyof EnhancementSettings>(key: K, patch: Partial<NonNullable<EnhancementSettings[K]>>) {
    const next = { ...value, [key]: { ...(value[key] as object), ...patch } } as EnhancementSettings;
    if ((key === "voice_dubbing" || key === "caption_translation") && "language" in patch) {
      const lang = (patch as { language: string }).language;
      if (next.voice_dubbing) next.voice_dubbing = { language: lang };
      if (next.caption_translation) next.caption_translation = { language: lang };
    }
    onChange(next);
  }

  return (
    <div className="border-t border-[#253244] pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#F8FAFC]"><Clapperboard className="h-4 w-4 text-[#54D045]" /> Enhancements</p>
        {est.credits > 0 && (
          <p className="text-xs text-[#94A3B8]"><Zap className="inline h-3 w-3 fill-[#54D045] text-[#54D045]" /> up to <span className="font-semibold text-white">{est.credits}</span> credits · {est.perMinute}/min × {est.minutes} min × {clipCount} clips, settled to real length</p>
        )}
      </div>
      {error ? (
        <p className="mt-3 text-xs text-[#fca5a5]">{error} <button type="button" onClick={retry} className="font-medium text-white underline">Retry</button></p>
      ) : !data ? (
        <div className="flex h-24 items-center justify-center text-[#64748B]"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="mt-2 space-y-5">
          {GROUPS.map((g) => (
            <div key={g.id}>
              <p className="mb-1 text-xs font-medium text-[#94A3B8]">{g.label}</p>
              <div className="divide-y divide-[#1c2636] rounded-xl border border-[#253244] bg-[#0A111B]">
                {data.items.filter((e) => e.group === g.id).map((e) => {
                  const Icon = ICONS[e.id];
                  const on = !!value[e.id as keyof EnhancementSettings];
                  return (
                    <div key={e.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#151F2E] text-[#CBD5E1]"><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-[#F8FAFC]">
                            {e.name}
                            {e.tier === "premium" && <Crown className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Premium" />}
                            {e.beta && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[#CBD5E1]">Beta</span>}
                            {!e.available && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[#94A3B8]">Coming soon</span>}
                            {e.creditsPerMinute > 0 && <span className="text-[11px] font-normal text-[#94A3B8]"><Zap className="inline h-3 w-3 fill-[#54D045] text-[#54D045]" />{e.creditsPerMinute}/min</span>}
                          </p>
                          <p className="truncate text-xs text-[#64748B]">{e.description}</p>
                        </div>
                        <button type="button" role="switch" aria-checked={on} aria-label={e.name} disabled={!e.available} onClick={() => toggle(e)}
                          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40", on ? "bg-[#54D045]" : "bg-[#334155]")}>
                          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
                        </button>
                      </div>
                      {on && <Config id={e.id} value={value} set={set} image={image ?? SAMPLE} hasJoins={hasJoins} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {upsell && <EnhanceUpgrade onClose={() => setUpsell(false)} />}
      <style>{`
        @keyframes fx-zoom { 0%,30% { transform: scale(1) } 40%,70% { transform: scale(var(--s, 1.14)) } 80%,100% { transform: scale(1) } }
        @keyframes fx-slideout { 0%,40% { transform: translateX(0) } 60%,100% { transform: translateX(-100%) } }
        @keyframes fx-zoomout { 0%,40% { transform: scale(1); opacity: 1 } 60%,100% { transform: scale(1.6); opacity: 0 } }
        @keyframes fx-wipe { 0%,40% { clip-path: inset(0 0 0 0) } 60%,100% { clip-path: inset(0 0 0 100%) } }
        @keyframes fx-pop { 0%,15% { transform: translate(-50%,-50%) scale(.2); opacity: 0 } 25% { transform: translate(-50%,-50%) scale(1.15); opacity: 1 } 32%,70% { transform: translate(-50%,-50%) scale(1); opacity: 1 } 80%,100% { opacity: 0 } }
        @keyframes fx-bar { from { width: 0 } to { width: 100% } }
        @keyframes fx-fade { 0%,40% { opacity: 1 } 55%,100% { opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .fx-anim { animation: none !important } }
      `}</style>
    </div>
  );
}

const seg = "inline-flex rounded-lg border border-[#253244] bg-[#101824] p-0.5";
const segBtn = (on: boolean) => cn("h-7 rounded-md px-2.5 text-xs font-medium capitalize", on ? "bg-[#263244] text-white" : "text-[#94A3B8] hover:text-white");
const lbl = "mb-1 block text-[11px] font-medium text-[#94A3B8]";

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className={lbl}>{label}</span>
      <div className={seg} role="radiogroup" aria-label={label}>
        {options.map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={segBtn(value === o)}>{o}</button>)}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-[#CBD5E1]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#54D045]" /> {label}
    </label>
  );
}

/** Small looping preview frame. */
function Frame({ image, children, className, imgStyle }: { image: string; children?: React.ReactNode; className?: string; imgStyle?: React.CSSProperties }) {
  return (
    <div className="relative aspect-[9/16] w-[72px] shrink-0 overflow-hidden rounded-lg bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className={cn("absolute inset-0 h-full w-full object-cover", className)} style={imgStyle} draggable={false} />
      {children}
    </div>
  );
}

function Config({ id, value, set, image, hasJoins }: {
  id: EnhancementId;
  value: EnhancementSettings;
  set: <K extends keyof EnhancementSettings>(key: K, patch: Partial<NonNullable<EnhancementSettings[K]>>) => void;
  image: string;
  hasJoins: boolean;
}) {
  const box = "mt-3 flex flex-wrap items-start gap-4 rounded-lg border border-[#1c2636] bg-[#0d1520] p-3 sm:ml-11";
  switch (id) {
    case "motion_graphics": {
      const v = value.motion_graphics!;
      return (
        <div className={box}>
          <Frame image={image}>
            {v.keywords && <span className="fx-anim absolute left-1/2 top-[58%] rounded px-1 text-[7px] font-black text-[#111]" style={{ background: v.color, animation: "fx-pop 2.4s infinite" }}>MONEY</span>}
            {v.progress_bar && <span className="fx-anim absolute bottom-0 left-0 h-[3px]" style={{ background: v.color, animation: "fx-bar 3s linear infinite" }} />}
          </Frame>
          <div className="space-y-2">
            <Check label="Keyword callouts on key moments" checked={v.keywords} onChange={(c) => set("motion_graphics", { keywords: c })} />
            <Check label="Progress bar" checked={v.progress_bar} onChange={(c) => set("motion_graphics", { progress_bar: c })} />
            <label className="flex items-center gap-2 text-xs text-[#CBD5E1]">
              <input type="color" value={v.color} onChange={(e) => set("motion_graphics", { color: e.target.value.toUpperCase() })} className="h-6 w-8 cursor-pointer rounded border border-[#253244] bg-transparent" aria-label="Graphics colour" /> Accent colour
            </label>
          </div>
        </div>
      );
    }
    case "ai_emojis": {
      const v = value.ai_emojis!;
      return (
        <div className={box}>
          <Frame image={image}>
            <span className="fx-anim absolute text-lg" style={{ left: v.position === "corner" ? "80%" : "50%", top: v.position === "corner" ? "12%" : "62%", animation: "fx-pop 2.4s infinite" }}>🔥</span>
          </Frame>
          <div className="flex flex-wrap gap-4">
            <Seg label="How many" value={v.density} options={["low", "medium", "high"]} onChange={(d) => set("ai_emojis", { density: d })} />
            <Seg label="Where" value={v.position} options={["above", "corner"]} onChange={(p) => set("ai_emojis", { position: p })} />
          </div>
          <p className="w-full text-[11px] text-[#64748B]">Placed from what is said: excitement, money, love, laughs, questions and more.</p>
        </div>
      );
    }
    case "speech_cleanup": {
      const v = value.speech_cleanup!;
      return (
        <div className={box}>
          <div className="space-y-2">
            <Check label="Remove filler words (um, uh, repeats)" checked={v.fillers} onChange={(c) => set("speech_cleanup", { fillers: c })} />
            <Check label="Shorten long pauses" checked={v.pauses} onChange={(c) => set("speech_cleanup", { pauses: c })} />
          </div>
          {v.pauses && (
            <label className="block w-48">
              <span className={lbl}>Pauses longer than {v.max_pause.toFixed(1)}s</span>
              <input type="range" min={0.3} max={2} step={0.1} value={v.max_pause} onChange={(e) => set("speech_cleanup", { max_pause: Number(e.target.value) })} className="w-full accent-[#54D045]" />
            </label>
          )}
          <p className="w-full text-[11px] text-[#64748B]">Uses word timings; captions and subtitles are re-timed to match. Sentences are kept whole.</p>
        </div>
      );
    }
    case "enhance_audio": {
      const v = value.enhance_audio!;
      return (
        <div className={box}>
          <Seg label="Noise reduction" value={v.noise} options={["light", "strong"]} onChange={(n) => set("enhance_audio", { noise: n })} />
          <p className="w-full text-[11px] text-[#64748B]">Removes hum and hiss, evens out loud and quiet parts, and sets loudness to −14 LUFS for social platforms.</p>
        </div>
      );
    }
    case "auto_sfx": {
      const v = value.auto_sfx!;
      return (
        <div className={box}>
          <Seg label="Intensity" value={v.intensity} options={["subtle", "normal", "bold"]} onChange={(i) => set("auto_sfx", { intensity: i })} />
          <label className="block w-40">
            <span className={lbl}>Volume · {v.volume}%</span>
            <input type="range" min={10} max={100} step={5} value={v.volume} onChange={(e) => set("auto_sfx", { volume: Number(e.target.value) })} className="w-full accent-[#54D045]" />
          </label>
          <p className="w-full text-[11px] text-[#64748B]">Whooshes on zooms and cuts, pops on callouts and emojis; bold adds hits on punchlines. Sounds are generated, not stock.</p>
        </div>
      );
    }
    case "auto_zoom": {
      const v = value.auto_zoom!;
      const scale = v.strength === "subtle" ? 1.08 : v.strength === "strong" ? 1.22 : 1.14;
      return (
        <div className={box}>
          <Frame image={image} className="fx-anim" imgStyle={{ animation: "fx-zoom 2.6s ease-in-out infinite", transformOrigin: "50% 42%", ["--s" as string]: scale }} />
          <Seg label="Strength" value={v.strength} options={["subtle", "medium", "strong"]} onChange={(s) => set("auto_zoom", { strength: s })} />
          <p className="w-full text-[11px] text-[#64748B]">Punch-ins on numbers, questions and stressed words, centred where faces usually are (no face tracking).</p>
        </div>
      );
    }
    case "transitions": {
      const v = value.transitions!;
      return (
        <div className={box}>
          <Frame image="/showcase/talking-head.jpg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" draggable={false} className="fx-anim absolute inset-0 h-full w-full object-cover"
              style={{
                animation: `${v.style === "fade" ? "fx-fade" : v.style === "zoom" ? "fx-zoomout" : v.style === "wipe" ? "fx-wipe" : "fx-slideout"} ${Math.max(2, v.duration * 5)}s ease-in-out infinite`,
              }} />
          </Frame>
          <Seg label="Style" value={v.style} options={["fade", "slide", "zoom", "wipe"]} onChange={(s) => set("transitions", { style: s })} />
          <label className="block w-40">
            <span className={lbl}>Length · {v.duration.toFixed(1)}s</span>
            <input type="range" min={0.2} max={1} step={0.1} value={v.duration} onChange={(e) => set("transitions", { duration: Number(e.target.value) })} className="w-full accent-[#54D045]" />
          </label>
          <p className={cn("w-full text-[11px]", hasJoins ? "text-[#64748B]" : "text-amber-300")}>
            {hasJoins ? "Used where the hook card, brand intro or outro joins the clip." : "Your clips have no joins yet: add an opening hook or a brand intro/outro for transitions to show."}
          </p>
        </div>
      );
    }
    case "color_correction": {
      const v = value.color_correction!;
      const css = { natural: "contrast(1.05) saturate(1.08) brightness(1.05)", vibrant: "contrast(1.1) saturate(1.35) brightness(1.05)", warm: "contrast(1.05) saturate(1.1) sepia(0.18) brightness(1.05)", cool: "contrast(1.05) saturate(1.05) hue-rotate(-12deg) brightness(1.05)" }[v.preset];
      return (
        <div className={box}>
          <div className="flex gap-1">
            <Frame image={image}><span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[8px] text-white">Before</span></Frame>
            <div style={{ filter: css }}><Frame image={image}><span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[8px] text-white">After</span></Frame></div>
          </div>
          <Seg label="Look" value={v.preset} options={["natural", "vibrant", "warm", "cool"]} onChange={(p) => set("color_correction", { preset: p })} />
          <p className="w-full text-[11px] text-[#64748B]">Auto-levels exposure and white balance, smoothed over time so scenes stay consistent. Preview is approximate.</p>
        </div>
      );
    }
    case "voice_dubbing":
    case "caption_translation": {
      const v = value[id]!;
      return (
        <div className={box}>
          <label className="block">
            <span className={lbl}>Language</span>
            <select value={v.language} onChange={(e) => set(id, { language: e.target.value })}
              className="h-8 rounded-lg border border-[#253244] bg-[#101824] px-2 text-sm text-white focus:border-[#54D045]/60 focus:outline-none">
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <p className="w-full text-[11px] text-[#64748B]">
            {id === "voice_dubbing"
              ? "AI voice in this language, timed to the original lines; the original track stays underneath at low volume. Captions switch to the same language."
              : "Captions and the downloadable SRT are translated with the same timing and caption style."}
          </p>
        </div>
      );
    }
    default:
      return null;
  }
}

function EnhanceUpgrade({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Upgrade for enhancements">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <PlanUpgradeCard icon={Crown} title="Make every clip look and sound pro."
          description="Creator, Pro and Business include every enhancement: cleaner audio, auto zoom, motion graphics, sound effects, colour and dubbing."
          benefits={["Enhance audio and speech cleanup", "Auto zoom, transitions and colour correction", "Motion graphics and auto sound effects", "AI voice dubbing in 11 languages", "Pay per minute only for what you use"]}
          onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
