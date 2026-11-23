"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Film, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  ASSET_RULES,
  BRAND_FONTS,
  CAPTION_PRESETS,
  DEFAULT_COLORS,
  LOGO_POSITIONS,
  brandKitsApi,
  fontCss,
  type AssetKind,
  type BrandCaptions,
  type BrandColors,
  type BrandKit,
  type BrandKitInput,
  type BrandLogo,
  type BrandTypography,
} from "@/lib/brand-kits";
import { cn } from "@/lib/utils";
import { BrandPreview, Swatches } from "./brand-preview";

const STEPS = ["Basics", "Colours", "Typography", "Captions", "Intro & outro", "Review"] as const;

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

const INPUT = "h-10 w-full rounded-lg border border-[#253244] bg-[#0A111B] px-3 text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B] focus:border-[#54D045]/60";
const LABEL = "mb-1.5 block text-xs font-medium text-[#94A3B8]";

export function BrandKitEditor({ kit, onDone, onCancel }: { kit?: BrandKit | null; onDone: (k: BrandKit) => void; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => draftFrom(kit));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Partial<Record<AssetKind, number>>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  async function upload(kind: AssetKind, file: File | undefined) {
    if (!file) return;
    setUploading((u) => ({ ...u, [kind]: 0 }));
    try {
      const path = await brandKitsApi.uploadAsset(kind, file, (pct) => setUploading((u) => ({ ...u, [kind]: pct })));
      setD((p) => ({
        ...p,
        assets: { ...p.assets, [kind]: { path, url: URL.createObjectURL(file) } },
        ...(kind === "intro" ? { intro_enabled: true } : kind === "outro" ? { outro_enabled: true } : {}),
      }));
    } catch (e) {
      toast.error((e as Error).message);
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
      setStep(0);
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
  const preview = (
    <BrandPreview
      captions={d.captions}
      colors={d.colors}
      logo={d.logo}
      logoUrl={d.assets.logo.url}
      captionFont={d.typography.caption_font}
      headingFont={d.typography.heading_font}
      name={d.name}
      className="mx-auto max-w-[240px]"
    />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <section className="rounded-2xl border border-[#253244] bg-[#101824] p-5 sm:p-6">
        {/* Steps */}
        <ol className="mb-6 flex gap-1.5 overflow-x-auto pb-1" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors",
                  i === step ? "border-[#54D045]/50 bg-[#54D045]/15 text-[#bdf5b4]" : i < step ? "border-[#253244] text-[#cbd5e1]" : "border-[#253244] text-[#64748B]",
                )}
              >
                <span className="tabular-nums">{i + 1}</span> {s}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className={LABEL} htmlFor="bk-name">Brand kit name</label>
              <input id="bk-name" maxLength={60} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="My YouTube Brand" className={INPUT} />
            </div>
            <div>
              <label className={LABEL} htmlFor="bk-desc">Description (optional)</label>
              <textarea id="bk-desc" maxLength={280} rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} className={cn(INPUT, "h-auto py-2")} />
            </div>
            <AssetField kind="logo" label="Logo" icon={ImagePlus} asset={d.assets.logo} progress={uploading.logo}
              onPick={(f) => upload("logo", f)} onRemove={() => set("assets", { ...d.assets, logo: { path: null, url: null } })} image />
            {d.assets.logo.path && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <span className={LABEL}>Position</span>
                  <select value={d.logo.position} onChange={(e) => set("logo", { ...d.logo, position: e.target.value as BrandLogo["position"] })} className={INPUT}>
                    {LOGO_POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <Slider label="Size" value={d.logo.size ?? 14} min={5} max={40} suffix="%" onChange={(v) => set("logo", { ...d.logo, size: v })} />
                <Slider label="Opacity" value={Math.round((d.logo.opacity ?? 0.9) * 100)} min={10} max={100} suffix="%" onChange={(v) => set("logo", { ...d.logo, opacity: v / 100 })} />
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {(["primary", "secondary", "accent", "background", "text"] as const).map((k) => (
              <ColorField key={k} label={k[0].toUpperCase() + k.slice(1)} value={d.colors[k]} onChange={(v) => set("colors", { ...d.colors, [k]: v })} />
            ))}
            <div className="flex items-center gap-3 rounded-xl border border-[#253244] p-3">
              <Swatches colors={d.colors} />
              <button type="button" onClick={() => set("colors", DEFAULT_COLORS)} className="ml-auto text-xs text-[#94A3B8] hover:text-white">Reset to default</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FontField label="Heading font" value={d.typography.heading_font} onChange={(v) => set("typography", { ...d.typography, heading_font: v })} />
            <FontField label="Caption font" value={d.typography.caption_font} onChange={(v) => set("typography", { ...d.typography, caption_font: v })} />
            <div>
              <span className={LABEL}>Font weight</span>
              <select value={d.typography.font_weight ?? 800} onChange={(e) => set("typography", { ...d.typography, font_weight: Number(e.target.value) })} className={INPUT}>
                {[400, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <span className={LABEL}>Text size</span>
              <select value={d.typography.text_size} onChange={(e) => set("typography", { ...d.typography, text_size: e.target.value as BrandTypography["text_size"] })} className={INPUT}>
                <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <span className={LABEL}>Caption alignment</span>
              <Segmented value={d.captions.alignment ?? "center"} options={["left", "center", "right"]} onChange={(v) => set("captions", { ...d.captions, alignment: v as BrandCaptions["alignment"] })} />
            </div>
            <p className="text-xs text-[#64748B] sm:col-span-2">Fonts are the ones installed in our renderer, so captions look the same in your exports.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <span className={LABEL}>Preset</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CAPTION_PRESETS.map((p) => (
                  <button key={p.id} type="button"
                    onClick={() => set("captions", { ...d.captions, ...p.defaults, preset: p.id })}
                    className={cn("rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors",
                      d.captions.preset === p.id ? "border-[#54D045]/60 bg-[#54D045]/10 text-white" : "border-[#253244] text-[#94A3B8] hover:text-white")}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FontField label="Font" value={d.captions.font ?? d.typography.caption_font} onChange={(v) => set("captions", { ...d.captions, font: v })} />
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
              <label className="flex items-center gap-2 text-sm text-[#cbd5e1]">
                <input type="checkbox" checked={!!d.captions.background} onChange={(e) => set("captions", { ...d.captions, background: e.target.checked })} className="h-4 w-4 accent-[#54D045]" />
                Background box
              </label>
              {d.captions.background && (
                <ColorField label="Box colour" value={d.captions.background_color ?? "#000000"} onChange={(v) => set("captions", { ...d.captions, background_color: v })} />
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            {(["intro", "outro"] as const).map((k) => (
              <div key={k} className="space-y-3">
                <AssetField kind={k} label={k === "intro" ? "Intro video" : "Outro video"} icon={Film} asset={d.assets[k]} progress={uploading[k]}
                  onPick={(f) => upload(k, f)} onRemove={() => setD((p) => ({ ...p, assets: { ...p.assets, [k]: { path: null, url: null } }, [`${k}_enabled`]: false }))} />
                {d.assets[k].path && (
                  <label className="flex items-center gap-2 text-sm text-[#cbd5e1]">
                    <input type="checkbox" checked={d[`${k}_enabled`]} onChange={(e) => set(`${k}_enabled`, e.target.checked)} className="h-4 w-4 accent-[#54D045]" />
                    Add {k} to every clip
                  </label>
                )}
              </div>
            ))}
            <p className="text-xs text-[#64748B]">Intros and outros are resized to fit the clip (letterboxed if needed). Clips keep their own audio.</p>
          </div>
        )}

        {step === 5 && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Review label="Name" value={d.name || "—"} />
            <Review label="Logo" value={d.assets.logo.path ? `${LOGO_POSITIONS.find((p) => p.id === d.logo.position)?.label} · ${d.logo.size}% · ${Math.round((d.logo.opacity ?? 0.9) * 100)}% opacity` : "None"} />
            <Review label="Colours" value={<Swatches colors={d.colors} />} />
            <Review label="Typography" value={`${d.typography.heading_font} / ${d.typography.caption_font}`} />
            <Review label="Caption style" value={CAPTION_PRESETS.find((p) => p.id === d.captions.preset)?.label ?? "Custom"} />
            <Review label="Intro" value={d.assets.intro.path ? (d.intro_enabled ? "Enabled" : "Uploaded, off") : "None"} />
            <Review label="Outro" value={d.assets.outro.path ? (d.outro_enabled ? "Enabled" : "Uploaded, off") : "None"} />
          </dl>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#253244] pt-5">
          <button type="button" onClick={step === 0 ? onCancel : () => setStep(step - 1)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#253244] px-4 text-sm text-[#F8FAFC] hover:bg-white/[0.04]">
            <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#F8FAFC] px-4 text-sm font-semibold text-[#070B12] hover:bg-white">
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={save} disabled={saving || busy} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#54D045] px-5 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53] disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Brand Kit
            </button>
          )}
        </div>
      </section>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-center text-xs font-medium text-[#94A3B8]">Live preview · 9:16</p>
        {preview}
      </aside>
    </div>
  );
}

/* ─── Small fields ─────────────────────────────────────────────────────── */

function Review({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#253244] bg-[#0A111B] p-3">
      <dt className="text-xs text-[#94A3B8]">{label}</dt>
      <dd className="mt-1 font-medium text-[#F8FAFC]">{value}</dd>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} colour`} value={value} onChange={(e) => { onChange(e.target.value.toUpperCase()); setText(e.target.value.toUpperCase()); }}
          className="h-10 w-12 cursor-pointer rounded-lg border border-[#253244] bg-[#0A111B] p-1" />
        <input value={text} maxLength={7} aria-label={`${label} hex`}
          onChange={(e) => { setText(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toUpperCase()); }}
          className={cn(INPUT, "font-mono uppercase", !/^#[0-9a-fA-F]{6}$/.test(text) && "border-red-400/60")} />
      </div>
    </div>
  );
}

function FontField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
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
      <span className={cn(LABEL, "flex justify-between")}>{label}<span className="tabular-nums text-[#F8FAFC]">{value}{suffix}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="w-full accent-[#54D045]" />
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[#253244] bg-[#0A111B] p-0.5" role="radiogroup">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={cn("h-8 rounded-md px-3 text-xs font-medium capitalize", value === o ? "bg-[#253244] text-white" : "text-[#94A3B8] hover:text-white")}>
          {o}
        </button>
      ))}
    </div>
  );
}

function AssetField({ kind, label, icon: Icon, asset, progress, onPick, onRemove, image }: {
  kind: AssetKind; label: string; icon: typeof Film; asset: { path: string | null; url: string | null };
  progress?: number; onPick: (f: File | undefined) => void; onRemove: () => void; image?: boolean;
}) {
  const id = `bk-file-${kind}`;
  const rule = ASSET_RULES[kind];
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <div className="flex items-center gap-4 rounded-xl border border-dashed border-[#253244] bg-[#0A111B] p-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#101824]">
          {asset.url ? (
            image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.url} alt="" className="h-full w-full object-contain" />
            ) : (
              <video src={asset.url} muted className="h-full w-full object-cover" />
            )
          ) : (
            <Icon className="h-6 w-6 text-[#64748B]" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#94A3B8]">{rule.label}</p>
          {progress != null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#253244]" aria-label={`Uploading ${progress}%`}>
              <div className="h-full bg-[#54D045] transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <input id={id} type="file" accept={rule.accept} className="sr-only" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
        <label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#253244] px-3 text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.04]">
          {progress != null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {asset.path ? "Replace" : "Upload"}
        </label>
        {asset.path && progress == null && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="rounded-lg p-2 text-[#94A3B8] hover:bg-white/[0.04] hover:text-red-300">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
