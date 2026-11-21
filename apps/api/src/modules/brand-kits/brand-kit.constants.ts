/**
 * Brand kit options the renderer supports. Fonts are the ones installed in the
 * worker image (apps/workers/Dockerfile) — anything else would silently fall
 * back to a default font in libass.
 */
export const BRAND_FONTS = [
  'Montserrat',
  'Montserrat SemiBold',
  'Montserrat ExtraBold',
  'Montserrat Black',
  'DejaVu Sans',
  'DejaVu Serif',
  'EB Garamond',
  'Pacifico',
] as const;

/** Caption presets; each maps to an existing caption engine style. */
export const BRAND_CAPTION_PRESETS = {
  classic_white: 'minimal',
  bold_highlight: 'viral',
  modern_minimal: 'editorial',
  word_highlight: 'marker',
  creator_style: 'punch',
  neon_highlight: 'neon',
  karaoke_style: 'karaoke',
  clean_subtitle: 'sticker',
} as const;
export type BrandCaptionPreset = keyof typeof BRAND_CAPTION_PRESETS;

export const LOGO_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export const CAPTION_POSITIONS = ['top', 'middle', 'bottom'] as const;
export const ALIGNMENTS = ['left', 'center', 'right'] as const;

export const ASSET_KINDS = {
  logo: { mimes: ['image/png', 'image/jpeg'], maxBytes: 5 * 1024 * 1024, ext: { 'image/png': 'png', 'image/jpeg': 'jpg' } },
  intro: { mimes: ['video/mp4', 'video/quicktime', 'video/webm'], maxBytes: 100 * 1024 * 1024, ext: { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' } },
  outro: { mimes: ['video/mp4', 'video/quicktime', 'video/webm'], maxBytes: 100 * 1024 * 1024, ext: { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' } },
} as const;
export type AssetKind = keyof typeof ASSET_KINDS;

/** Intro/outro longer than this are trimmed by the worker. */
export const MAX_BUMPER_SECONDS = 15;

export const DEFAULT_COLORS = {
  primary: '#54D045',
  secondary: '#101828',
  accent: '#00D6A0',
  background: '#050817',
  text: '#FFFFFF',
};

export const brandAssetPrefix = (userId: string) => `${userId}/brand-kits/`;

/**
 * Built-in templates every paid user can pick without creating a kit. Same
 * shape as a kit's look (no logo/intro/outro). Ids are prefixed "preset:".
 */
export const BRAND_PRESET_TEMPLATES = [
  {
    id: 'preset:bold-green',
    name: 'Bold Green',
    colors: { primary: '#54D045', secondary: '#101828', accent: '#00D6A0', background: '#050817', text: '#FFFFFF' },
    captions: { preset: 'bold_highlight', font: 'Montserrat Black', size: 78, color: '#FFFFFF', highlight_color: '#54D045', outline: 6, shadow: 2, position: 'bottom', alignment: 'center', max_words: 3 },
  },
  {
    id: 'preset:neon-pop',
    name: 'Neon Pop',
    colors: { primary: '#35D6E8', secondary: '#1B1035', accent: '#FF3B9A', background: '#0B0620', text: '#FFFFFF' },
    captions: { preset: 'neon_highlight', font: 'Montserrat ExtraBold', size: 74, color: '#FFFFFF', highlight_color: '#FF3B9A', outline: 4, shadow: 4, position: 'middle', alignment: 'center', max_words: 2 },
  },
  {
    id: 'preset:clean-white',
    name: 'Clean White',
    colors: { primary: '#FFFFFF', secondary: '#111111', accent: '#FFFFFF', background: '#000000', text: '#FFFFFF' },
    captions: { preset: 'clean_subtitle', font: 'Montserrat SemiBold', size: 60, color: '#FFFFFF', highlight_color: '#FFFFFF', background: true, background_color: '#000000', outline: 0, shadow: 0, position: 'bottom', alignment: 'center', max_words: 6 },
  },
  {
    id: 'preset:sunset-karaoke',
    name: 'Sunset Karaoke',
    colors: { primary: '#FF9418', secondary: '#2A1405', accent: '#FFD400', background: '#120802', text: '#FFFFFF' },
    captions: { preset: 'karaoke_style', font: 'Montserrat Black', size: 72, color: '#FFFFFF', highlight_color: '#FFD400', outline: 5, shadow: 1, position: 'bottom', alignment: 'center', max_words: 4 },
  },
] as const;
