/**
 * AI video enhancements: which exist, who may use them and what they cost.
 * The worker renders each one (apps/workers/src/pipeline/enhance.ts); the web
 * app reads this list from GET /videos/enhancements. Prices are per minute of
 * rendered clip, estimated up front and settled to the actual duration.
 */
export type EnhancementGroup = 'creative' | 'sound' | 'look' | 'translate';
/** free: every plan. premium: plans with enhancement access 'all'. */
export type EnhancementTier = 'free' | 'premium';
export type EnhancementAccess = 'basic' | 'all';

export interface EnhancementMeta {
  id: EnhancementId;
  group: EnhancementGroup;
  name: string;
  description: string;
  tier: EnhancementTier;
  /** Credits per started minute of clip (0 = included). */
  creditsPerMinute: number;
  beta?: boolean;
  /** False when the capability isn't built yet (shown as coming soon). */
  available: boolean;
}

export type EnhancementId =
  | 'motion_graphics'
  | 'ai_emojis'
  | 'speech_cleanup'
  | 'enhance_audio'
  | 'auto_sfx'
  | 'auto_zoom'
  | 'transitions'
  | 'color_correction'
  | 'eye_contact'
  | 'voice_dubbing'
  | 'caption_translation';

export const ENHANCEMENTS: EnhancementMeta[] = [
  { id: 'motion_graphics', group: 'creative', name: 'Motion graphics', description: 'Animated keyword callouts and a progress bar.', tier: 'premium', creditsPerMinute: 6, beta: true, available: true },
  { id: 'ai_emojis', group: 'creative', name: 'AI Emojis', description: 'Emojis pop in on emotional and key moments.', tier: 'free', creditsPerMinute: 0, beta: true, available: true },
  { id: 'speech_cleanup', group: 'sound', name: 'Speech cleanup', description: 'Cuts long pauses and filler words like um and uh.', tier: 'premium', creditsPerMinute: 0, available: true },
  { id: 'enhance_audio', group: 'sound', name: 'Enhance audio', description: 'Less background noise, clearer speech, even volume.', tier: 'premium', creditsPerMinute: 6, available: true },
  { id: 'auto_sfx', group: 'sound', name: 'Auto SFX', description: 'Sound effects on cuts, zooms and punchlines.', tier: 'premium', creditsPerMinute: 7, available: true },
  { id: 'auto_zoom', group: 'look', name: 'Auto Zoom', description: 'Smooth punch-in zooms on emphasised moments.', tier: 'premium', creditsPerMinute: 0, available: true },
  { id: 'transitions', group: 'look', name: 'Auto transitions', description: 'Transitions where clip parts join (hook, intro, outro).', tier: 'premium', creditsPerMinute: 0, available: true },
  { id: 'color_correction', group: 'look', name: 'Auto Color Correction', description: 'Balanced exposure, contrast, saturation and white balance.', tier: 'premium', creditsPerMinute: 0, available: true },
  { id: 'eye_contact', group: 'look', name: 'Eye Contact Correction', description: 'Redirects the speaker’s gaze to the camera.', tier: 'premium', creditsPerMinute: 0, available: false },
  { id: 'voice_dubbing', group: 'translate', name: 'Voice dubbing', description: 'Translated AI voice over the original background audio.', tier: 'premium', creditsPerMinute: 10, available: true },
  { id: 'caption_translation', group: 'translate', name: 'Caption translation', description: 'Captions and subtitles in another language.', tier: 'free', creditsPerMinute: 0, available: true },
];

export const enhancement = (id: string) => ENHANCEMENTS.find((e) => e.id === id);

export function enhancementAllowed(access: EnhancementAccess, e: EnhancementMeta): boolean {
  return e.available && (e.tier === 'free' || access === 'all');
}

/** Languages the renderer has fonts for (Latin, Devanagari, Arabic). */
export const TRANSLATE_LANGUAGES = ['en', 'hi', 'es', 'fr', 'de', 'pt', 'it', 'ar', 'id', 'nl', 'tr'] as const;

/**
 * Up-front charge for enhancements: every clip billed at the longest length
 * the user allowed, rounded up to whole minutes. The worker refunds the
 * difference once real clip lengths are known.
 */
export function estimateEnhancementCredits(ids: EnhancementId[], clipCount: number, maxClipSeconds: number): { perMinute: number; credits: number } {
  const perMinute = ids.reduce((sum, id) => sum + (enhancement(id)?.creditsPerMinute ?? 0), 0);
  const minutesPerClip = Math.max(1, Math.ceil(maxClipSeconds / 60));
  return { perMinute, credits: perMinute * minutesPerClip * clipCount };
}

/** What the clips really cost: each clip's started minutes × rate. */
export function settleEnhancementCredits(perMinute: number, clipSeconds: number[]): number {
  return clipSeconds.reduce((sum, s) => sum + perMinute * Math.max(1, Math.ceil(s / 60)), 0);
}
