/**
 * Video enhancements: client types, defaults and pricing estimate. The list,
 * prices and plan access come from GET /api/v1/videos/enhancements; the API
 * re-checks everything and charges on submit.
 */
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";

export type EnhancementId =
  | "motion_graphics" | "ai_emojis" | "speech_cleanup" | "enhance_audio" | "auto_sfx"
  | "auto_zoom" | "transitions" | "color_correction" | "eye_contact" | "voice_dubbing" | "caption_translation";
export type EnhancementGroup = "creative" | "sound" | "look" | "translate";
export type Enhancement = {
  id: EnhancementId;
  group: EnhancementGroup;
  name: string;
  description: string;
  tier: "free" | "premium";
  creditsPerMinute: number;
  beta?: boolean;
  available: boolean;
  allowed: boolean;
};

/** Settings per enabled feature (a present key means "on"). */
export type EnhancementSettings = Partial<{
  motion_graphics: { progress_bar: boolean; keywords: boolean; color: string };
  ai_emojis: { density: "low" | "medium" | "high"; position: "above" | "corner" };
  speech_cleanup: { pauses: boolean; fillers: boolean; max_pause: number };
  enhance_audio: { noise: "light" | "strong" };
  auto_sfx: { intensity: "subtle" | "normal" | "bold"; volume: number };
  auto_zoom: { strength: "subtle" | "medium" | "strong" };
  transitions: { style: "fade" | "slide" | "zoom" | "wipe"; duration: number };
  color_correction: { preset: "natural" | "vibrant" | "warm" | "cool" };
  voice_dubbing: { language: string };
  caption_translation: { language: string };
}>;

export const DEFAULT_SETTINGS: Required<EnhancementSettings> = {
  motion_graphics: { progress_bar: true, keywords: true, color: "#54D045" },
  ai_emojis: { density: "medium", position: "above" },
  speech_cleanup: { pauses: true, fillers: true, max_pause: 0.6 },
  enhance_audio: { noise: "light" },
  auto_sfx: { intensity: "normal", volume: 70 },
  auto_zoom: { strength: "medium" },
  transitions: { style: "fade", duration: 0.4 },
  color_correction: { preset: "natural" },
  voice_dubbing: { language: "es" },
  caption_translation: { language: "en" },
};

export const GROUPS: { id: EnhancementGroup; label: string }[] = [
  { id: "creative", label: "Creative effects" },
  { id: "sound", label: "Sound sharp" },
  { id: "look", label: "Look good" },
  { id: "translate", label: "Translate" },
];

export const LANGUAGES = [
  { id: "en", label: "English" }, { id: "hi", label: "Hindi" }, { id: "es", label: "Spanish" }, { id: "fr", label: "French" },
  { id: "de", label: "German" }, { id: "pt", label: "Portuguese" }, { id: "it", label: "Italian" }, { id: "ar", label: "Arabic" },
  { id: "id", label: "Indonesian" }, { id: "nl", label: "Dutch" }, { id: "tr", label: "Turkish" },
];

/**
 * Up-front estimate (mirrors the API): every clip at the longest chosen
 * length, whole minutes. The worker refunds what real clips don't use.
 */
export function estimateCredits(list: Enhancement[] | undefined, s: EnhancementSettings, clipCount: number, durations: number[]) {
  const perMinute = (Object.keys(s) as EnhancementId[]).reduce((sum, id) => sum + (list?.find((e) => e.id === id)?.creditsPerMinute ?? 0), 0);
  const minutes = Math.max(1, Math.ceil(Math.max(60, ...(durations.length ? durations : [60])) / 60));
  return { perMinute, credits: perMinute * minutes * clipCount, minutes };
}

type EnhancementList = { access: "basic" | "all"; items: Enhancement[] };

/**
 * One shared copy of the list for the whole page. Every component reading it
 * is notified when it arrives, so the panel and the summary always agree.
 */
let cache: Promise<EnhancementList> | null = null;
let snapshot: EnhancementList | null = null;
const listeners = new Set<(d: EnhancementList) => void>();

export function getEnhancementSnapshot() {
  return snapshot;
}

export function subscribeEnhancements(fn: (d: EnhancementList) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function fetchEnhancements(force = false): Promise<EnhancementList> {
  if (!cache || force) {
    cache = (async () => {
      // The session can take a moment to restore after a page load.
      let token = await getAccessToken();
      for (let i = 0; !token && i < 5; i++) {
        await new Promise((r) => setTimeout(r, 400));
        token = await getAccessToken();
      }
      if (!token) throw new Error("Please sign in again.");
      const res = await apiFetch<EnhancementList>("/api/v1/videos/enhancements", { token, skipGlobalLoader: true });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? "Couldn't load enhancements.");
      snapshot = res.data;
      listeners.forEach((fn) => fn(res.data!));
      return res.data;
    })();
    cache.catch(() => (cache = null));
  }
  return cache;
}
