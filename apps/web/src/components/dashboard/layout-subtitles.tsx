"use client";

/**
 * Output layout (aspect ratio, framing, background) and optional SRT upload
 * for the Create screen. The API enforces plan access and validates the SRT;
 * the worker renders exactly what is chosen here.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText, Loader2, Lock, RefreshCw, Trash2, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { cn } from "@/lib/utils";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";
export type LayoutMode = "fill" | "fit";
export type LayoutConfig = {
  aspect_ratio: AspectRatio;
  layout: LayoutMode;
  crop_ratio: "original" | "4:3" | "1:1";
  background: "blur" | "black" | "color";
  background_color: string;
  position: "center" | "top" | "bottom";
};
export type SubtitleInfo = {
  path: string;
  filename: string;
  size: number;
  cues: number;
  skipped: number;
  lastEnd: number;
  first: { start: number; end: number; text: string }[];
};

export const DEFAULT_LAYOUT: LayoutConfig = {
  aspect_ratio: "9:16",
  layout: "fill",
  crop_ratio: "original",
  background: "blur",
  background_color: "#101828",
  position: "center",
};

export const RATIOS: { id: AspectRatio; label: string; hint: string; w: number; h: number }[] = [
  { id: "9:16", label: "9:16", hint: "Shorts, Reels, TikTok", w: 9, h: 16 },
  { id: "16:9", label: "16:9", hint: "YouTube", w: 16, h: 9 },
  { id: "1:1", label: "1:1", hint: "Feed square", w: 1, h: 1 },
  { id: "4:5", label: "4:5", hint: "Instagram feed", w: 4, h: 5 },
];

const LAYOUTS: { id: string; label: string; enabled: boolean; hint: string }[] = [
  { id: "fill", label: "Fill", enabled: true, hint: "Crop to fill the frame" },
  { id: "fit", label: "Fit", enabled: true, hint: "Whole video with a background" },
  { id: "split", label: "Split", enabled: false, hint: "Needs a second source" },
  { id: "three", label: "Three", enabled: false, hint: "Needs multiple sources" },
  { id: "four", label: "Four", enabled: false, hint: "Needs multiple sources" },
  { id: "screen", label: "Screen Share", enabled: false, hint: "Needs speaker detection" },
  { id: "gameplay", label: "Gameplay", enabled: false, hint: "Needs facecam detection" },
];

const LAYOUT_SOON = "Coming soon: this layout needs multiple video sources or face tracking, which AutoClipr doesn't support yet.";

/** Plans allowed every ratio; Starter is vertical only (mirrors apps/api/src/common/plans.ts). */
export const ratioAllowed = (tier: string | null, r: AspectRatio) => r === "9:16" || (!!tier && tier !== "starter");

export const layoutSummary = (l: LayoutConfig) =>
  l.layout === "fill"
    ? `Fill · ${l.position}`
    : `Fit · ${l.crop_ratio === "original" ? "original crop" : l.crop_ratio} · ${l.background === "color" ? l.background_color : l.background} background`;

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);
const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

async function call<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in again.");
  const res = await apiFetch<T>(`/api/v1/videos${path}`, { method: "POST", body: JSON.stringify(body), token, skipGlobalLoader: true });
  if (!res.success) throw new Error(res.error?.message ?? "Something went wrong. Please try again.");
  return res.data as T;
}

export function LayoutSubtitlesSection({
  tier,
  layout,
  onLayoutChange,
  subtitle,
  onSubtitleChange,
}: {
  tier: string | null;
  layout: LayoutConfig;
  onLayoutChange: (l: LayoutConfig) => void;
  subtitle: SubtitleInfo | null;
  onSubtitleChange: (s: SubtitleInfo | null) => void;
}) {
  const set = (patch: Partial<LayoutConfig>) => onLayoutChange({ ...layout, ...patch });

  return (
    <div className="border-t border-[#253244] pt-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-5">
          {/* Ratio */}
          <div>
            <p className="mb-2.5 text-sm font-medium text-[#F8FAFC]">Aspect ratio</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Aspect ratio">
              {RATIOS.map((r) => {
                const allowed = ratioAllowed(tier, r.id);
                const on = layout.aspect_ratio === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-disabled={!allowed}
                    title={allowed ? r.hint : "Available on Creator, Pro and Business plans"}
                    onClick={() => allowed && set({ aspect_ratio: r.id })}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      on ? "border-[#54D045]/60 bg-[#54D045]/10" : "border-[#253244] bg-[#0A111B] hover:border-[#35445a]",
                      !allowed && "cursor-not-allowed opacity-55 hover:border-[#253244]",
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                      <span
                        className={cn("block rounded-[3px] border-2", on ? "border-[#54D045]" : "border-[#64748B]")}
                        style={{ width: (r.w / Math.max(r.w, r.h)) * 24, height: (r.h / Math.max(r.w, r.h)) * 24 }}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#F8FAFC]">{r.label}</span>
                      <span className="block truncate text-[10px] text-[#94A3B8]">{r.hint}</span>
                    </span>
                    {!allowed && <Lock className="absolute right-2 top-2 h-3 w-3 text-amber-300" />}
                  </button>
                );
              })}
            </div>
            {tier === "starter" && (
              <p className="mt-2 text-xs text-[#94A3B8]">
                Starter exports 9:16.{" "}
                <Link href="/subscription" className="font-medium text-[#8fe383] hover:underline">Upgrade</Link> for 16:9, 1:1 and 4:5.
              </p>
            )}
          </div>

          {/* Layout */}
          <div>
            <p className="mb-2.5 text-sm font-medium text-[#F8FAFC]">Layout</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Layout">
              {LAYOUTS.map((l) => {
                const on = layout.layout === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-disabled={!l.enabled}
                    title={l.enabled ? l.hint : LAYOUT_SOON}
                    onClick={() => l.enabled && set({ layout: l.id as LayoutMode })}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                      on ? "border-[#54D045]/60 bg-[#54D045]/10 text-[#F8FAFC]" : "border-[#253244] bg-[#0A111B] text-[#94A3B8]",
                      l.enabled ? "hover:text-[#F8FAFC]" : "cursor-not-allowed opacity-50",
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5 text-[#54D045]" />}
                    {l.label}
                    {!l.enabled && <span className="text-[10px] text-[#64748B]">Soon</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[#64748B]">Split, multi-panel, screen-share and gameplay layouts need extra sources or face tracking and aren&apos;t available yet.</p>
          </div>

          {/* Framing options */}
          {layout.layout === "fill" ? (
            <Segmented
              label="Keep in frame"
              value={layout.position}
              onChange={(v) => set({ position: v as LayoutConfig["position"] })}
              options={[["top", "Top"], ["center", "Center"], ["bottom", "Bottom"]]}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Segmented
                label="Crop video to"
                value={layout.crop_ratio}
                onChange={(v) => set({ crop_ratio: v as LayoutConfig["crop_ratio"] })}
                options={[["original", "Original"], ["4:3", "4:3"], ["1:1", "1:1"]]}
              />
              <div>
                <Segmented
                  label="Background"
                  value={layout.background}
                  onChange={(v) => set({ background: v as LayoutConfig["background"] })}
                  options={[["blur", "Blur"], ["black", "Black"], ["color", "Color"]]}
                />
                {layout.background === "color" && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-[#94A3B8]">
                    <input
                      type="color"
                      value={layout.background_color}
                      onChange={(e) => set({ background_color: e.target.value.toUpperCase() })}
                      className="h-7 w-9 cursor-pointer rounded border border-[#253244] bg-transparent"
                      aria-label="Background color"
                    />
                    {layout.background_color}
                  </label>
                )}
              </div>
            </div>
          )}

          <SrtUpload value={subtitle} onChange={onSubtitleChange} />
        </div>

        <LayoutPreview layout={layout} hasSrt={!!subtitle} />
      </div>
    </div>
  );
}

function Segmented({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[#94A3B8]">{label}</p>
      <div className="inline-flex rounded-xl border border-[#253244] bg-[#0A111B] p-0.5" role="radiogroup" aria-label={label}>
        {options.map(([id, text]) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}
            className={cn("h-8 rounded-lg px-3 text-xs font-medium", value === id ? "bg-[#263244] text-white" : "text-[#94A3B8] hover:text-white")}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Schematic of the output frame: where the source sits and what fills the rest. */
function LayoutPreview({ layout, hasSrt }: { layout: LayoutConfig; hasSrt: boolean }) {
  const r = RATIOS.find((x) => x.id === layout.aspect_ratio)!;
  const box = 150;
  const W = r.w >= r.h ? box * 1.3 : (box * r.w) / r.h;
  const H = r.w >= r.h ? (box * 1.3 * r.h) / r.w : box;
  // Source assumed 16:9 (typical); cropped first when a crop ratio is set.
  const src = layout.crop_ratio === "1:1" ? 1 : layout.crop_ratio === "4:3" ? 4 / 3 : 16 / 9;
  const fitW = Math.min(W, H * src);
  const fitH = fitW / src;
  const bg =
    layout.layout === "fill" ? "transparent" : layout.background === "black" ? "#000" : layout.background === "color" ? layout.background_color : "linear-gradient(135deg,#1e3a4a,#3b2f4a)";

  return (
    <div className="flex flex-col items-center gap-2 lg:w-[210px]">
      <p className="self-start text-xs font-medium text-[#94A3B8] lg:self-center">Preview</p>
      <div className="flex h-[200px] items-center justify-center">
        <div className="relative overflow-hidden rounded-lg border border-[#35445a]" style={{ width: W, height: H, background: bg }} aria-label={`${layout.aspect_ratio} ${layoutSummary(layout)}`}>
          {layout.layout === "fit" && layout.background === "blur" && <div className="absolute inset-0 backdrop-blur" />}
          {layout.layout === "fill" ? (
            <div className={cn("absolute inset-0 flex justify-center bg-gradient-to-br from-[#2a5d4a] to-[#24405e]",
              layout.position === "top" ? "items-start pt-3" : layout.position === "bottom" ? "items-end pb-8" : "items-center")}>
              <span className="h-7 w-7 rounded-full bg-white/70" />
            </div>
          ) : (
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-gradient-to-br from-[#2a5d4a] to-[#24405e] ring-1 ring-white/20"
              style={{ width: fitW, height: fitH }}>
              <span className="h-5 w-5 rounded-full bg-white/70" />
            </div>
          )}
          <span className="absolute inset-x-2 bottom-2 rounded bg-black/50 px-1 py-0.5 text-center text-[8px] font-bold text-white">
            {hasSrt ? "YOUR SUBTITLES" : "AI CAPTIONS"}
          </span>
        </div>
      </div>
      <p className="text-center text-[11px] text-[#64748B]">{layout.aspect_ratio} · {layout.layout === "fill" ? "Fill" : "Fit"}</p>
    </div>
  );
}

function SrtUpload({ value, onChange }: { value: SubtitleInfo | null; onChange: (s: SubtitleInfo | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!/\.srt$/i.test(file.name)) return setError("Only .srt subtitle files are supported.");
    if (file.size > 1024 * 1024) return setError("Subtitle file is too large (max 1 MB).");
    if (file.size === 0) return setError("This file is empty.");
    setBusy(true);
    try {
      const { path, upload_url } = await call<{ path: string; upload_url: string }>("/subtitles", { filename: file.name, size: file.size });
      const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": "application/x-subrip" }, body: file });
      if (!put.ok) throw new Error("Upload failed. Please try again.");
      const summary = await call<Omit<SubtitleInfo, "filename" | "size">>("/subtitles/validate", { path });
      onChange({ ...summary, filename: file.name, size: file.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-[#F8FAFC]">Subtitles <span className="font-normal text-[#64748B]">· optional</span></p>
      <p className="mb-2.5 text-xs text-[#94A3B8]">Upload an .srt to use your own subtitles instead of AI captions. Each clip gets the lines from its own time range.</p>
      <input ref={input} type="file" accept=".srt,application/x-subrip" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {value ? (
        <div className="rounded-xl border border-[#54D045]/30 bg-[#54D045]/[0.06] p-3">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-[#54D045]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{value.filename}</p>
              <p className="text-[11px] text-[#94A3B8]">
                {fmtSize(value.size)} · {value.cues} lines · up to {fmtTime(value.lastEnd)}
                {value.skipped > 0 && <span className="text-amber-300"> · {value.skipped} invalid skipped</span>}
              </p>
            </div>
            <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label="Replace subtitle file"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.06] hover:text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => onChange(null)} aria-label="Remove subtitle file"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-rose-500/10 hover:text-rose-300">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {value.first.length > 0 && (
            <ul className="mt-2.5 space-y-1 border-t border-white/5 pt-2.5">
              {value.first.map((c, i) => (
                <li key={i} className="flex gap-2 text-[11px]">
                  <span className="shrink-0 tabular-nums text-[#64748B]">{fmtTime(c.start)}</span>
                  <span className="truncate text-[#CBD5E1]">{c.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-[#35445a] px-4 text-sm font-medium text-[#CBD5E1] hover:border-[#54D045]/50 hover:text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Checking subtitles…" : "Upload SRT"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-[#fca5a5]" role="alert">{error}</p>}
    </div>
  );
}
