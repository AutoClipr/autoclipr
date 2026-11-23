"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Film, ImagePlus, Loader2, Pause, Play, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  ASSET_RULES,
  BRAND_FONTS,
  CAPTION_PRESETS,
  DEFAULT_COLORS,
  LOGO_POSITIONS,
  brandKitsApi,
  fontCss,
  fontWeightCss,
  type AssetKind,
  type BrandCaptions,
  type BrandColors,
  type BrandKit,
  type BrandKitInput,
  type BrandLogo,
  type BrandTypography,
} from "@/lib/brand-kits";
import { cn } from "@/lib/utils";
import { BrandPreview, PREVIEW_SCENES, Swatches, type PreviewScene } from "./brand-preview";

const STEPS = ["Basics", "Colours", "Typography", "Captions", "Intro & outro", "Review"] as const;

/** Curated starting palettes; applied only when the user clicks one. */
const PALETTES: { name: string; colors: BrandColors }[] = [
  { name: "AutoClipr", colors: DEFAULT_COLORS },
  { name: "Midnight Purple", colors: { primary: "#8B5CF6", secondary: "#1B1035", accent: "#C084FC", background: "#0B0620", text: "#FFFFFF" } },
  { name: "Sunset", colors: { primary: "#FF9418", secondary: "#2A1405", accent: "#FFD400", background: "#120802", text: "#FFFFFF" } },
  { name: "Ocean", colors: { primary: "#35D6E8", secondary: "#082436", accent: "#0EA5E9", background: "#03121C", text: "#FFFFFF" } },
  { name: "Crimson", colors: { primary: "#FF3B6B", secondary: "#2A0A12", accent: "#FF8FA3", background: "#120307", text: "#FFFFFF" } },
  { name: "Mono", colors: { primary: "#FFFFFF", secondary: "#1F1F1F", accent: "#A3A3A3", background: "#000000", text: "#FFFFFF" } },
];

type Draft = {
  name: string;
  description: string;
  colors: BrandColors;
  typography: BrandTypography;
  captions: BrandCaptions;
  logo: BrandLogo;
  intro_enabled: boolean;
  outro_enabled: boolean;
  assets: Record<AssetKind, { path: string | null; url: string | null }>;
};

function draftFrom(kit?: BrandKit | null): Draft {
  return {
    name: kit?.name ?? "",
    description: kit?.description ?? "",
    colors: { ...DEFAULT_COLORS, ...(kit?.colors ?? {}) },
    typography: { caption_font: "Montserrat ExtraBold", heading_font: "Montserrat Black", text_size: "medium", alignment: "center", ...(kit?.typography ?? {}) },
    captions: { preset: "bold_highlight", position: "bottom", alignment: "center", size: 72, ...(kit?.captions ?? {}) },
    logo: { position: "top-right", size: 14, opacity: 0.9, ...(kit?.logo ?? {}) },
    intro_enabled: kit?.intro_enabled ?? false,
    outro_enabled: kit?.outro_enabled ?? false,
    assets: {
      logo: { path: kit?.logo_path ?? null, url: kit?.logo_url ?? null },
      intro: { path: kit?.intro_path ?? null, url: kit?.intro_url ?? null },
      outro: { path: kit?.outro_path ?? null, url: kit?.outro_url ?? null },
    },
  };
}

/** Comparable form of a draft (ignores preview blob URLs). */
const fingerprint = (d: Draft) =>
  JSON.stringify({ ...d, assets: { logo: d.assets.logo.path, intro: d.assets.intro.path, outro: d.assets.outro.path } });

const INPUT =
  "h-11 w-full rounded-xl border border-[#263244] bg-[#0A111B] px-3.5 text-sm text-white outline-none transition-colors placeholder:text-[#64748B] focus:border-[#54D045]/60 focus:ring-2 focus:ring-[#54D045]/15";
const LABEL = "mb-2 block text-xs font-semibold uppercase tracking-wide text-[#9299A8]";
const SECTION = "rounded-2xl border border-[#263244] bg-[#151F2E]/60 p-4 sm:p-5";

export function BrandKitEditor({ kit, onDone, onCancel }: { kit?: BrandKit | null; onDone: (k: BrandKit) => void; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const initial = useMemo(() => draftFrom(kit), [kit]);
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Partial<Record<AssetKind, number>>>({});
  const [uploadError, setUploadError] = useState<Partial<Record<AssetKind, string>>>({});
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  // Preview controls
  const [playing, setPlaying] = useState(false);
  const [word, setWord] = useState(1);
  const [scene, setScene] = useState<PreviewScene>("studio");
  const [size, setSize] = useState<"s" | "m" | "l">("m");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const dirty = fingerprint(d) !== fingerprint(initial);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Caption "playback": walk the highlight across the sample words.
  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setWord((w) => w + 1), 450);
    return () => clearInterval(t);
  }, [playing]);

  function go(i: number) {
    setStep(i);
    setVisited((v) => new Set(v).add(i));
  }

  function cancel() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    onCancel();
  }

  async function upload(kind: AssetKind, file: File | undefined) {
    if (!file) return;
    setUploadError((e) => ({ ...e, [kind]: undefined }));
    setUploading((u) => ({ ...u, [kind]: 0 }));
    try {
      const path = await brandKitsApi.uploadAsset(kind, file, (pct) => setUploading((u) => ({ ...u, [kind]: pct })));
      setD((p) => ({
        ...p,
        assets: { ...p.assets, [kind]: { path, url: URL.createObjectURL(file) } },
        ...(kind === "intro" ? { intro_enabled: true } : kind === "outro" ? { outro_enabled: true } : {}),
      }));
      toast.success(`${kind === "logo" ? "Logo" : kind === "intro" ? "Intro" : "Outro"} uploaded.`);
    } catch (e) {
      const msg = (e as Error).message;
      setUploadError((er) => ({ ...er, [kind]: msg }));
      toast.error(msg);
    } finally {
      setUploading((u) => {
        const n = { ...u };
        delete n[kind];
        return n;
      });
    }
  }

  async function save() {
    if (!d.name.trim()) {
      go(0);
      return toast.error("Give your brand kit a name.");
    }
    setSaving(true);
    const input: BrandKitInput = {
      name: d.name.trim(),
      description: d.description.trim() || undefined,
      colors: d.colors,
      typography: d.typography,
      captions: d.captions,
      logo: d.logo,
      logo_path: d.assets.logo.path,
      intro_path: d.assets.intro.path,
      outro_path: d.assets.outro.path,
      intro_enabled: d.intro_enabled,
      outro_enabled: d.outro_enabled,
    };
    try {
      const saved = kit ? await brandKitsApi.update(kit.id, input) : await brandKitsApi.create(input);
      toast.success(kit ? "Brand kit updated." : "Brand kit created.");
      onDone(saved);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const busy = Object.keys(uploading).length > 0;

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Stepper */}
      <ol className="mb-6 flex items-center overflow-x-auto pb-1" aria-label="Brand kit steps">
        {STEPS.map((s, i) => {
          const done = visited.has(i) && i < step;
          const current = i === step;
          return (
            <li key={s} className="flex items-center">
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={current ? "step" : undefined}
                className="group flex items-center gap-2 rounded-full px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                    current ? "border-[#54D045] bg-[#54D045] text-[#050817]" : done ? "border-[#54D045]/60 bg-[#54D045]/15 text-[#a6ec9c]" : "border-[#263244] bg-[#101827] text-[#9299A8] group-hover:border-[#3a475c]",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cn("whitespace-nowrap text-sm font-medium", current ? "text-white" : "text-[#9299A8] group-hover:text-white")}>{s}</span>
              </button>
              {i < STEPS.length - 1 && <span className={cn("mx-2 h-px w-6 shrink-0 sm:w-10", i < step ? "bg-[#54D045]/60" : "bg-[#263244]")} aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Configuration */}
        <section className="order-2 rounded-3xl border border-[#263244] bg-[#101827] p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] sm:p-7 lg:order-1">
          <div key={step} className="animate-in fade-in duration-200 motion-reduce:animate-none">
            {step === 0 && (
              <div className="space-y-6">
                <StepTitle title="Brand basics" hint="Name your kit and add the logo that appears on every clip." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={LABEL} htmlFor="bk-name">Brand kit name</label>
                    <input id="bk-name" maxLength={60} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="My YouTube Brand" className={INPUT} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={LABEL} htmlFor="bk-desc">Description <span className="normal-case tracking-normal text-[#64748B]">(optional)</span></label>
                    <textarea id="bk-desc" maxLength={280} rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="What this brand is about" className={cn(INPUT, "h-auto py-2.5")} />
                  </div>
                </div>
                <DropZone kind="logo" label="Logo" icon={ImagePlus} asset={d.assets.logo} progress={uploading.logo} error={uploadError.logo}
                  onPick={(f) => upload("logo", f)} onRemove={() => set("assets", { ...d.assets, logo: { path: null, url: null } })} image />
                {d.assets.logo.path && (
                  <div className={cn(SECTION, "grid gap-5 sm:grid-cols-[auto_1fr]")}>
                    <div>
                      <span className={LABEL}>Position</span>
                      <CornerPicker value={d.logo.position ?? "top-right"} onChange={(v) => set("logo", { ...d.logo, position: v })} />
                    </div>
                    <div className="space-y-4">
                      <Slider label="Size" value={d.logo.size ?? 14} min={5} max={40} suffix="%" onChange={(v) => set("logo", { ...d.logo, size: v })} />
                      <Slider label="Opacity" value={Math.round((d.logo.opacity ?? 0.9) * 100)} min={10} max={100} suffix="%" onChange={(v) => set("logo", { ...d.logo, opacity: v / 100 })} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <StepTitle title="Brand colours" hint="Pick a starting palette or set each colour yourself." />
                <div>
                  <span className={LABEL}>Palette presets</span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PALETTES.map((p) => (
                      <button key={p.name} type="button" onClick={() => set("colors", p.colors)}
                        className="group rounded-xl border border-[#263244] bg-[#0A111B] p-3 text-left transition-colors hover:border-[#54D045]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60">
                        <span className="flex h-6 overflow-hidden rounded-md">
                          {(["primary", "accent", "secondary", "background", "text"] as const).map((k) => <span key={k} className="flex-1" style={{ background: p.colors[k] }} />)}
                        </span>
                        <span className="mt-2 block text-xs font-medium text-[#cbd5e1] group-hover:text-white">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["primary", "secondary", "accent", "background", "text"] as const).map((k) => (
                    <ColorField key={k} label={k[0].toUpperCase() + k.slice(1)} value={d.colors[k]} onChange={(v) => set("colors", { ...d.colors, [k]: v })} />
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <StepTitle title="Typography" hint="Fonts installed in our renderer, so exports match what you see." />
                <FontGrid label="Heading font" value={d.typography.heading_font} sample={d.name || "Your brand"} onChange={(v) => set("typography", { ...d.typography, heading_font: v })} />
                <FontGrid label="Caption font" value={d.typography.caption_font} sample="This is how" onChange={(v) => set("typography", { ...d.typography, caption_font: v, ...(d.captions.font ? {} : {}) })} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <span className={LABEL}>Weight</span>
                    <Segmented value={String(d.typography.font_weight ?? 800)} options={["600", "700", "800", "900"]} onChange={(v) => set("typography", { ...d.typography, font_weight: Number(v) })} />
                  </div>
                  <div>
                    <span className={LABEL}>Text size</span>
                    <Segmented value={d.typography.text_size ?? "medium"} options={["small", "medium", "large"]} onChange={(v) => set("typography", { ...d.typography, text_size: v as BrandTypography["text_size"] })} />
                  </div>
                  <div>
                    <span className={LABEL}>Alignment</span>
                    <Segmented value={d.captions.alignment ?? "center"} options={["left", "center", "right"]} onChange={(v) => set("captions", { ...d.captions, alignment: v as BrandCaptions["alignment"] })} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <StepTitle title="Caption style" hint="Choose a look, then fine-tune it." />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {CAPTION_PRESETS.map((p) => {
                    const on = d.captions.preset === p.id;
                    return (
                      <button key={p.id} type="button" onClick={() => set("captions", { ...d.captions, ...p.defaults, preset: p.id })}
                        aria-pressed={on}
                        className={cn("overflow-hidden rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60",
                          on ? "border-[#54D045] shadow-[0_0_0_1px_rgba(84,208,69,0.4)]" : "border-[#263244] hover:border-[#3a475c]")}>
                        <CaptionSwatch captions={{ ...p.defaults, preset: p.id }} colors={d.colors} font={d.captions.font ?? d.typography.caption_font} />
                        <span className={cn("block px-2.5 py-2 text-xs font-semibold", on ? "bg-[#54D045]/10 text-white" : "text-[#cbd5e1]")}>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className={cn(SECTION, "grid gap-4 sm:grid-cols-2")}>
                  <FontSelect label="Font" value={d.captions.font ?? d.typography.caption_font} onChange={(v) => set("captions", { ...d.captions, font: v })} />
                  <Slider label="Font size" value={d.captions.size ?? 72} min={40} max={140} onChange={(v) => set("captions", { ...d.captions, size: v })} />
                  <ColorField label="Text colour" value={d.captions.color ?? d.colors.text} onChange={(v) => set("captions", { ...d.captions, color: v })} />
                  <ColorField label="Highlight colour" value={d.captions.highlight_color ?? d.colors.primary} onChange={(v) => set("captions", { ...d.captions, highlight_color: v })} />
                  <Slider label="Outline" value={d.captions.outline ?? 4} min={0} max={12} onChange={(v) => set("captions", { ...d.captions, outline: v })} />
                  <Slider label="Shadow" value={d.captions.shadow ?? 1} min={0} max={8} onChange={(v) => set("captions", { ...d.captions, shadow: v })} />
                  <Slider label="Max words per line" value={d.captions.max_words ?? 3} min={1} max={8} onChange={(v) => set("captions", { ...d.captions, max_words: v })} />
                  <div>
                    <span className={LABEL}>Position</span>
                    <Segmented value={d.captions.position ?? "bottom"} options={["top", "middle", "bottom"]} onChange={(v) => set("captions", { ...d.captions, position: v as BrandCaptions["position"] })} />
                  </div>
                  <div>
                    <span className={LABEL}>Alignment</span>
                    <Segmented value={d.captions.alignment ?? "center"} options={["left", "center", "right"]} onChange={(v) => set("captions", { ...d.captions, alignment: v as BrandCaptions["alignment"] })} />
                  </div>
                  <div className="space-y-3">
                    <Toggle label="Background box" checked={!!d.captions.background} onChange={(v) => set("captions", { ...d.captions, background: v })} />
                    {d.captions.background && (
                      <ColorField label="Box colour" value={d.captions.background_color ?? "#000000"} onChange={(v) => set("captions", { ...d.captions, background_color: v })} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <StepTitle title="Intro & outro" hint="Optional bumpers added to every clip. They're resized to fit; clips keep their own audio." />
                <div className="grid gap-4 md:grid-cols-2">
                  {(["intro", "outro"] as const).map((k) => (
                    <div key={k} className={cn(SECTION, "space-y-4")}>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-white">{k === "intro" ? "Intro" : "Outro"}</p>
                        {d.assets[k].path && <Toggle label="Enabled" checked={d[`${k}_enabled`]} onChange={(v) => set(`${k}_enabled`, v)} />}
                      </div>
                      <DropZone kind={k} label={k === "intro" ? "Intro video" : "Outro video"} icon={Film} asset={d.assets[k]} progress={uploading[k]} error={uploadError[k]} compact
                        onPick={(f) => upload(k, f)} onRemove={() => setD((p) => ({ ...p, assets: { ...p.assets, [k]: { path: null, url: null } }, [`${k}_enabled`]: false }))} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <StepTitle title="Review" hint="Check everything, then save your brand kit." />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Review label="Brand" value={<span>{d.name || "—"}<span className="block text-xs font-normal text-[#9299A8]">{d.description || "No description"}</span></span>} />
                  <Review label="Logo" value={d.assets.logo.url ? (
                    <span className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.assets.logo.url} alt="" className="h-8 w-8 rounded-md object-contain" />
                      <span className="text-xs font-normal text-[#9299A8]">{LOGO_POSITIONS.find((p) => p.id === d.logo.position)?.label} · {d.logo.size}% · {Math.round((d.logo.opacity ?? 0.9) * 100)}%</span>
                    </span>
                  ) : "None"} />
                  <Review label="Colours" value={<Swatches colors={d.colors} size="h-5 w-5" />} />
                  <Review label="Typography" value={<span style={{ fontFamily: fontCss(d.typography.heading_font), fontWeight: fontWeightCss(d.typography.heading_font) }}>{d.typography.heading_font}<span className="block text-xs font-normal text-[#9299A8]" style={{ fontFamily: "inherit" }}>Captions: {d.typography.caption_font}</span></span>} />
                  <Review label="Caption style" value={CAPTION_PRESETS.find((p) => p.id === d.captions.preset)?.label ?? "Custom"} />
                  <Review label="Intro / Outro" value={`${d.assets.intro.path ? (d.intro_enabled ? "Intro on" : "Intro off") : "No intro"} · ${d.assets.outro.path ? (d.outro_enabled ? "Outro on" : "Outro off") : "No outro"}`} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#263244] pt-5">
            <button type="button" onClick={step === 0 ? cancel : () => go(step - 1)} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[#263244] px-4 text-sm font-medium text-white hover:bg-white/[0.04]">
              <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
            </button>
            <span className="hidden text-xs text-[#64748B] sm:inline">{dirty ? "Unsaved changes" : "All changes saved"}</span>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => go(step + 1)} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-white px-5 text-sm font-semibold text-[#050817] hover:bg-white/90">
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={save} disabled={saving || busy} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#54D045] px-5 text-sm font-semibold text-[#050817] hover:bg-[#62dc53] disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Brand Kit
              </button>
            )}
          </div>
        </section>

        {/* Persistent live preview */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-[#263244] bg-gradient-to-b from-[#151F2E] to-[#101827] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Live preview <span className="font-normal text-[#9299A8]">· 9:16</span></p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause preview" : "Play preview"}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#263244] text-white hover:bg-white/[0.06]">
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <Segmented value={size} options={["s", "m", "l"]} onChange={(v) => setSize(v as "s" | "m" | "l")} compact />
              </div>
            </div>
            <BrandPreview
              captions={d.captions}
              colors={d.colors}
              logo={d.logo}
              logoUrl={d.assets.logo.url}
              captionFont={d.typography.caption_font}
              headingFont={d.typography.heading_font}
              name={d.name}
              scene={scene}
              activeWord={word}
              className={cn("mx-auto transition-[max-width] duration-300", size === "s" ? "max-w-[200px]" : size === "m" ? "max-w-[280px]" : "max-w-[360px]")}
            />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              {(Object.keys(PREVIEW_SCENES) as PreviewScene[]).map((k) => (
                <button key={k} type="button" onClick={() => setScene(k)} aria-pressed={scene === k}
                  className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", scene === k ? "border-[#54D045]/60 bg-[#54D045]/10 text-white" : "border-[#263244] text-[#9299A8] hover:text-white")}>
                  {PREVIEW_SCENES[k].label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-[#9299A8]">
              <span>Intro {d.assets.intro.path && d.intro_enabled ? "on" : "off"}</span>·<span>Outro {d.assets.outro.path && d.outro_enabled ? "on" : "off"}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─── Pieces ───────────────────────────────────────────────────────────── */

function StepTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-sm text-[#9299A8]">{hint}</p>
    </div>
  );
}

/** Mini caption sample on a dark frame, for the preset gallery. */
function CaptionSwatch({ captions, colors, font }: { captions: BrandCaptions; colors: BrandColors; font?: string }) {
  const outline = captions.outline ? Math.max(0.5, captions.outline / 4) : 0;
  return (
    <div className="flex h-20 items-center justify-center px-2" style={{ background: `linear-gradient(160deg, ${colors.secondary}, ${colors.background})` }}>
      <span
        className="text-center text-[15px] leading-tight"
        style={{
          fontFamily: fontCss(font),
          fontWeight: fontWeightCss(font),
          color: captions.color ?? colors.text,
          WebkitTextStroke: outline ? `${outline}px #000` : undefined,
          paintOrder: "stroke fill",
          textShadow: captions.shadow ? `0 1px ${captions.shadow * 2}px rgba(0,0,0,0.8)` : undefined,
          background: captions.background ? `${captions.background_color ?? "#000000"}cc` : undefined,
          padding: captions.background ? "2px 6px" : undefined,
          borderRadius: captions.background ? 4 : undefined,
        }}
      >
        Make it <span style={{ color: captions.highlight_color ?? colors.primary }}>viral</span>
      </span>
    </div>
  );
}

function Review({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#263244] bg-[#151F2E]/60 p-4">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9299A8]">{label}</dt>
      <dd className="mt-1.5 text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

function CornerPicker({ value, onChange }: { value: string; onChange: (v: BrandLogo["position"]) => void }) {
  return (
    <div className="relative grid h-[136px] w-[78px] grid-cols-2 grid-rows-[1fr_1fr] gap-1 rounded-xl border border-[#263244] bg-[#0A111B] p-1.5" role="radiogroup" aria-label="Logo position">
      {LOGO_POSITIONS.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={value === p.id} aria-label={p.label} title={p.label} onClick={() => onChange(p.id)}
          className={cn("flex rounded-md border transition-colors", p.id.startsWith("top") ? "items-start" : "items-end", p.id.endsWith("left") ? "justify-start" : "justify-end",
            value === p.id ? "border-[#54D045]/60 bg-[#54D045]/10" : "border-transparent hover:bg-white/[0.04]")}>
          <span className={cn("m-1 h-3 w-3 rounded-sm", value === p.id ? "bg-[#54D045]" : "bg-[#3a475c]")} />
        </button>
      ))}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = /^#[0-9a-fA-F]{6}$/.test(text);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#263244] bg-[#0A111B] p-2.5">
      <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/15" style={{ background: value }}>
        <input type="color" aria-label={`${label} colour`} value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <div className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#9299A8]">{label}</span>
        <input value={text} maxLength={7} aria-label={`${label} hex`}
          onChange={(e) => { setText(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toUpperCase()); }}
          className={cn("w-full bg-transparent font-mono text-sm uppercase text-white outline-none", !valid && "text-red-300")} />
      </div>
    </div>
  );
}

function FontGrid({ label, value, sample, onChange }: { label: string; value?: string; sample: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BRAND_FONTS.map((f) => (
          <button key={f} type="button" onClick={() => onChange(f)} aria-pressed={value === f}
            className={cn("rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60",
              value === f ? "border-[#54D045] bg-[#54D045]/10" : "border-[#263244] bg-[#0A111B] hover:border-[#3a475c]")}>
            <span className="block truncate text-lg text-white" style={{ fontFamily: fontCss(f), fontWeight: fontWeightCss(f) }}>{sample}</span>
            <span className="mt-1 block truncate text-[11px] text-[#9299A8]">{f}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FontSelect({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} style={{ fontFamily: fontCss(value) }}>
        {BRAND_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
    </div>
  );
}

function Slider({ label, value, min, max, suffix = "", onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div>
      <span className={cn(LABEL, "flex justify-between")}>{label}<span className="tabular-nums normal-case text-white">{value}{suffix}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="w-full accent-[#54D045]" />
    </div>
  );
}

function Segmented({ value, options, onChange, compact }: { value: string; options: string[]; onChange: (v: string) => void; compact?: boolean }) {
  return (
    <div className="inline-flex rounded-xl border border-[#263244] bg-[#0A111B] p-0.5" role="radiogroup">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={cn("rounded-lg font-medium capitalize transition-colors", compact ? "h-7 px-2.5 text-[11px] uppercase" : "h-9 px-3 text-xs",
            value === o ? "bg-[#263244] text-white" : "text-[#9299A8] hover:text-white")}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[#cbd5e1]">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-[#54D045]" : "bg-[#263244]")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200", checked ? "left-[22px]" : "left-0.5")} />
      </button>
      {label}
    </label>
  );
}

function DropZone({ kind, label, icon: Icon, asset, progress, error, onPick, onRemove, image, compact }: {
  kind: AssetKind; label: string; icon: typeof Film; asset: { path: string | null; url: string | null };
  progress?: number; error?: string; onPick: (f: File | undefined) => void; onRemove: () => void; image?: boolean; compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  const id = `bk-file-${kind}`;
  const rule = ASSET_RULES[kind];
  return (
    <div>
      {!compact && <span className={LABEL}>{label}</span>}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onPick(e.dataTransfer.files?.[0]); }}
        className={cn("flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-5 text-center transition-colors",
          !compact && "sm:flex-row sm:text-left",
          over ? "border-[#54D045] bg-[#54D045]/[0.06]" : "border-[#263244] bg-[#0A111B]")}
      >
        <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#151F2E]", image ? "h-20 w-20" : compact ? "aspect-video w-full" : "aspect-video w-32")}>
          {asset.url ? (
            image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.url} alt="" className="h-full w-full object-contain p-1.5" />
            ) : (
              <video src={asset.url} muted controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" />
            )
          ) : (
            <Icon className="h-7 w-7 text-[#64748B]" aria-hidden />
          )}
        </div>
        <div className={cn("min-w-0", compact ? "w-full" : "flex-1")}>
          <p className="text-sm font-medium text-white">{asset.path ? "Uploaded" : "Drag & drop, or browse"}</p>
          <p className="mt-0.5 text-xs text-[#9299A8]">{rule.label}</p>
          {progress != null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#263244]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-[#54D045] transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-300" role="alert">{error}</p>}
        </div>
        <div className={cn("flex items-center gap-2", compact && "w-full justify-center")}>
          <input id={id} type="file" accept={rule.accept} className="sr-only" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
          <label htmlFor={id} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-[#263244] bg-[#151F2E] px-3.5 text-xs font-semibold text-white hover:border-[#3a475c]">
            {progress != null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {asset.path ? "Replace" : "Upload"}
          </label>
          {asset.path && progress == null && (
            <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#263244] text-[#9299A8] hover:border-red-400/40 hover:text-red-300">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
