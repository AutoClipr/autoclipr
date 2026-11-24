"use client";

/**
 * AI Hook & Headline: section for the Create screen, the Hook Studio modal
 * and a live preview. Previews are drawn in the browser over the user's own
 * video (or a sample clip) and never charge credits; the real hook is
 * rendered by the worker into the exported clip.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EB_Garamond, Montserrat, Pacifico } from "next/font/google";
import { Anchor, Check, ChevronLeft, ChevronRight, Crown, Loader2, Pause, Play, RotateCcw, Search, Sparkles, X, Zap } from "lucide-react";
import { PlanUpgradeCard } from "@/components/billing/plan-upgrade-card";
import {
  DEFAULT_HOOK,
  HOOK_ANIMATIONS,
  HOOK_BACKGROUNDS,
  HOOK_FONTS,
  fetchHookTemplates,
  resolveLook,
  wrapHookLines,
  type HookAccess,
  type HookKind,
  type HookLook,
  type HookSettings,
  type HookTemplate,
} from "@/lib/hooks";
import { cn } from "@/lib/utils";

const sans = Montserrat({ subsets: ["latin"], weight: ["600", "800", "900"], style: ["normal", "italic"], variable: "--hk-sans", display: "swap" });
const serif = EB_Garamond({ subsets: ["latin"], weight: ["400"], style: ["normal", "italic"], variable: "--hk-serif", display: "swap" });
const script = Pacifico({ subsets: ["latin"], weight: "400", variable: "--hk-script", display: "swap" });
const FONT_VARS = `${sans.variable} ${serif.variable} ${script.variable}`;
const FAMILY = { sans: "var(--hk-sans), Inter, sans-serif", serif: "var(--hk-serif), Georgia, serif", script: "var(--hk-script), cursive" };

const GREEN = "#54D045";
const SAMPLE_STILLS = ["/showcase/podcast.jpg", "/showcase/talking-head.jpg"];
const SAMPLE_VIDEO = "/showcase/podcast.mp4";
const SAMPLE_TEXT: Record<HookKind, string> = { viral: "The secret nobody tells you", headline: "How I doubled my reach in 30 days" };

export type HookMedia = { video?: string | null; image?: string | null };

/* ─── Templates ─────────────────────────────────────────────────────── */

export function useHookTemplates() {
  const [state, setState] = useState<{ access: HookAccess; templates: HookTemplate[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = (force = false) => {
    setError(null);
    fetchHookTemplates(force).then(setState, (e: Error) => setError(e.message));
  };
  useEffect(() => load(), []);
  return { data: state, error, retry: () => load(true) };
}

/* ─── Section on the Create screen ──────────────────────────────────── */

export function HookSection({
  hook,
  onChange,
  clipCount,
  ratio,
  media,
  brandPrimary,
}: {
  hook: HookSettings;
  onChange: (h: HookSettings) => void;
  clipCount: number;
  ratio: string;
  media?: HookMedia;
  brandPrimary?: string | null;
}) {
  const { data, error, retry } = useHookTemplates();
  const [studio, setStudio] = useState<{ kind: HookKind; focus?: string } | null>(null);
  const [upsell, setUpsell] = useState<"none" | "premium" | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const access = data?.access ?? "none";
  const list = (data?.templates ?? []).filter((t) => t.kind === hook.kind);
  const current = data?.templates.find((t) => t.id === hook.template_id);
  const set = (p: Partial<HookSettings>) => onChange({ ...hook, ...p });

  function toggle() {
    if (hook.enabled) return set({ enabled: false });
    if (access === "none") return setUpsell("none");
    // Make sure the selection is one the plan allows.
    const t = current?.allowed ? current : list.find((x) => x.allowed);
    if (!t) return setUpsell("premium");
    set({ enabled: true, template_id: t.id, duration: hook.duration || t.defaultSeconds });
  }

  function pick(t: HookTemplate) {
    if (!t.allowed) return setStudio({ kind: t.kind, focus: t.id });
    set({ enabled: true, kind: t.kind, template_id: t.id, duration: hook.template_id === t.id ? hook.duration : t.defaultSeconds });
  }

  function switchKind(kind: HookKind) {
    const first = data?.templates.find((t) => t.kind === kind && t.allowed) ?? data?.templates.find((t) => t.kind === kind);
    if (!first) return set({ kind });
    set({ kind, template_id: first.id, duration: first.defaultSeconds, ...(kind === "viral" ? { font: undefined, size: undefined, color: undefined, bg_color: undefined, position: undefined, animation: undefined, background: undefined } : {}) });
  }

  return (
    <div className={cn("border-t border-[#253244] pt-6", FONT_VARS)}>
      <HookKeyframes />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0A111B]">
            <Anchor className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[#F8FAFC]">
              AI Hook &amp; Headline
              {access === "none" && <Crown className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#CBD5E1]">Beta</span>
            </p>
            <p className="text-xs text-[#94A3B8]">Create attention-grabbing openings with animated hooks and professional headlines.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-[#253244] bg-[#0A111B] p-0.5" role="radiogroup" aria-label="Hook type">
            {(["viral", "headline"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={hook.kind === k} onClick={() => switchKind(k)}
                className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium", hook.kind === k ? "bg-[#263244] text-white" : "text-[#94A3B8] hover:text-white")}>
                {k === "viral" ? "Viral hook" : "Headline"}
              </button>
            ))}
          </div>
          <button type="button" role="switch" aria-checked={hook.enabled} aria-label="Use AI hook" onClick={toggle}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", hook.enabled ? "bg-[#54D045]" : "bg-[#334155]")}>
            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", hook.enabled ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
      </div>

      {/* Template strip */}
      <div className="relative mt-4">
        {error ? (
          <p className="text-xs text-[#fca5a5]">
            {error} <button type="button" onClick={retry} className="font-medium text-white underline">Retry</button>
          </p>
        ) : !data ? (
          <div className="flex h-[150px] items-center justify-center text-[#64748B]"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div ref={strip} className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {list.slice(0, 8).map((t, i) => (
                <TemplateCard key={t.id} t={t} still={media?.image ?? SAMPLE_STILLS[i % SAMPLE_STILLS.length]} ratio="9:16"
                  selected={hook.enabled && hook.template_id === t.id} onClick={() => pick(t)} widthClass="w-[92px]" />
              ))}
              {list.length > 8 && (
                <button type="button" onClick={() => setStudio({ kind: hook.kind })}
                  className="flex w-[92px] shrink-0 flex-col items-center gap-1.5">
                  <span className="flex aspect-[9/16] w-full items-center justify-center rounded-xl border border-dashed border-[#35445a] text-xs text-[#CBD5E1] hover:border-[#54D045]/60">
                    +{list.length - 8}
                  </span>
                  <span className="flex items-center text-[11px] text-[#94A3B8]">View {list.length - 8} more <ChevronRight className="h-3 w-3" /></span>
                </button>
              )}
            </div>
            <button type="button" aria-label="Scroll templates left" onClick={() => strip.current?.scrollBy({ left: -300, behavior: "smooth" })}
              className="absolute left-1 top-[64px] hidden h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white sm:flex"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Scroll templates right" onClick={() => strip.current?.scrollBy({ left: 300, behavior: "smooth" })}
              className="absolute right-1 top-[64px] hidden h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white sm:flex"><ChevronRight className="h-4 w-4" /></button>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setStudio({ kind: hook.kind, focus: hook.template_id })}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#253244] px-3 text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.04]">
          <Sparkles className="h-3.5 w-3.5 text-[#54D045]" /> Open Hook Studio
        </button>
        {hook.enabled && current && (
          <p className="text-xs text-[#94A3B8]">
            {current.name} · {hook.placement === "opening" ? `${hook.duration}s opening` : `${hook.duration}s overlay`} · {hook.textMode === "ai" ? "AI text per clip" : "custom text"} ·{" "}
            <span className="text-[#F8FAFC]"><Zap className="inline h-3 w-3 fill-[#54D045] text-[#54D045]" /> +{current.credits * clipCount} credits</span>
          </p>
        )}
      </div>

      {studio && data && (
        <HookStudioModal
          initial={{ ...hook, kind: studio.kind, template_id: studio.focus ?? (hook.kind === studio.kind ? hook.template_id : list[0]?.id ?? hook.template_id) }}
          templates={data.templates}
          access={access}
          clipCount={clipCount}
          ratio={ratio}
          media={media}
          brandPrimary={brandPrimary}
          onClose={() => setStudio(null)}
          onApply={(h) => {
            onChange({ ...h, enabled: true });
            setStudio(null);
          }}
          onUpsell={(why) => setUpsell(why)}
        />
      )}
      {upsell && <HookUpgradeModal reason={upsell} onClose={() => setUpsell(null)} />}
    </div>
  );
}

function TemplateCard({ t, still, ratio, selected, onClick, widthClass }: { t: HookTemplate; still: string; ratio: string; selected: boolean; onClick: () => void; widthClass?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} title={t.description}
      className={cn("group flex shrink-0 flex-col items-center gap-1.5", widthClass)}>
      <span className={cn("relative block w-full overflow-hidden rounded-xl border-2 transition-all duration-200",
        selected ? "border-[#54D045] shadow-[0_0_0_3px_rgba(84,208,69,0.25)]" : "border-transparent group-hover:border-white/30")}>
        <HookPreview look={resolveLook({ ...DEFAULT_HOOK, kind: t.kind, template_id: t.id })} text={SAMPLE_TEXT[t.kind]} ratio={ratio}
          placement="overlay" duration={t.defaultSeconds} media={{ image: still }} still />
        {selected && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#54D045] text-[#0A111B]"><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></span>}
        {!t.allowed && <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70"><Crown className="h-3 w-3 fill-amber-400 text-amber-400" /></span>}
      </span>
      <span className="w-full truncate text-center text-[11px] text-[#94A3B8]">{t.name}</span>
    </button>
  );
}

/* ─── Hook Studio modal ─────────────────────────────────────────────── */

function HookStudioModal({
  initial, templates, access, clipCount, ratio, media, brandPrimary, onClose, onApply, onUpsell,
}: {
  initial: HookSettings;
  templates: HookTemplate[];
  access: HookAccess;
  clipCount: number;
  ratio: string;
  media?: HookMedia;
  brandPrimary?: string | null;
  onClose: () => void;
  onApply: (h: HookSettings) => void;
  onUpsell: (why: "none" | "premium") => void;
}) {
  const [draft, setDraft] = useState<HookSettings>(initial);
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<"all" | "basic" | "premium">("all");
  const [playing, setPlaying] = useState(true);
  const [replay, setReplay] = useState(0);
  const set = (p: Partial<HookSettings>) => setDraft((d) => ({ ...d, ...p }));
  const tpl = templates.find((t) => t.id === draft.template_id);
  const list = templates.filter((t) => t.kind === draft.kind && (tier === "all" || t.tier === tier) && `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase()));
  const look = resolveLook(draft, brandPrimary);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function switchKind(kind: HookKind) {
    if (kind === draft.kind) return;
    const first = templates.find((t) => t.kind === kind && t.allowed) ?? templates.find((t) => t.kind === kind)!;
    set({ kind, template_id: first.id, duration: first.defaultSeconds });
    setReplay((r) => r + 1);
  }

  function apply() {
    if (!tpl) return;
    if (!tpl.allowed) return onUpsell(access === "none" ? "none" : "premium");
    onApply(draft);
  }

  const credits = tpl ? tpl.credits * clipCount : 0;
  const lbl = "mb-1.5 block text-[11px] font-medium text-[#94A3B8]";

  return createPortal(
    <div className={cn("fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4", FONT_VARS)} onClick={onClose} role="presentation">
      <HookKeyframes />
      <div role="dialog" aria-modal="true" aria-label="Hook Studio" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#1C1E24] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] sm:rounded-3xl">
        {/* Tabs */}
        <div className="relative flex border-b border-white/10 px-6">
          {(["viral", "headline"] as const).map((k) => (
            <button key={k} type="button" onClick={() => switchKind(k)} aria-pressed={draft.kind === k}
              className={cn("flex flex-1 items-center justify-center gap-1 border-b-2 py-4 text-sm font-medium transition-colors",
                draft.kind === k ? "border-white text-white" : "border-transparent text-[#94A3B8] hover:text-white")}>
              {k === "viral" ? <>Viral hook {access !== "all" && <Crown className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}</> : <>Headline {access === "none" && <Crown className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}</>}
            </button>
          ))}
          <button type="button" onClick={onClose} aria-label="Close Hook Studio" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.06] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_340px] md:overflow-hidden">
          {/* Gallery */}
          <div className="flex min-h-0 flex-col">
            <p className="text-sm text-[#CBD5E1]">
              {draft.kind === "viral" ? "Animated scroll-stopping hook with motion and sound." : "Text title that introduces your video."}{" "}
              <span className="whitespace-nowrap text-[#F8FAFC]"><Zap className="inline h-3.5 w-3.5 fill-[#54D045] text-[#54D045]" /> {tpl?.credits ?? (draft.kind === "viral" ? 2 : 1)} credit{(tpl?.credits ?? 1) === 1 ? "" : "s"}/clip</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="relative min-w-[160px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates" aria-label="Search templates"
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-white placeholder:text-[#64748B] focus:border-[#54D045]/60 focus:outline-none" />
              </label>
              {draft.kind === "viral" && (
                <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5" role="radiogroup" aria-label="Filter templates">
                  {(["all", "basic", "premium"] as const).map((f) => (
                    <button key={f} type="button" role="radio" aria-checked={tier === f} onClick={() => setTier(f)}
                      className={cn("h-8 rounded-md px-3 text-xs font-medium capitalize", tier === f ? "bg-white/10 text-white" : "text-[#94A3B8] hover:text-white")}>
                      {f === "premium" ? <span className="inline-flex items-center gap-1">Premium <Crown className="h-3 w-3 fill-amber-400 text-amber-400" /></span> : f}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="hk-scroll mt-4 grid min-h-0 grid-cols-3 gap-3 overflow-y-auto pr-3 md:max-h-[58vh] lg:grid-cols-4">
              {list.map((t, i) => (
                <TemplateCard key={t.id} t={t} still={media?.image ?? SAMPLE_STILLS[i % SAMPLE_STILLS.length]} ratio="9:16"
                  selected={draft.template_id === t.id}
                  onClick={() => {
                    set({ template_id: t.id, duration: t.id === draft.template_id ? draft.duration : t.defaultSeconds });
                    setReplay((r) => r + 1);
                    setPlaying(true);
                  }} />
              ))}
              {list.length === 0 && <p className="col-span-full py-10 text-center text-sm text-[#64748B]">No templates match “{query}”.</p>}
            </div>
          </div>

          {/* Preview + settings */}
          <div className="hk-scroll flex min-h-0 flex-col gap-4 md:overflow-y-auto md:pr-3">
            <div className="mx-auto w-full max-w-[300px]">
              <div className="overflow-hidden rounded-2xl bg-black">
                <HookPreview key={`${draft.template_id}-${replay}`} look={look} text={draft.textMode === "custom" && draft.text.trim() ? draft.text : SAMPLE_TEXT[draft.kind]}
                  ratio={ratio} placement={draft.placement} duration={draft.duration} media={{ video: media?.video ?? (media?.image ? null : SAMPLE_VIDEO), image: media?.image }} playing={playing} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="truncate text-sm font-semibold text-white">{tpl?.name}{tpl && !tpl.allowed && <Crown className="ml-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}</p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause preview" : "Play preview"}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#CBD5E1] hover:bg-white/10 hover:text-white">
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => { setReplay((r) => r + 1); setPlaying(true); }} aria-label="Replay preview"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#CBD5E1] hover:bg-white/10 hover:text-white">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#94A3B8]">{tpl?.description}</p>
              {!media?.video && !media?.image && <p className="mt-1 text-[11px] text-[#64748B]">Sample clip shown. Add a video to preview on yours.</p>}
            </div>

            {/* Text */}
            <div>
              <span className={lbl}>{draft.kind === "viral" ? "Hook text" : "Headline"}</span>
              <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5" role="radiogroup" aria-label="Text source">
                {(["ai", "custom"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={draft.textMode === m} onClick={() => set({ textMode: m })}
                    className={cn("inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium", draft.textMode === m ? "bg-white/10 text-white" : "text-[#94A3B8] hover:text-white")}>
                    {m === "ai" ? <><Sparkles className="h-3 w-3" /> AI per clip</> : "Custom"}
                  </button>
                ))}
              </div>
              {draft.textMode === "custom" ? (
                <input value={draft.text} onChange={(e) => set({ text: e.target.value.slice(0, 80) })} maxLength={80}
                  placeholder={draft.kind === "viral" ? "e.g. Nobody talks about this" : "e.g. 3 lessons from 10 years of coding"}
                  className="mt-2 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-[#64748B] focus:border-[#54D045]/60 focus:outline-none" />
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-[#94A3B8]">AI writes a short line for each clip from what is said in it. No made-up claims.</p>
              )}
            </div>

            {/* Placement & timing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={lbl}>Placement</span>
                <div className="inline-flex w-full rounded-lg border border-white/10 bg-black/20 p-0.5">
                  {(["opening", "overlay"] as const).map((p) => (
                    <button key={p} type="button" aria-pressed={draft.placement === p} onClick={() => { set({ placement: p }); setReplay((r) => r + 1); }}
                      className={cn("h-8 flex-1 rounded-md text-xs font-medium capitalize", draft.placement === p ? "bg-white/10 text-white" : "text-[#94A3B8] hover:text-white")}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className={lbl}>Duration · {draft.duration}s</span>
                <input type="range" min={1} max={5} step={0.5} value={draft.duration} onChange={(e) => set({ duration: Number(e.target.value) })}
                  onMouseUp={() => setReplay((r) => r + 1)} className="w-full accent-[#54D045]" aria-label="Hook duration in seconds" />
              </label>
            </div>
            <p className="-mt-2 text-[11px] text-[#64748B]">
              {draft.placement === "opening" ? "Added before the clip; captions and subtitles shift to match." : "Drawn over the start of the clip; length unchanged."}
            </p>
            {tpl?.sfx !== "none" && (
              <label className="flex items-center justify-between text-xs text-[#CBD5E1]">
                Sound effect ({tpl?.sfx})
                <input type="checkbox" checked={draft.sfx} onChange={(e) => set({ sfx: e.target.checked })} className="h-4 w-4 accent-[#54D045]" />
              </label>
            )}

            {draft.kind === "headline" && <HeadlineControls draft={draft} set={(p) => { set(p); }} brandPrimary={brandPrimary} />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
          <p className="text-xs text-[#94A3B8]">
            <Zap className="inline h-3.5 w-3.5 fill-[#54D045] text-[#54D045]" /> {tpl?.credits ?? 0} × {clipCount} clips ={" "}
            <span className="font-semibold text-white">{credits} credits</span> · charged when you generate, refunded if a hook fails. Previews are free.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-medium text-white hover:bg-white/[0.06]">Close</button>
            <button type="button" onClick={apply}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-[#0A111B] hover:brightness-110" style={{ background: GREEN }}>
              {tpl && !tpl.allowed ? <><Crown className="h-4 w-4" /> Upgrade to apply</> : <><Check className="h-4 w-4" /> Apply {draft.kind === "viral" ? "hook" : "headline"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HeadlineControls({ draft, set, brandPrimary }: { draft: HookSettings; set: (p: Partial<HookSettings>) => void; brandPrimary?: string | null }) {
  const lbl = "mb-1.5 block text-[11px] font-medium text-[#94A3B8]";
  const sel = "h-9 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-sm text-white focus:border-[#54D045]/60 focus:outline-none";
  const look = resolveLook(draft, brandPrimary);
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
      <p className="text-xs font-semibold text-white">Customise headline</p>
      <div className="grid grid-cols-2 gap-3">
        <label><span className={lbl}>Font</span>
          <select value={draft.font ?? ""} onChange={(e) => set({ font: e.target.value || undefined })} className={sel}>
            <option value="">Template</option>
            {HOOK_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label><span className={lbl}>Size · {draft.size ?? look.size}</span>
          <input type="range" min={40} max={160} step={2} value={draft.size ?? look.size} onChange={(e) => set({ size: Number(e.target.value) })} className="w-full accent-[#54D045]" />
        </label>
        <label><span className={lbl}>Animation</span>
          <select value={draft.animation ?? ""} onChange={(e) => set({ animation: (e.target.value || undefined) as HookSettings["animation"] })} className={sel}>
            <option value="">Template</option>
            {HOOK_ANIMATIONS.map((a) => <option key={a} value={a} className="capitalize">{a}</option>)}
          </select>
        </label>
        <label><span className={lbl}>Position</span>
          <select value={draft.position ?? ""} onChange={(e) => set({ position: (e.target.value || undefined) as HookSettings["position"] })} className={sel}>
            <option value="">Template</option>
            <option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option>
          </select>
        </label>
        <label><span className={lbl}>Background</span>
          <select value={draft.background ?? ""} onChange={(e) => set({ background: (e.target.value || undefined) as HookSettings["background"] })} className={sel}>
            <option value="">Template</option>
            {HOOK_BACKGROUNDS.map((b) => <option key={b} value={b} className="capitalize">{b}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex-1"><span className={lbl}>Text</span>
            <input type="color" value={draft.color ?? look.color} onChange={(e) => set({ color: e.target.value.toUpperCase() })} className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent" aria-label="Text colour" />
          </label>
          <label className="flex-1"><span className={lbl}>Label</span>
            <input type="color" value={draft.bg_color ?? (look.box?.startsWith("#") ? look.box : "#000000")} onChange={(e) => set({ bg_color: e.target.value.toUpperCase() })} className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent" aria-label="Label colour" />
          </label>
        </div>
      </div>
      <label className={cn("flex items-center justify-between text-xs", brandPrimary ? "text-[#CBD5E1]" : "text-[#64748B]")}>
        Use brand kit colour{!brandPrimary && " (pick a brand kit first)"}
        <input type="checkbox" disabled={!brandPrimary} checked={draft.use_brand && !!brandPrimary} onChange={(e) => set({ use_brand: e.target.checked })} className="h-4 w-4 accent-[#54D045]" />
      </label>
      <button type="button" onClick={() => set({ font: undefined, size: undefined, color: undefined, bg_color: undefined, position: undefined, animation: undefined, background: undefined, use_brand: false })}
        className="text-[11px] font-medium text-[#94A3B8] hover:text-white">Reset to template</button>
    </div>
  );
}

/* ─── Upsell ─────────────────────────────────────────────────────────── */

function HookUpgradeModal({ reason, onClose }: { reason: "none" | "premium"; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Upgrade for AI hooks">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        {reason === "none" ? (
          <PlanUpgradeCard icon={Crown} title="Stop the scroll in the first second."
            description="Open every clip with an animated hook or a clean headline, written by AI from what is said in the clip."
            benefits={["Animated viral hooks with sound", "Headlines with your fonts and colours", "AI text per clip, or your own", "Opening card or overlay, 1–5 seconds", "Works in every aspect ratio"]}
            onClose={onClose} />
        ) : (
          <PlanUpgradeCard icon={Crown} title="Unlock every hook style."
            description="Pro and Business include all premium hook templates: Neon, Glass, Comic, Depth, Match Cut and more."
            benefits={["All 19 viral hook templates", "Premium motion and sound effects", "Every headline style and setting", "Use your brand kit colours", "Priority rendering"]}
            onClose={onClose} />
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ─── Live preview ──────────────────────────────────────────────────── */

const ratioOf = (r: string) => {
  const [w, h] = r.split(":").map(Number);
  return w && h ? { w, h } : { w: 9, h: 16 };
};

/**
 * Browser preview of a hook over the user's media. Mirrors the renderer's
 * sizing (1080-wide canvas), positions and animations. Loops while playing.
 */
export function HookPreview({
  look, text, ratio, placement, duration, media, playing = true, still = false,
}: {
  look: HookLook;
  text: string;
  ratio: string;
  placement: "opening" | "overlay";
  duration: number;
  media?: HookMedia;
  playing?: boolean;
  /** Static end frame (gallery cards). */
  still?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [w, setW] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<"hook" | "after">("hook");
  const { w: rw, h: rh } = ratioOf(ratio);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Hook phase, then ~1.6 s of plain video, then loop.
  useEffect(() => {
    if (still || !playing) return;
    setPhase("hook");
    const a = setTimeout(() => setPhase("after"), duration * 1000);
    const b = setTimeout(() => setCycle((c) => c + 1), duration * 1000 + 1600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [cycle, playing, duration, still]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing && !still) v.play().catch(() => undefined);
    else v.pause();
  }, [playing, still, media?.video]);

  const scale = w / 1080;
  const playY = (1080 * rh) / rw;
  const fs = look.size * Math.min(1, Math.max(0.6, playY / 1600)) * scale;
  const showHook = still || phase === "hook";
  // Cards show solid backgrounds (white, colour, split) so the thumbnail matches the result.
  const card = still ? (["white", "color", "split"].includes(look.card) ? look.card : "frame") : placement === "opening" && showHook ? look.card : "frame";
  // Same anchors as the renderer: top hangs from 8%, middle is the lower
  // third, bottom grows up from 86% — text stays off the speaker's face.
  const top = look.pos === "top" ? 8 : look.pos === "bottom" ? 86 : 66;
  const shift = look.pos === "top" ? "0%" : look.pos === "bottom" ? "-100%" : "-50%";
  const paused = !playing && !still;

  const mediaEl = media?.video ? (
    <video ref={video} src={media.video} poster={media.image ?? undefined} muted loop playsInline autoPlay={!still} preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
  ) : media?.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.image} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
  ) : null;

  return (
    <div ref={box} className="relative w-full overflow-hidden bg-[#111]" style={{ aspectRatio: `${rw} / ${rh}` }}>
      {/* Background */}
      <div className={cn("absolute inset-0", card === "blur" && "scale-110 blur-md brightness-75", card === "montage" && "brightness-90", card === "flashes" && "hk-flash")}>{mediaEl}</div>
      {(card === "white" || card === "color") && <div className="absolute inset-0" style={{ background: card === "white" ? "#FFFFFF" : look.cardColor }} />}
      {card === "split" && <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: look.cardColor }} />}

      {showHook && w > 0 && (
        <div key={cycle} className="pointer-events-none absolute left-1/2 w-[92%] text-center" style={{ top: `${top}%`, transform: `translate(-50%, ${shift}) rotate(${look.tilt ?? 0}deg)`, transformOrigin: "center" }}>
          <HookText look={look} text={text} fs={fs} scale={scale} still={still} paused={paused} />
        </div>
      )}
    </div>
  );
}

function HookText({ look, text, fs, scale, still, paused }: { look: HookLook; text: string; fs: number; scale: number; still: boolean; paused: boolean }) {
  const raw = (look.upper ? text.toUpperCase() : text).replace(/\s+/g, " ").trim() || "Watch this";
  const maxChars = look.maxChars ?? 14;
  let kicker: string | null = null;
  let body = raw;
  if (look.extra === "kicker") {
    const words = raw.split(" ");
    if (words.length > 3) {
      kicker = words.slice(0, 2).join(" ");
      body = words.slice(2).join(" ");
    }
  }
  const lines = wrapHookLines(body, maxChars);
  const words = body.split(" ");
  const key = words.reduce((a, b) => (b.replace(/\W/g, "").length > a.replace(/\W/g, "").length ? b : a), "");
  const outline = look.outline ? Math.max(1, look.outline * scale) : 0;
  const shadows: string[] = [];
  if (outline) for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) shadows.push(`${x * outline}px ${y * outline}px 0 #000`);
  if (look.extra === "glow") shadows.push(`0 0 ${14 * scale * 3}px ${look.accent}`, `0 0 ${6 * scale * 3}px ${look.accent}`);
  if (look.extra === "extrude") for (let i = 1; i <= 7; i++) shadows.push(`${i * 4 * scale}px ${i * 4 * scale}px 0 ${look.accent}`);
  if (!look.box && !outline && look.extra !== "glow" && look.extra !== "extrude") shadows.push(`0 ${3 * scale}px ${6 * scale}px rgba(0,0,0,0.6)`);
  const anim = still ? "" : `hk-${look.anim}`;
  const style: React.CSSProperties = {
    fontFamily: FAMILY[look.font],
    fontWeight: look.weight,
    fontStyle: look.italic ? "italic" : "normal",
    fontSize: fs,
    lineHeight: 1.15,
    color: look.color,
    textShadow: shadows.join(", ") || undefined,
    display: "inline-block",
    transform: look.scaleX ? `scaleX(${look.scaleX / 100})` : undefined,
    animationPlayState: paused ? "paused" : undefined,
  };
  const step = Math.min(0.38, 1.5 / Math.max(1, words.length));
  let wi = 0;
  const renderWord = (w: string, li: number, idx: number) => {
    const i = wi++;
    const isNum = look.extra === "number" && li === 0 && idx === 0 && /^#?\d+/.test(w);
    const isKey = look.extra === "accent" && w === key;
    const ws: React.CSSProperties = {
      ...(isNum ? { color: look.accent, fontSize: "1.3em" } : {}),
      ...(isKey ? { color: look.accent, fontFamily: FAMILY[look.accentFont ?? look.font], fontSize: "1.15em" } : {}),
      ...(look.anim === "words" && !still ? { animationDelay: `${i * step}s`, animationPlayState: paused ? "paused" : undefined } : {}),
    };
    return (
      <span key={`${li}-${idx}`} className={cn(look.anim === "words" && !still && "hk-word")} style={ws}>
        {w}{" "}
      </span>
    );
  };
  return (
    <div className="relative inline-block">
      {look.extra === "burst" && (
        <svg viewBox="-100 -100 200 200" className={cn("absolute left-1/2 top-1/2 -z-0", !still && "hk-pop")} style={{ width: fs * 4.6, height: fs * 4.6, transform: "translate(-50%,-50%) rotate(8deg)" }} aria-hidden>
          <polygon fill={look.accent} stroke="#000" strokeWidth="3" points={Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; const r = i % 2 ? 62 : 100; return `${Math.cos(a) * r},${Math.sin(a) * r}`; }).join(" ")} />
        </svg>
      )}
      {kicker && <div className={cn(!still && "hk-fade")} style={{ fontFamily: FAMILY.sans, fontWeight: 600, fontSize: fs * 0.42, color: look.color, marginBottom: fs * 0.1 }}>{kicker}</div>}
      <div className={cn("relative", anim, look.sweep && !still && "hk-sweep")} style={style}>
        {lines.map((l, li) => (
          <div key={li}>
            {look.box ? (
              <span style={{ background: look.box, padding: `${fs * 0.08}px ${fs * 0.22}px`, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", backdropFilter: look.box.startsWith("rgba") ? "blur(10px)" : undefined, borderRadius: look.box.startsWith("rgba") ? fs * 0.18 : 2 }}>
                {l.split(" ").map((w, i) => renderWord(w, li, i))}
              </span>
            ) : (
              l.split(" ").map((w, i) => renderWord(w, li, i))
            )}
          </div>
        ))}
      </div>
      {look.extra === "scribble" && (
        <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="mx-auto block" style={{ width: "100%", height: fs * 0.35 }} aria-hidden>
          <path d="M0 20 C 33 0, 66 40, 100 20 S 166 0, 200 20 S 266 40, 300 20 S 366 0, 400 20" fill="none" stroke={look.accent} strokeWidth="7" strokeLinecap="round" pathLength={1}
            className={cn(!still && "hk-draw")} style={{ strokeDasharray: 1, strokeDashoffset: still ? 0 : undefined }} />
        </svg>
      )}
    </div>
  );
}

/** Keyframes for the preview (mirror the renderer's ASS animations). */
function HookKeyframes() {
  return (
    <style>{`
      @keyframes hk-pop { 0% { transform: scale(.3); opacity: 0 } 65% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
      @keyframes hk-slide { 0% { transform: translateY(60%); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
      @keyframes hk-zoomblur { 0% { transform: scale(1.7); filter: blur(10px); opacity: 0 } 100% { transform: scale(1); filter: blur(0); opacity: 1 } }
      @keyframes hk-flicker { 0% { opacity: 0 } 8% { opacity: 1 } 16% { opacity: .3 } 22% { opacity: 1 } 60% { opacity: .5 } 66% { opacity: 1 } 100% { opacity: 1 } }
      @keyframes hk-drop { 0% { transform: translateY(-160%) rotate(-14deg); opacity: 0 } 100% { transform: translateY(0) rotate(0); opacity: 1 } }
      @keyframes hk-snap { 0% { transform: scaleY(0) } 70% { transform: scaleY(1.12) } 100% { transform: scaleY(1) } }
      @keyframes hk-fade { 0% { opacity: 0 } 100% { opacity: 1 } }
      @keyframes hk-sweep { 0% { clip-path: inset(0 100% 0 0) } 100% { clip-path: inset(0 0 0 0) } }
      @keyframes hk-word { 0% { opacity: 0; transform: translateY(20%) } 100% { opacity: 1; transform: none } }
      @keyframes hk-draw { 0% { stroke-dashoffset: 1 } 100% { stroke-dashoffset: 0 } }
      @keyframes hk-flash { 0%, 100% { filter: brightness(1) } 25% { filter: brightness(1.6) contrast(1.2) } 50% { filter: brightness(.7) } 75% { filter: brightness(1.4) hue-rotate(20deg) } }
      .hk-pop { animation: hk-pop .26s ease-out both } .hk-slide { animation: hk-slide .28s ease-out both }
      .hk-zoomblur { animation: hk-zoomblur .32s ease-out both } .hk-flicker { animation: hk-flicker .5s linear both }
      .hk-drop { animation: hk-drop .32s cubic-bezier(.2,.9,.3,1.2) both } .hk-snap { animation: hk-snap .22s ease-out both }
      .hk-fade, .hk-words, .hk-none { animation: hk-fade .22s ease-out both } .hk-sweep { animation: hk-sweep .3s ease-out both }
      .hk-word { display: inline-block; animation: hk-word .2s ease-out both } .hk-draw { stroke-dashoffset: 1; animation: hk-draw .35s .15s ease-out forwards }
      .hk-flash { animation: hk-flash .5s steps(4) infinite }
      .hk-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.28) transparent }
      .hk-scroll::-webkit-scrollbar { width: 6px; height: 6px }
      .hk-scroll::-webkit-scrollbar-track { background: transparent; margin: 6px 0 }
      .hk-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.28); border-radius: 999px }
      .hk-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.45) }
      @media (prefers-reduced-motion: reduce) { [class^="hk-"], [class*=" hk-"] { animation: none !important } }
    `}</style>
  );
}

export function hookSummary(h: HookSettings, templates?: HookTemplate[]) {
  if (!h.enabled) return "Off";
  const t = templates?.find((x) => x.id === h.template_id);
  return `${t?.name ?? h.template_id} · ${h.duration}s ${h.placement}`;
}

