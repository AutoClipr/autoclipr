"use client";

/**
 * Output layout (aspect ratio, framing, background) and optional SRT upload
 * for the Create screen. The API enforces plan access and validates the SRT;
 * the worker renders exactly what is chosen here.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Crown, FileText, Info, Loader2, RefreshCw, UploadCloud, X } from "lucide-react";
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

/**
 * Compact "Layout ▾ · Upload SRT" bar for the Video source card. The layout
 * button opens a popover with ratio, layout and fit-crop tiles.
 */
export function LayoutBar({
  tier,
  layout,
  onLayoutChange,
  subtitle,
  onSubtitleChange,
  thumbnail,
}: {
  tier: string | null;
  layout: LayoutConfig;
  onLayoutChange: (l: LayoutConfig) => void;
  subtitle: SubtitleInfo | null;
  onSubtitleChange: (s: SubtitleInfo | null) => void;
  /** The source video's thumbnail, shown in the layout tiles. */
  thumbnail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const srt = useSrtUpload(onSubtitleChange);
  const r = RATIOS.find((x) => x.id === layout.aspect_ratio)!;

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div ref={wrap} className="relative flex items-center gap-2">
          <span className="text-sm text-[#94A3B8]">Layout</span>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[#F8FAFC] hover:bg-white/[0.06]"
          >
            <RatioGlyph w={r.w} h={r.h} />
            {layout.aspect_ratio}, {layout.layout === "fill" ? "Fill" : "Fit"}
            <ChevronDown className={cn("h-3.5 w-3.5 text-[#94A3B8] transition-transform", open && "rotate-180")} />
          </button>
          {open && <LayoutPopover tier={tier} layout={layout} onChange={onLayoutChange} thumb={thumbnail ?? null} />}
        </div>

        <input ref={srt.input} type="file" accept=".srt,application/x-subrip" className="hidden"
          onChange={(e) => e.target.files?.[0] && srt.upload(e.target.files[0])} />
        {!subtitle && (
          <button type="button" onClick={srt.pick} disabled={srt.busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-[#94A3B8] hover:bg-white/[0.06] hover:text-white disabled:opacity-60">
            {srt.busy ? "Checking…" : "Upload SRT"}
            {srt.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {subtitle && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[#54D045]/25 bg-[#54D045]/[0.06] px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-[#54D045]" />
          <div className="min-w-0 flex-1" title={subtitle.first.map((c) => `${fmtTime(c.start)}  ${c.text}`).join("\n")}>
            <p className="truncate text-xs font-medium text-white">{subtitle.filename}</p>
            <p className="text-[11px] text-[#94A3B8]">
              {fmtSize(subtitle.size)} · {subtitle.cues} lines · to {fmtTime(subtitle.lastEnd)}
              {subtitle.skipped > 0 && <span className="text-amber-300"> · {subtitle.skipped} skipped</span>}
            </p>
          </div>
          <button type="button" onClick={srt.pick} disabled={srt.busy} aria-label="Replace subtitle file"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#94A3B8] hover:bg-white/[0.06] hover:text-white">
            {srt.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => onSubtitleChange(null)} aria-label="Remove subtitle file"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#94A3B8] hover:bg-rose-500/10 hover:text-rose-300">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {srt.error && <p className="text-xs text-[#fca5a5]" role="alert">{srt.error}</p>}
    </div>
  );
}

function RatioGlyph({ w, h, size = 14 }: { w: number; h: number; size?: number }) {
  const m = Math.max(w, h);
  return <span className="inline-block rounded-[2px] border-[1.5px] border-current" style={{ width: (w / m) * size, height: (h / m) * size }} />;
}

const TILE_ON = "border-white";
const TILE_OFF = "border-white/[0.06] hover:border-white/40";

function Tick() {
  return (
    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#111]">
      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
    </span>
  );
}

function LayoutPopover({ tier, layout, onChange, thumb }: { tier: string | null; layout: LayoutConfig; onChange: (l: LayoutConfig) => void; thumb: string | null }) {
  const set = (p: Partial<LayoutConfig>) => onChange({ ...layout, ...p });
  return (
    <div role="dialog" aria-label="Layout settings"
      className="absolute left-0 top-full z-50 mt-2 w-[min(468px,calc(100vw-2rem))] rounded-[24px] border border-white/[0.08] bg-[#2A2B30]/[0.97] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
      <PopTitle>Select ratio</PopTitle>
      <div className="flex items-end gap-2.5">
        {RATIOS.map((r) => {
          const allowed = ratioAllowed(tier, r.id);
          const on = layout.aspect_ratio === r.id;
          const hgt = 80;
          const wd = r.w >= r.h ? Math.min(90, (hgt * r.w) / r.h * 0.62) : (hgt * r.w) / r.h;
          return (
            <button key={r.id} type="button" aria-pressed={on} disabled={!allowed}
              title={allowed ? r.hint : "Available on Creator, Pro and Business plans"}
              onClick={() => set({ aspect_ratio: r.id })}
              className="group flex flex-col items-center gap-1.5 disabled:cursor-not-allowed">
              <span className={cn("relative block rounded-lg border-2 bg-[#3A3B41]", on ? TILE_ON : TILE_OFF, !allowed && "opacity-60")}
                style={{ width: Math.max(wd, 48), height: r.w >= r.h ? (Math.max(wd, 48) * r.h) / r.w : hgt }}>
                {on && <Tick />}
              </span>
              <span className="flex items-center gap-0.5 text-[11px] text-[#A1A1AA]">
                {r.label} {!allowed && <Crown className="h-3 w-3 fill-amber-400 text-amber-400" />}
              </span>
            </button>
          );
        })}
      </div>
      {tier === "starter" && (
        <p className="mt-2 text-[11px] text-[#94A3B8]">
          <Crown className="mr-1 inline h-3 w-3 fill-amber-400 text-amber-400" />
          <Link href="/subscription" className="font-medium text-amber-300 hover:underline">Upgrade</Link> to export 16:9, 1:1 and 4:5.
        </p>
      )}

      <PopTitle className="mt-5" info="Fill crops to the frame. Fit keeps the whole picture with a background. Others are coming soon.">Layouts</PopTitle>
      <div className="grid grid-cols-7 gap-1.5">
        {LAYOUTS.map((l) => {
          const on = layout.layout === l.id;
          return (
            <button key={l.id} type="button" aria-pressed={on} disabled={!l.enabled}
              title={l.enabled ? l.hint : LAYOUT_SOON}
              onClick={() => set({ layout: l.id as LayoutMode })}
              className="flex min-w-0 flex-col items-center gap-1 disabled:cursor-not-allowed">
              <span className={cn("relative block aspect-[9/16] w-full overflow-hidden rounded-[10px] border-2 bg-[#3A3B41]", on ? TILE_ON : TILE_OFF, !l.enabled && "saturate-[0.6]")}>
                {thumb ? <ThumbArt id={l.id} src={thumb} /> : <DemoArt id={l.id} />}
                {on && <Tick />}
                {!l.enabled && (
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-px text-[7px] font-bold uppercase tracking-wide text-white">Soon</span>
                )}
              </span>
              <span className="w-full truncate text-center text-[11px] text-[#A1A1AA]">{l.label}</span>
            </button>
          );
        })}
      </div>

      {layout.layout === "fit" ? (
        <>
          <PopTitle className="mt-5" info="Crop the source before fitting it into the frame.">Fit Layout: Crop Ratio</PopTitle>
          <div className="flex gap-2.5">
            {(["original", "4:3", "1:1"] as const).map((c) => {
              const on = layout.crop_ratio === c;
              const band = c === "original" ? 0.32 : c === "4:3" ? 0.42 : 0.56;
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => set({ crop_ratio: c })} className="flex flex-col items-center gap-1.5">
                  <span className={cn("relative block h-[88px] w-[56px] overflow-hidden rounded-[10px] border-2 bg-[#3A3B41]", on ? TILE_ON : TILE_OFF)}>
                    <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden bg-[#6B6C72]" style={{ height: `${band * 100}%` }}>
                      <Img src={thumb ?? DEMO.podcast} pos="52% 40%" />
                    </span>
                    {on && <Tick />}
                  </span>
                  <span className="text-[11px] text-[#A1A1AA]">{c === "original" ? "Original" : c}</span>
                </button>
              );
            })}
            <div className="ml-auto flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-[#94A3B8]">Background</span>
              <div className="flex gap-1.5">
                {(["blur", "black", "color"] as const).map((b) => (
                  <button key={b} type="button" aria-pressed={layout.background === b} onClick={() => set({ background: b })}
                    className={cn("h-7 rounded-md border px-2 text-[11px] capitalize", layout.background === b ? "border-white bg-white/10 text-white" : "border-white/10 text-[#94A3B8] hover:text-white")}>
                    {b}
                  </button>
                ))}
              </div>
              {layout.background === "color" && (
                <label className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                  <input type="color" value={layout.background_color} aria-label="Background color"
                    onChange={(e) => set({ background_color: e.target.value.toUpperCase() })}
                    className="h-6 w-8 cursor-pointer rounded border border-white/10 bg-transparent" />
                  {layout.background_color}
                </label>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <PopTitle className="mt-5" info="Which part of the picture stays in frame when cropping.">Fill Layout: Keep in Frame</PopTitle>
          <div className="flex gap-2.5">
            {(["top", "center", "bottom"] as const).map((p) => {
              const on = layout.position === p;
              const y = p === "top" ? "0%" : p === "bottom" ? "100%" : "50%";
              return (
                <button key={p} type="button" aria-pressed={on} onClick={() => set({ position: p })} className="flex flex-col items-center gap-1.5">
                  <span className={cn("relative block h-[88px] w-[56px] overflow-hidden rounded-[10px] border-2 bg-[#3A3B41]", on ? TILE_ON : TILE_OFF)}>
                    {/* Tall strip of the source; the bright window is the part kept in frame. */}
                    <span className="absolute inset-0 opacity-35"><Img src={thumb ?? DEMO.podcast} pos="52% 50%" className="scale-[1.6]" /></span>
                    <span className="absolute inset-x-0 h-[62%] overflow-hidden border-y border-white/70"
                      style={{ top: y, transform: `translateY(-${y})` }}>
                      <Img src={thumb ?? DEMO.podcast} pos={`52% ${y}`} />
                    </span>
                    {on && <Tick />}
                  </span>
                  <span className="text-[11px] capitalize text-[#A1A1AA]">{p}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PopTitle({ children, info, className }: { children: React.ReactNode; info?: string; className?: string }) {
  return (
    <p className={cn("mb-2.5 flex items-center gap-1.5 text-sm font-medium text-[#E2E8F0]", className)}>
      {children}
      {info && <Info className="h-3.5 w-3.5 text-[#94A3B8]" aria-label={info}><title>{info}</title></Info>}
    </p>
  );
}

/* eslint-disable @next/next/no-img-element -- remote/blob thumbnails, sized by the tile */
function Img({ src, pos = "center", className }: { src: string; pos?: string; className?: string }) {
  return <img src={src} alt="" draggable={false} className={cn("absolute inset-0 h-full w-full object-cover", className)} style={{ objectPosition: pos }} />;
}
/* eslint-enable @next/next/no-img-element */

/** Layout tiles built from the user's own video thumbnail. */
function ThumbArt({ id, src, b = src, pos = "center" }: { id: string; src: string; b?: string; pos?: string }) {
  const cell = (style: React.CSSProperties, p: string, k: string, img = src) => (
    <span key={k} className="absolute overflow-hidden" style={style}><Img src={img} pos={p} /></span>
  );
  const half = { left: 0, right: 0, height: "50%" } as const;
  switch (id) {
    case "fill":
      return <Img src={src} pos={pos} />;
    case "fit":
      return (
        <>
          <Img src={src} className="scale-125 blur-[6px] brightness-75" />
          <span className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2 overflow-hidden"><Img src={src} pos={pos} /></span>
        </>
      );
    case "split":
      return <>{cell({ ...half, top: 0 }, pos, "a")}{cell({ ...half, bottom: 0 }, "50% 30%", "b", b)}</>;
    case "three":
      return <>{cell({ ...half, top: 0 }, pos, "a")}{cell({ left: 0, width: "50%", bottom: 0, height: "50%" }, "50% 30%", "b", b)}{cell({ right: 0, width: "50%", bottom: 0, height: "50%" }, pos, "c")}</>;
    case "four":
      return <>{[["0", "0"], ["50%", "0"], ["0", "50%"], ["50%", "50%"]].map(([l, t], i) => cell({ left: l, top: t, width: "50%", height: "50%" }, i % 3 ? "50% 30%" : pos, String(i), i % 3 ? b : src))}</>;
    case "screen":
      return (
        <>
          {cell({ ...half, top: 0, height: "45%" }, "30% center", "a")}
          <span className="absolute inset-x-0 bottom-0 h-[55%] bg-[#F4F5F7] p-[8%]">
            <span className="block h-[10%] w-3/4 rounded-sm bg-[#3B82F6]/70" />
            <span className="mt-[8%] grid grid-cols-3 gap-[6%]">
              {["#FCA5A5", "#A7F3D0", "#FDE68A", "#C4B5FD", "#93C5FD", "#FBCFE8"].map((c) => <span key={c} className="block aspect-square rounded-sm" style={{ background: c }} />)}
            </span>
          </span>
        </>
      );
    default:
      return <>{cell({ ...half, top: 0, height: "42%" }, "30% center", "a")}{cell({ left: 0, right: 0, bottom: 0, height: "58%" }, "75% center", "b")}</>;
  }
}

/** Sample stills shown until the user picks a video. */
const DEMO = {
  podcast: "/showcase/podcast.jpg",
  talking: "/showcase/talking-head.jpg",
  screen: "/showcase/screenshare.jpg",
  gameplay: "/showcase/gameplay.jpg",
};

function DemoArt({ id }: { id: string }) {
  if (id === "screen")
    return (
      <>
        <span className="absolute inset-x-0 top-0 h-[42%] overflow-hidden"><Img src={DEMO.screen} pos="92% 85%" className="scale-[2.2] origin-[92%_85%]" /></span>
        <span className="absolute inset-x-0 bottom-0 h-[58%] overflow-hidden"><Img src={DEMO.screen} pos="30% 30%" /></span>
      </>
    );
  if (id === "gameplay")
    return (
      <>
        <span className="absolute inset-x-0 top-0 h-[42%] overflow-hidden"><Img src={DEMO.gameplay} pos="0% 0%" className="scale-[2.4] origin-top-left" /></span>
        <span className="absolute inset-x-0 bottom-0 h-[58%] overflow-hidden"><Img src={DEMO.gameplay} pos="65% 60%" /></span>
      </>
    );
  return <ThumbArt id={id} src={DEMO.podcast} b={DEMO.talking} pos="52% 40%" />;
}

function useSrtUpload(onChange: (s: SubtitleInfo | null) => void) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (input.current) input.current.value = "";
    if (!/\.srt$/i.test(file.name)) return setError("Only .srt subtitle files are supported.");
    if (file.size === 0) return setError("This subtitle file is empty.");
    if (file.size > 1024 * 1024) return setError("Subtitle file is too large (max 1 MB).");
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
    }
  }
  return { input, busy, error, upload, pick: () => input.current?.click() };
}
