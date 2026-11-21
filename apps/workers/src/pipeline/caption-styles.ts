/**
 * Caption engine: turns transcript words into an ASS subtitle file with
 * per-style fonts, colours and word-level animation (highlight, karaoke
 * sweep, typewriter reveal, one-word pop). Pure functions so they can be
 * unit-tested without ffmpeg.
 *
 * Colours are ASS "&HAABBGGRR" (alpha first, then blue, green, red).
 */
import type { TranscriptSegment, TranscriptWord } from './types';

export type CaptionMode =
  /** Whole phrase on screen at once. */
  | 'static'
  /** Whole phrase on screen; the word being spoken changes colour. */
  | 'highlight'
  /** Whole phrase on screen; a colour sweep fills each word as it's spoken. */
  | 'karaoke'
  /** Words appear one after another, typewriter style. */
  | 'reveal'
  /** One word at a time. */
  | 'single';

export type CaptionStyleDef = {
  id: string;
  font: string;
  size: number;
  /** Main text colour. */
  primary: string;
  /** Unsung colour for karaoke. */
  secondary?: string;
  outline: string;
  /** Shadow colour, or box colour when box=true. */
  back: string;
  bold?: boolean;
  italic?: boolean;
  outlineWidth: number;
  shadow: number;
  /** Opaque box behind the text (ASS BorderStyle 3). */
  box?: boolean;
  marginV?: number;
  spacing?: number;
  /** Rotation in degrees (positive = counter-clockwise). */
  angle?: number;
  transform?: 'upper' | 'lower';
  wordsPerChunk: number;
  mode: CaptionMode;
  /** Override tags for the active word in highlight mode. */
  activeTags?: string;
  /** Override tags applied when a chunk first appears (pop, fade…). */
  entrance?: string;
  /** Prefix a matching emoji to each phrase. */
  emoji?: boolean;
  /** Extra tags for the whole line (glow, etc.). */
  lineTags?: string;
};

const WHITE = '&H00FFFFFF';
const BLACK = '&H00000000';
const SOFT_SHADOW = '&H96000000';

const POP = '{\\fscx75\\fscy75\\t(0,110,\\fscx106\\fscy106)\\t(110,170,\\fscx100\\fscy100)}';
const FADE = '{\\fad(160,60)}';
const RISE = '{\\fad(120,0)\\move(540,1500,540,1460,0,160)}';

/** Every style the worker can render. Keep ids in sync with the API DTOs and the web picker. */
export const CAPTION_STYLES: Record<string, CaptionStyleDef> = {
  // Original four, now rendered as previewed.
  viral: {
    id: 'viral',
    font: 'Montserrat Black',
    size: 122,
    primary: WHITE,
    outline: BLACK,
    back: SOFT_SHADOW,
    bold: true,
    outlineWidth: 6,
    shadow: 3,
    transform: 'upper',
    wordsPerChunk: 3,
    mode: 'highlight',
    activeTags: '\\c&H0030E8FF&',
    entrance: POP,
  },
  animated: {
    id: 'animated',
    font: 'Montserrat ExtraBold',
    size: 110,
    primary: WHITE,
    outline: '&H00402010',
    back: SOFT_SHADOW,
    bold: true,
    outlineWidth: 5,
    shadow: 2,
    wordsPerChunk: 3,
    mode: 'highlight',
    activeTags: '\\c&H00D6D635&\\fscx112\\fscy112',
    entrance: POP,
  },
  emoji: {
    id: 'emoji',
    font: 'Montserrat',
    size: 104,
    primary: WHITE,
    outline: BLACK,
    back: SOFT_SHADOW,
    bold: true,
    outlineWidth: 5,
    shadow: 2,
    wordsPerChunk: 4,
    mode: 'static',
    emoji: true,
    entrance: FADE,
  },
  karaoke: {
    id: 'karaoke',
    font: 'Montserrat Black',
    size: 116,
    primary: '&H00F65C8B',
    secondary: '&H00FFFFFF',
    outline: BLACK,
    back: SOFT_SHADOW,
    bold: true,
    outlineWidth: 6,
    shadow: 2,
    transform: 'upper',
    wordsPerChunk: 4,
    mode: 'karaoke',
  },

  // New styles.
  marker: {
    id: 'marker',
    font: 'Montserrat Black',
    size: 116,
    primary: WHITE,
    outline: BLACK,
    back: SOFT_SHADOW,
    bold: true,
    outlineWidth: 5,
    shadow: 0,
    transform: 'upper',
    wordsPerChunk: 3,
    mode: 'highlight',
    // Thick purple border behind the spoken word reads as a marker swipe.
    activeTags: '\\3c&H00F65C8B&\\bord16',
    entrance: FADE,
  },
  typewriter: {
    id: 'typewriter',
    font: 'DejaVu Sans Mono',
    size: 87,
    primary: WHITE,
    outline: BLACK,
    back: '&H64000000',
    bold: false,
    outlineWidth: 3,
    shadow: 0,
    wordsPerChunk: 5,
    mode: 'reveal',
  },
  punch: {
    id: 'punch',
    font: 'Montserrat Black',
    size: 174,
    primary: '&H0000D7FF',
    outline: BLACK,
    back: SOFT_SHADOW,
    bold: true,
    outlineWidth: 8,
    shadow: 4,
    transform: 'upper',
    wordsPerChunk: 1,
    mode: 'single',
    entrance: POP,
  },
  lime: {
    id: 'lime',
    font: 'Montserrat Black',
    size: 128,
    primary: WHITE,
    outline: BLACK,
    back: SOFT_SHADOW,
    bold: true,
    outlineWidth: 6,
    shadow: 3,
    transform: 'upper',
    wordsPerChunk: 2,
    mode: 'highlight',
    activeTags: '\\c&H0045D054&',
    entrance: POP,
  },
  neon: {
    id: 'neon',
    font: 'Montserrat ExtraBold',
    size: 110,
    primary: '&H00FFE6FF',
    outline: '&H00D21EFF',
    back: '&H00000000',
    bold: true,
    outlineWidth: 4,
    shadow: 0,
    transform: 'upper',
    wordsPerChunk: 3,
    mode: 'static',
    lineTags: '\\blur4',
    entrance: FADE,
  },
  sticker: {
    id: 'sticker',
    font: 'Montserrat ExtraBold',
    size: 96,
    primary: '&H00111111',
    outline: WHITE,
    back: WHITE,
    bold: true,
    outlineWidth: 14,
    shadow: 0,
    box: true,
    angle: 2,
    wordsPerChunk: 3,
    mode: 'static',
    entrance: POP,
  },
  comic: {
    id: 'comic',
    font: 'Montserrat Black',
    size: 113,
    primary: '&H0000E1FF',
    outline: BLACK,
    back: BLACK,
    bold: true,
    outlineWidth: 7,
    shadow: 5,
    transform: 'upper',
    angle: -3,
    wordsPerChunk: 3,
    mode: 'static',
    entrance: POP,
  },
  retro: {
    id: 'retro',
    font: 'Montserrat Black',
    size: 116,
    primary: '&H0000C8FF',
    outline: '&H000040C0',
    back: '&H000020A0',
    bold: true,
    outlineWidth: 4,
    shadow: 6,
    transform: 'upper',
    wordsPerChunk: 3,
    mode: 'static',
    entrance: FADE,
  },
  editorial: {
    id: 'editorial',
    font: 'EB Garamond',
    size: 113,
    primary: WHITE,
    outline: BLACK,
    back: SOFT_SHADOW,
    italic: true,
    outlineWidth: 2,
    shadow: 3,
    transform: 'lower',
    wordsPerChunk: 4,
    mode: 'highlight',
    activeTags: '\\c&H0070C8F0&',
    entrance: FADE,
  },
  handwritten: {
    id: 'handwritten',
    font: 'Pacifico',
    size: 102,
    primary: WHITE,
    outline: BLACK,
    back: SOFT_SHADOW,
    outlineWidth: 3,
    shadow: 3,
    wordsPerChunk: 4,
    mode: 'highlight',
    activeTags: '\\c&H0022D7FF&',
    entrance: RISE,
  },
  minimal: {
    id: 'minimal',
    font: 'Montserrat SemiBold',
    size: 84,
    primary: WHITE,
    outline: BLACK,
    back: '&H78000000',
    outlineWidth: 0,
    shadow: 2,
    wordsPerChunk: 6,
    mode: 'static',
    entrance: FADE,
  },
};

export const CAPTION_STYLE_IDS = Object.keys(CAPTION_STYLES);

/** Brand kit caption overrides, layered on top of a base style. All optional. */
export type CaptionOverrides = {
  font?: string;
  size?: number;
  /** #RRGGBB */
  color?: string;
  highlight_color?: string;
  background_color?: string;
  /** Opaque box behind the text. */
  background?: boolean;
  outline?: number;
  shadow?: number;
  position?: 'top' | 'middle' | 'bottom';
  alignment?: 'left' | 'center' | 'right';
  max_words?: number;
};

/** "#RRGGBB" → ASS "&HAABBGGRR" (alpha 00 = opaque). Null for anything else. */
export function hexToAss(hex: string | undefined, alpha = '00'): string | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  if (!m) return null;
  return `&H${alpha}${m[3]}${m[2]}${m[1]}`.toUpperCase();
}

/** ASS numpad alignment from vertical position + horizontal alignment. */
function assAlignment(position?: string, align?: string): number {
  const col = align === 'left' ? 1 : align === 'right' ? 3 : 2;
  const row = position === 'top' ? 6 : position === 'middle' ? 3 : 0;
  return col + row;
}

/**
 * Apply brand overrides to a style. Colour overrides recolour the active-word
 * tags too, so highlight styles follow the brand's highlight colour.
 */
export function applyOverrides(base: CaptionStyleDef, o?: CaptionOverrides): CaptionStyleDef & { alignment?: number } {
  if (!o) return base;
  const s: CaptionStyleDef & { alignment?: number } = { ...base };
  if (o.font) s.font = o.font;
  if (typeof o.size === 'number') s.size = o.size;
  const primary = hexToAss(o.color);
  if (primary) {
    s.primary = primary;
    if (s.mode !== 'karaoke') s.secondary = primary;
  }
  const highlight = hexToAss(o.highlight_color);
  if (highlight) {
    if (s.mode === 'karaoke') s.primary = highlight;
    if (s.activeTags) s.activeTags = s.activeTags.replace(/\\1?c&H[0-9A-Fa-f]{6,8}&?/g, `\\c${highlight}&`);
    else if (s.mode === 'highlight') s.activeTags = `\\c${highlight}&`;
  }
  if (typeof o.background === 'boolean') s.box = o.background;
  const back = hexToAss(o.background_color, s.box ? '30' : '96');
  if (back) s.back = back;
  if (typeof o.outline === 'number') s.outlineWidth = o.outline;
  if (typeof o.shadow === 'number') s.shadow = o.shadow;
  if (typeof o.max_words === 'number' && o.max_words > 0) s.wordsPerChunk = Math.round(o.max_words);
  if (o.position || o.alignment) {
    s.alignment = assAlignment(o.position, o.alignment);
    if (o.position === 'top') s.marginV = 260;
    if (o.position === 'middle') s.marginV = 0;
  }
  return s;
}

export function getCaptionStyle(id: string | undefined): CaptionStyleDef {
  return (id && CAPTION_STYLES[id]) || CAPTION_STYLES.viral;
}

/* --------------------------------------------------------------- words */

/** Words for a segment: Whisper timings when present, otherwise spread evenly. */
export function segmentWords(seg: TranscriptSegment): TranscriptWord[] {
  if (seg.words?.length) return seg.words;
  const parts = seg.text.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const span = Math.max(0.2, seg.end - seg.start);
  // Longer words take a bit longer to say.
  const weights = parts.map((w) => Math.max(1, w.length));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = seg.start;
  return parts.map((word, i) => {
    const d = (weights[i] / total) * span;
    const w = { start: t, end: t + d, word };
    t += d;
    return w;
  });
}

/** Words inside the clip window, with times relative to the clip start. */
export function clipWords(segments: TranscriptSegment[], clipStart: number, clipEnd: number): TranscriptWord[] {
  const out: TranscriptWord[] = [];
  for (const seg of segments) {
    if (seg.end <= clipStart || seg.start >= clipEnd) continue;
    for (const w of segmentWords(seg)) {
      if (w.end <= clipStart || w.start >= clipEnd) continue;
      const start = Math.max(0, w.start - clipStart);
      const end = Math.min(clipEnd - clipStart, w.end - clipStart);
      if (end > start) out.push({ start, end, word: w.word });
    }
  }
  return out;
}

/** Group words into on-screen phrases: max N words, split on sentence ends and pauses. */
export function chunkWords(words: TranscriptWord[], max: number): TranscriptWord[][] {
  const chunks: TranscriptWord[][] = [];
  let cur: TranscriptWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = cur[cur.length - 1];
    const pause = prev ? w.start - prev.end > 0.6 : false;
    if (cur.length && (cur.length >= max || pause)) {
      chunks.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?]$/.test(w.word) && cur.length) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/* --------------------------------------------------------------- ASS */

export function assTime(seconds: number): string {
  const cs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

function escapeAss(text: string): string {
  return text.replace(/\\/g, '').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, ' ');
}

function transform(text: string, style: CaptionStyleDef): string {
  if (style.transform === 'upper') return text.toUpperCase();
  if (style.transform === 'lower') return text.toLowerCase();
  return text;
}

/**
 * libass can't draw colour emoji (they come out as empty boxes), so the
 * emoji style uses symbols DejaVu Sans can render, tinted per mood.
 */
const EMOJI_RULES: Array<[RegExp, string, string]> = [
  [/money|\$|rich|pay|price|cash/i, '$', '&H0045D054&'],
  [/love|heart/i, '♥', '&H005A5AFF&'],
  [/fire|hot|crazy|insane/i, '⚡', '&H0000C8FF&'],
  [/laugh|funny|joke|lol/i, '☺', '&H0000E1FF&'],
  [/idea|think|smart|learn/i, '★', '&H0000E1FF&'],
  [/win|best|top|number one/i, '★', '&H0000C8FF&'],
  [/\?/, '?', '&H00D6D635&'],
  [/!/, '⚡', '&H0000C8FF&'],
];

export function emojiFor(text: string, style?: CaptionStyleDef): string {
  // Switch back to the style's own font/colour explicitly; {\r} doesn't restore the font reliably.
  const restore = style ? `{\\fn${style.font}\\c${style.primary.replace(/^&H/, '&H')}&}` : '{\\r}';
  for (const [re, symbol, colour] of EMOJI_RULES) {
    if (re.test(text)) return `{\\fnDejaVu Sans\\c${colour}}${symbol}${restore}`;
  }
  return `{\\fnDejaVu Sans\\c&H0000E1FF&}✦${restore}`;
}

function styleLine(s: CaptionStyleDef & { alignment?: number }): string {
  const bool = (b?: boolean) => (b ? -1 : 0);
  return [
    'Default',
    s.font,
    s.size,
    s.primary,
    s.secondary ?? s.primary,
    s.outline,
    s.back,
    bool(s.bold),
    bool(s.italic),
    0,
    0,
    100,
    100,
    s.spacing ?? 0,
    s.angle ?? 0,
    s.box ? 3 : 1,
    s.outlineWidth,
    s.shadow,
    s.alignment ?? 2,
    80,
    80,
    s.marginV ?? 420,
    1,
  ].join(',');
}

function header(s: CaptionStyleDef): string {
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${styleLine(s)}`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');
}

function dialogue(start: number, end: number, text: string): string {
  return `Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${text}`;
}

/** Build the full ASS document for one clip. */
export function buildAss(
  words: TranscriptWord[],
  styleId: string,
  clipDuration: number,
  overrides?: CaptionOverrides,
): string {
  const style = applyOverrides(getCaptionStyle(styleId), overrides);
  const lines: string[] = [];
  const lead = style.lineTags ? `{${style.lineTags}}` : '';
  const chunks = chunkWords(words, style.wordsPerChunk);

  chunks.forEach((chunk, ci) => {
    const next = chunks[ci + 1];
    const last = chunk[chunk.length - 1];
    // Hold the phrase until the next one starts if the gap is short.
    const end = Math.min(
      clipDuration,
      next && next[0].start - last.end < 0.35 ? next[0].start : last.end + 0.15,
    );
    const start = chunk[0].start;
    const tokens = chunk.map((w) => transform(escapeAss(w.word), style));
    const prefix = style.emoji ? `${emojiFor(chunk.map((w) => w.word).join(' '), style)} ` : '';
    const entrance = style.entrance ?? '';

    switch (style.mode) {
      case 'static':
        lines.push(dialogue(start, end, `${entrance}${lead}${prefix}${tokens.join(' ')}`));
        break;
      case 'karaoke': {
        const parts = chunk.map((w, i) => {
          const until = chunk[i + 1]?.start ?? end;
          const cs = Math.max(1, Math.round((until - w.start) * 100));
          return `{\\kf${cs}}${tokens[i]}`;
        });
        lines.push(dialogue(start, end, `${lead}${parts.join(' ')}`));
        break;
      }
      case 'single':
        chunk.forEach((w, i) => {
          const until = chunk[i + 1]?.start ?? end;
          lines.push(dialogue(w.start, until, `${entrance}${lead}${tokens[i]}`));
        });
        break;
      case 'reveal':
        chunk.forEach((w, i) => {
          const until = chunk[i + 1]?.start ?? end;
          lines.push(dialogue(w.start, until, `${lead}${tokens.slice(0, i + 1).join(' ')}`));
        });
        break;
      case 'highlight':
      default:
        chunk.forEach((w, i) => {
          const until = chunk[i + 1]?.start ?? end;
          const text = tokens
            .map((t, j) => (j === i ? `{${style.activeTags ?? ''}}${t}{\\r}${lead}` : t))
            .join(' ');
          lines.push(dialogue(i === 0 ? start : w.start, until, `${i === 0 ? entrance : ''}${lead}${prefix}${text}`));
        });
        break;
    }
  });

  if (!lines.length) {
    // No speech in this window — leave the clip without captions rather than inventing text.
    return `${header(style)}\n`;
  }
  return `${header(style)}\n${lines.join('\n')}\n`;
}
