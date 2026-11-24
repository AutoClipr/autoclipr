/**
 * AI Hook & Headline: client-side types, settings and preview looks.
 *
 * The template list, prices and plan access come from the API
 * (GET /api/v1/videos/hook-templates); the API re-checks everything on
 * submit. HOOK_LOOKS only drives the live browser preview and mirrors the
 * worker's render specs (apps/workers/src/pipeline/hooks.ts).
 */
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";

export type HookKind = "viral" | "headline";
export type HookAccess = "none" | "basic" | "all";
export type HookTemplate = {
  id: string;
  kind: HookKind;
  name: string;
  description: string;
  tier: "basic" | "premium";
  credits: number;
  defaultSeconds: number;
  ratios: string[];
  sfx: "whoosh" | "pop" | "riser" | "hit" | "none";
  allowed: boolean;
};

export type HookAnim = "pop" | "slide" | "words" | "fade" | "zoomblur" | "flicker" | "drop" | "snap" | "none";
export type HookLook = {
  font: "sans" | "serif" | "script";
  weight: number;
  /** Font size on a 1080-wide canvas (same unit as the renderer). */
  size: number;
  color: string;
  accent: string;
  upper?: boolean;
  italic?: boolean;
  scaleX?: number;
  outline?: number;
  box?: string;
  sweep?: boolean;
  anim: HookAnim;
  pos: "top" | "middle" | "bottom";
  tilt?: number;
  card: "blur" | "white" | "color" | "frame" | "montage" | "flashes" | "split";
  cardColor?: string;
  extra?: "glow" | "extrude" | "scribble" | "burst" | "number" | "kicker" | "accent";
  accentFont?: "sans" | "serif" | "script";
  maxChars?: number;
};

const L = (o: Partial<HookLook>): HookLook => ({
  font: "sans", weight: 900, size: 110, color: "#FFFFFF", accent: "#54D045", anim: "pop", pos: "middle", card: "blur", maxChars: 14, ...o,
});

export const HOOK_LOOKS: Record<string, HookLook> = {
  montage: L({ font: "serif", weight: 400, size: 120, color: "#111111", box: "#FAFAFA", anim: "words", card: "montage" }),
  cutaway: L({ weight: 800, size: 96, color: "#111111", anim: "slide", card: "white" }),
  halo: L({ size: 150, color: "#FFE45C", accent: "#FFD000", anim: "zoomblur", pos: "top", upper: true, extra: "glow", maxChars: 9 }),
  condensed_italic: L({ weight: 800, size: 130, italic: true, scaleX: 72, upper: true, anim: "snap", outline: 4, maxChars: 12 }),
  cadence: L({ weight: 800, size: 104, anim: "words", outline: 5 }),
  hero: L({ font: "script", weight: 400, size: 150, color: "#FFE600", outline: 6, anim: "zoomblur", pos: "top", extra: "accent", accentFont: "sans", maxChars: 10 }),
  highlighter: L({ weight: 800, size: 96, color: "#111111", box: "#FFE600", sweep: true, anim: "fade", card: "frame" }),
  match_cut: L({ size: 124, upper: true, outline: 6, anim: "words", card: "flashes", maxChars: 10 }),
  neon: L({ font: "script", weight: 400, size: 140, color: "#FFE6FF", accent: "#FF2BD6", anim: "flicker", extra: "glow", maxChars: 12 }),
  script_editorial: L({ font: "serif", weight: 400, size: 120, italic: true, anim: "fade", pos: "top", extra: "accent", accentFont: "script", accent: "#FFFFFF" }),
  polaroid_tilt: L({ weight: 800, size: 88, color: "#151515", box: "#FFFFFF", anim: "drop", tilt: -6 }),
  depth: L({ size: 160, color: "#F5F0E6", accent: "#3A2E26", upper: true, anim: "pop", pos: "top", extra: "extrude", maxChars: 12 }),
  interrupt: L({ font: "serif", weight: 400, size: 140, italic: true, anim: "pop", card: "color", cardColor: "#0B3A9E" }),
  scribble: L({ weight: 800, size: 104, upper: true, outline: 4, anim: "pop", extra: "scribble", accent: "#FF3B6B", tilt: -3 }),
  brush: L({ size: 104, color: "#111111", upper: true, box: "#FFC400", sweep: true, anim: "fade", tilt: -2 }),
  glass: L({ weight: 800, size: 100, box: "rgba(255,255,255,0.22)", anim: "fade", pos: "bottom" }),
  comic: L({ size: 92, color: "#111111", upper: true, box: "#FFFFFF", anim: "pop", tilt: -4, extra: "burst", accent: "#FFE600" }),
  split: L({ size: 110, color: "#111111", upper: true, anim: "slide", card: "split", cardColor: "#F2F2F2", pos: "bottom" }),
  numbered_list: L({ size: 130, upper: true, outline: 5, anim: "pop", extra: "number", accent: "#E8FF3A", maxChars: 10 }),
  editorial: L({ font: "serif", weight: 400, size: 104, anim: "fade", pos: "middle", extra: "accent", accentFont: "script", accent: "#E8FF3A", card: "frame" }),
  statement: L({ size: 104, anim: "slide", pos: "middle", extra: "kicker", card: "frame" }),
  sunset: L({ size: 66, upper: true, box: "#FF1E9B", anim: "pop", pos: "top", card: "frame", maxChars: 18 }),
  classic: L({ size: 66, color: "#111111", upper: true, box: "#FFFFFF", anim: "pop", pos: "top", card: "frame", maxChars: 18 }),
};
export const lookFor = (id: string) => HOOK_LOOKS[id] ?? HOOK_LOOKS.cadence;

/** Headline customisation options (mirror the API DTO). */
export const HOOK_FONTS = [
  { id: "Montserrat", label: "Montserrat", css: "sans" as const, weight: 600 },
  { id: "Montserrat ExtraBold", label: "Montserrat ExtraBold", css: "sans" as const, weight: 800 },
  { id: "Montserrat Black", label: "Montserrat Black", css: "sans" as const, weight: 900 },
  { id: "DejaVu Sans", label: "DejaVu Sans", css: "sans" as const, weight: 700 },
  { id: "EB Garamond", label: "EB Garamond", css: "serif" as const, weight: 400 },
  { id: "Pacifico", label: "Pacifico", css: "script" as const, weight: 400 },
];
export const HOOK_ANIMATIONS = ["none", "fade", "pop", "slide", "typewriter"] as const;
export const HOOK_BACKGROUNDS = ["none", "box", "pill"] as const;

export type HookSettings = {
  enabled: boolean;
  kind: HookKind;
  template_id: string;
  placement: "opening" | "overlay";
  duration: number;
  textMode: "ai" | "custom";
  text: string;
  sfx: boolean;
  // Headline customisation (undefined = template default).
  font?: string;
  size?: number;
  color?: string;
  bg_color?: string;
  position?: "top" | "middle" | "bottom";
  animation?: (typeof HOOK_ANIMATIONS)[number];
  background?: (typeof HOOK_BACKGROUNDS)[number];
  use_brand: boolean;
};

export const DEFAULT_HOOK: HookSettings = {
  enabled: false,
  kind: "viral",
  template_id: "halo",
  placement: "opening",
  duration: 2.5,
  textMode: "ai",
  text: "",
  sfx: true,
  use_brand: false,
};

/** Look after headline customisation (mirrors the worker's resolveSpec). */
export function resolveLook(h: HookSettings, brandPrimary?: string | null): HookLook {
  const base = lookFor(h.template_id);
  if (h.kind !== "headline") return base;
  const l: HookLook = { ...base };
  const f = HOOK_FONTS.find((x) => x.id === h.font);
  if (f) {
    l.font = f.css;
    l.weight = f.weight;
  }
  if (h.size) l.size = h.size;
  if (h.color) l.color = h.color;
  if (h.position) l.pos = h.position;
  if (h.animation) l.anim = h.animation === "typewriter" ? "words" : h.animation;
  if (h.background === "none") l.box = undefined;
  else if (h.background) l.box = h.bg_color ?? l.box ?? "#000000";
  else if (h.bg_color && l.box) l.box = h.bg_color;
  if (h.use_brand && brandPrimary) {
    if (l.box) l.box = brandPrimary;
    else l.accent = brandPrimary;
  }
  return l;
}

/** Request body field; undefined when hooks are off. */
export function hookPayload(h: HookSettings) {
  if (!h.enabled) return undefined;
  const custom = h.textMode === "custom" && h.text.trim() ? h.text.trim().slice(0, 80) : undefined;
  const headline =
    h.kind === "headline"
      ? Object.fromEntries(
          Object.entries({
            font: h.font, size: h.size, color: h.color, bg_color: h.bg_color, position: h.position,
            animation: h.animation, background: h.background, use_brand: h.use_brand || undefined,
          }).filter(([, v]) => v !== undefined),
        )
      : {};
  return {
    kind: h.kind,
    template_id: h.template_id,
    placement: h.placement,
    duration: h.duration,
    sfx: h.sfx,
    ...(custom ? { text: custom } : {}),
    ...headline,
  };
}

/** Same greedy wrap as the renderer (max 3 lines). */
export function wrapHookLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(" ").filter(Boolean)) {
    if (cur && `${cur} ${w}`.length > maxChars) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines.length > 3 ? [...lines.slice(0, 2), lines.slice(2).join(" ")] : lines;
}

type HookList = { access: HookAccess; templates: HookTemplate[] };

/** One shared copy per page; every reader is notified when it arrives. */
let cache: Promise<HookList> | null = null;
let snapshot: HookList | null = null;
const listeners = new Set<(d: HookList) => void>();

export const getHookSnapshot = () => snapshot;
export function subscribeHookTemplates(fn: (d: HookList) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Templates with the signed-in user's access (cached per page load). */
export function fetchHookTemplates(force = false): Promise<HookList> {
  if (!cache || force) {
    cache = (async () => {
      // The session can take a moment to restore after a page load.
      let token = await getAccessToken();
      for (let i = 0; !token && i < 5; i++) {
        await new Promise((r) => setTimeout(r, 400));
        token = await getAccessToken();
      }
      if (!token) throw new Error("Please sign in again.");
      const res = await apiFetch<HookList>("/api/v1/videos/hook-templates", { token, skipGlobalLoader: true });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? "Couldn't load hook templates.");
      snapshot = res.data;
      listeners.forEach((fn) => fn(res.data!));
      return res.data;
    })();
    cache.catch(() => (cache = null));
  }
  return cache;
}
