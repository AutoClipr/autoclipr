/**
 * AI Hook & Headline template registry: the source of truth for which
 * templates exist, who may use them and what they cost. The worker holds the
 * matching render specs (apps/workers/src/pipeline/hooks.ts) and the web app
 * fetches this list from GET /videos/hook-templates, so a new template is an
 * entry here plus a render spec there.
 */
export type HookKind = 'viral' | 'headline';
/** basic: Creator and up. premium: plans with full hook access (Pro, Business). */
export type HookTier = 'basic' | 'premium';
export type HookAccess = 'none' | 'basic' | 'all';

export interface HookTemplateMeta {
  id: string;
  kind: HookKind;
  name: string;
  description: string;
  tier: HookTier;
  /** Credits per clip on top of the normal clip cost. */
  credits: number;
  /** Default on-screen seconds (user may pick 1–5). */
  defaultSeconds: number;
  ratios: string[];
  /** Sound effect played with the hook ('none' when silent). */
  sfx: 'whoosh' | 'pop' | 'riser' | 'hit' | 'none';
}

const ALL = ['9:16', '16:9', '1:1', '4:5'];
const VIRAL_CREDITS = 2;
const HEADLINE_CREDITS = 1;

const viral = (id: string, name: string, description: string, tier: HookTier, sfx: HookTemplateMeta['sfx'], defaultSeconds = 2.5): HookTemplateMeta => ({
  id, kind: 'viral', name, description, tier, credits: VIRAL_CREDITS, defaultSeconds, ratios: ALL, sfx,
});
const headline = (id: string, name: string, description: string): HookTemplateMeta => ({
  id, kind: 'headline', name, description, tier: 'basic', credits: HEADLINE_CREDITS, defaultSeconds: 3, ratios: ALL, sfx: 'none',
});

export const HOOK_TEMPLATES: HookTemplateMeta[] = [
  viral('montage', 'Montage', 'Quick cuts from your clip with words landing one by one.', 'basic', 'whoosh'),
  viral('cutaway', 'Cutaway', 'Clean white card with a bold line, then cut to the video.', 'basic', 'pop'),
  viral('halo', 'Halo', 'Huge glowing headline word over the speaker.', 'basic', 'riser'),
  viral('condensed_italic', 'Condensed Italic', 'Tall condensed italic type that snaps in.', 'basic', 'whoosh'),
  viral('cadence', 'Cadence', 'Words appear on the beat, centred and bold.', 'basic', 'pop'),
  viral('hero', 'Hero', 'Big script word with a bold line underneath.', 'basic', 'hit'),
  viral('highlighter', 'Highlighter', 'Marker sweep behind the key phrase.', 'basic', 'whoosh'),
  viral('match_cut', 'Match Cut', 'Fast flashes from your own clip in sync with the text.', 'premium', 'hit'),
  viral('neon', 'Neon', 'Flickering neon sign lettering.', 'premium', 'riser'),
  viral('script_editorial', 'Script Editorial', 'Magazine-style serif with a handwritten accent.', 'premium', 'whoosh'),
  viral('polaroid_tilt', 'Polaroid Tilt', 'Tilted white card that drops in like a photo.', 'premium', 'pop'),
  viral('depth', 'Depth', 'Layered 3D extruded lettering.', 'premium', 'hit'),
  viral('interrupt', 'Interrupt', 'Full-screen colour card that breaks the scroll.', 'premium', 'hit', 1.5),
  viral('scribble', 'Scribble', 'Hand-drawn underline scribbles in under the text.', 'premium', 'pop'),
  viral('brush', 'Brush', 'Paint-stroke band wipes in behind bold caps.', 'premium', 'whoosh'),
  viral('glass', 'Glass', 'Frosted glass panel with soft white text.', 'premium', 'riser'),
  viral('comic', 'Comic', 'Comic-book burst with a tilted caption box.', 'premium', 'pop'),
  viral('split', 'Split', 'Video on top, bold text panel underneath.', 'premium', 'whoosh'),
  viral('numbered_list', 'Numbered List', '"Top 3" style with a big accent number.', 'premium', 'hit'),
  headline('editorial', 'Editorial', 'Elegant serif title with an accent word.'),
  headline('statement', 'Statement', 'Small kicker line over a bold statement.'),
  headline('sunset', 'Sunset', 'White caps on a bright pink label.'),
  headline('classic', 'Classic', 'Black caps on a clean white label.'),
];

export const HOOK_TEMPLATE_IDS = HOOK_TEMPLATES.map((t) => t.id);
export const hookTemplate = (id: string | undefined) => HOOK_TEMPLATES.find((t) => t.id === id);

/** Whether a plan's hook access covers a template. */
export function hookAllowed(access: HookAccess, t: HookTemplateMeta): boolean {
  if (access === 'all') return true;
  if (access === 'basic') return t.tier === 'basic';
  return false;
}

export const HOOK_FONTS = [
  'Montserrat',
  'Montserrat ExtraBold',
  'Montserrat Black',
  'DejaVu Sans',
  'EB Garamond',
  'Pacifico',
] as const;
