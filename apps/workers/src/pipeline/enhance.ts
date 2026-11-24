/**
 * AI video enhancements: pure planning helpers (no I/O). The pipeline turns
 * these into FFmpeg filters, ASS overlays and audio mixes on the existing
 * render path; nothing here runs a separate pipeline.
 *
 * Settings come from the API (apps/api/src/common/enhancements.ts), which
 * validates plan access and charges per minute.
 */
import type { TranscriptSegment, TranscriptWord } from './types';
import { assColor, assTimeOf, cleanHookText, playResY } from './hooks';

export type Enhancements = {
  motion_graphics?: { progress_bar?: boolean; keywords?: boolean; color?: string };
  ai_emojis?: { density?: 'low' | 'medium' | 'high'; position?: 'above' | 'corner' };
  speech_cleanup?: { pauses?: boolean; fillers?: boolean; max_pause?: number };
  enhance_audio?: { noise?: 'light' | 'strong' };
  auto_sfx?: { intensity?: 'subtle' | 'normal' | 'bold'; volume?: number };
  auto_zoom?: { strength?: 'subtle' | 'medium' | 'strong' };
  transitions?: { style?: 'fade' | 'slide' | 'zoom' | 'wipe'; duration?: number };
  color_correction?: { preset?: 'natural' | 'vibrant' | 'warm' | 'cool' };
  voice_dubbing?: { language: string };
  caption_translation?: { language: string };
};

/** Features billed per minute (must match the API registry). */
export const PER_MINUTE: Partial<Record<keyof Enhancements, number>> = {
  motion_graphics: 6,
  enhance_audio: 6,
  auto_sfx: 7,
  voice_dubbing: 10,
};

/* ─── Speech cleanup ─────────────────────────────────────────────────── */

const FILLERS = /^(u+m+|u+h+|uhm+|e+r+m*|a+h+|hmm+|mm+|er)$/i;
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

export type Interval = [number, number];

/** Words inside [start, end) seconds, ordered (from word timings or whole segments). */
export function wordsIn(segments: TranscriptSegment[], start: number, end: number): TranscriptWord[] {
  const out: TranscriptWord[] = [];
  for (const s of segments) {
    if (s.end <= start || s.start >= end) continue;
    if (s.words?.length) out.push(...s.words.filter((w) => w.end > start && w.start < end));
    else out.push({ start: s.start, end: s.end, word: s.text });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Parts of [start, end] to keep: filler words and immediate repeats are cut,
 * pauses longer than maxPause shrink to a natural 0.25 s. Returns clip-relative
 * intervals; one interval covering everything means "nothing to cut".
 */
export function cleanupIntervals(
  words: TranscriptWord[],
  start: number,
  end: number,
  opts: { pauses?: boolean; fillers?: boolean; max_pause?: number },
): { keep: Interval[]; removedFillers: number; removedPauses: number } {
  const maxPause = opts.max_pause ?? 0.6;
  const cut: Interval[] = [];
  let removedFillers = 0;
  let removedPauses = 0;
  const fillers = opts.fillers !== false;
  const pauses = opts.pauses !== false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const n = norm(w.word);
    const prev = i > 0 ? norm(words[i - 1].word) : null;
    if (fillers && (FILLERS.test(n) || (n.length > 1 && n === prev && w.start - words[i - 1].end < 0.4))) {
      cut.push([w.start, w.end]);
      removedFillers++;
    }
  }
  if (pauses) {
    let lastEnd = start;
    for (const w of [...words, { start: end, end, word: '' }]) {
      const gap = w.start - lastEnd;
      if (gap > maxPause) {
        // Keep 0.125 s of air on each side.
        cut.push([lastEnd + 0.125, w.start - 0.125]);
        removedPauses++;
      }
      lastEnd = Math.max(lastEnd, w.end);
    }
  }
  // Merge cuts and invert to keep-intervals, clip-relative.
  const merged = cut
    .map(([a, b]) => [Math.max(start, a), Math.min(end, b)] as Interval)
    .filter(([a, b]) => b - a > 0.05)
    .sort((a, b) => a[0] - b[0])
    .reduce<Interval[]>((acc, c) => {
      const last = acc[acc.length - 1];
      if (last && c[0] <= last[1] + 0.02) last[1] = Math.max(last[1], c[1]);
      else acc.push([...c]);
      return acc;
    }, []);
  const keep: Interval[] = [];
  let t = start;
  for (const [a, b] of merged) {
    if (a - t > 0.08) keep.push([t - start, a - start]);
    t = b;
  }
  if (end - t > 0.08) keep.push([t - start, end - start]);
  return { keep: keep.length ? keep : [[0, end - start]], removedFillers, removedPauses };
}

/** Map a clip-relative time onto the cleaned timeline (null when cut). */
export function remapTime(t: number, keep: Interval[]): number | null {
  let offset = 0;
  for (const [a, b] of keep) {
    if (t < a) return null;
    if (t <= b) return offset + (t - a);
    offset += b - a;
  }
  return null;
}

export const keptDuration = (keep: Interval[]) => keep.reduce((s, [a, b]) => s + (b - a), 0);

/**
 * Transcript re-timed onto the cleaned clip (clip-relative seconds, starting
 * at 0). Removed words disappear; a segment with no words left is dropped.
 */
export function remapSegments(segments: TranscriptSegment[], clipStart: number, clipEnd: number, keep: Interval[]): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  for (const s of segments) {
    if (s.end <= clipStart || s.start >= clipEnd) continue;
    const words = (s.words?.length ? s.words : [{ start: s.start, end: s.end, word: s.text }])
      .map((w) => {
        const a = remapTime(Math.max(0, w.start - clipStart), keep);
        const b = remapTime(Math.min(clipEnd - clipStart, w.end - clipStart), keep);
        return a == null || b == null || b <= a ? null : { word: w.word, start: a, end: b };
      })
      .filter((w): w is TranscriptWord => !!w);
    if (!words.length) continue;
    out.push({ start: words[0].start, end: words[words.length - 1].end, text: words.map((w) => w.word.trim()).join(' '), words: s.words?.length ? words : undefined });
  }
  return out;
}

/** A translated segment gets evenly spaced word timings for animated captions. */
export function spreadWords(seg: TranscriptSegment): TranscriptSegment {
  const parts = seg.text.split(/\s+/).filter(Boolean);
  const step = (seg.end - seg.start) / Math.max(1, parts.length);
  return { ...seg, words: parts.map((word, i) => ({ word, start: seg.start + i * step, end: seg.start + (i + 1) * step })) };
}

/* ─── Look ────────────────────────────────────────────────────────────── */

/** Exposure/white balance via temporal auto-levels, then a preset grade. */
export function colorFilter(preset: NonNullable<Enhancements['color_correction']>['preset'] = 'natural'): string {
  const levels = 'normalize=blackpt=black:whitept=white:smoothing=24:independence=0.5:strength=0.45';
  switch (preset) {
    case 'vibrant':
      return `${levels},eq=contrast=1.1:saturation=1.3:gamma=1.02`;
    case 'warm':
      return `${levels},eq=contrast=1.05:saturation=1.1,colorbalance=rs=0.06:gs=0.01:bs=-0.06:rm=0.04:bm=-0.04`;
    case 'cool':
      return `${levels},eq=contrast=1.05:saturation=1.05,colorbalance=rs=-0.05:bs=0.06:rm=-0.03:bm=0.04`;
    default:
      return `${levels},eq=contrast=1.05:saturation=1.08:gamma=1.01`;
  }
}

/** Moments worth emphasising: numbers, exclamations, questions, stressed words, ≥ minGap apart. */
export function emphasisTimes(words: TranscriptWord[], duration: number, minGap = 3.5): number[] {
  const scored = words
    .map((w, i) => {
      const raw = w.word.trim();
      let score = 0;
      if (/\d/.test(raw)) score += 3;
      if (/[!?]$/.test(raw)) score += 2;
      if (raw.length > 2 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) score += 2;
      if (/^(never|always|secret|best|worst|biggest|only|must|stop|why|how|nobody|everyone|crazy|insane)$/i.test(norm(raw))) score += 2;
      if (i > 0 && w.start - words[i - 1].end > 0.45) score += 1;
      if (norm(raw).length >= 8) score += 1;
      return { t: w.start, score };
    })
    .filter((x) => x.score >= 2 && x.t > 0.8 && x.t < duration - 1)
    .sort((a, b) => b.score - a.score);
  const picked: number[] = [];
  for (const c of scored) if (picked.every((p) => Math.abs(p - c.t) >= minGap)) picked.push(c.t);
  // Steady rhythm when the speech has few strong moments.
  if (picked.length < Math.floor(duration / 8)) {
    for (let t = 2.5; t < duration - 1.5; t += 6) if (picked.every((p) => Math.abs(p - t) >= minGap)) picked.push(t);
  }
  return picked.sort((a, b) => a - b).slice(0, 24);
}

/**
 * Smooth punch-in zooms at the given times (0.25 s in, hold ~1.4 s, 0.35 s out),
 * centred slightly above the middle where faces usually are.
 */
export function zoomFilter(times: number[], W: number, H: number, strength: NonNullable<Enhancements['auto_zoom']>['strength'] = 'medium'): string | null {
  if (!times.length) return null;
  const amount = strength === 'subtle' ? 0.08 : strength === 'strong' ? 0.22 : 0.14;
  const t = '(in/30)';
  const bump = (a: number) => {
    const b = a + 1.65;
    return `clip(min((${t}-${a.toFixed(2)})/0.25,(${b.toFixed(2)}-${t})/0.35),0,1)`;
  };
  const z = times.map(bump).reduce((acc, x) => (acc ? `max(${acc},${x})` : x), '');
  return `fps=30,zoompan=z='1+${amount}*${z}':x='iw/2-(iw/zoom/2)':y='ih*0.42-(ih/zoom*0.42)':d=1:s=${W}x${H}:fps=30`;
}

/* ─── Sound ───────────────────────────────────────────────────────────── */

export function audioCleanFilter(noise: NonNullable<Enhancements['enhance_audio']>['noise'] = 'light'): string {
  const nr = noise === 'strong' ? 22 : 12;
  return `highpass=f=80,lowpass=f=14000,afftdn=nr=${nr}:nf=-35:tn=1,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2,loudnorm=I=-14:TP=-1.5:LRA=11`;
}

export type SfxEvent = { t: number; kind: 'whoosh' | 'pop' | 'riser' | 'hit' };

/** Sound effects for the clip's visual events, by intensity. */
export function sfxEvents(
  opts: NonNullable<Enhancements['auto_sfx']>,
  ev: { zooms: number[]; keywords: number[]; cuts: number[]; emojis: number[]; punchlines: number[] },
): SfxEvent[] {
  const level = opts.intensity ?? 'normal';
  const out: SfxEvent[] = [
    ...ev.zooms.map((t) => ({ t, kind: 'whoosh' as const })),
    ...ev.keywords.map((t) => ({ t, kind: 'pop' as const })),
    ...ev.emojis.map((t) => ({ t, kind: 'pop' as const })),
  ];
  if (level !== 'subtle') out.push(...ev.cuts.slice(0, 12).map((t) => ({ t, kind: 'whoosh' as const })));
  if (level === 'bold') out.push(...ev.punchlines.map((t) => ({ t, kind: 'hit' as const })));
  // At most one effect per 0.6 s.
  return out.sort((a, b) => a.t - b.t).filter((e, i, arr) => i === 0 || e.t - arr[i - 1].t >= 0.6).slice(0, 30);
}

/* ─── Overlays (ASS, merged into the caption file) ───────────────────── */

const EMOJI_RULES: [RegExp, string][] = [
  [/\b(love|heart|lovely)\b/i, '❤️'], [/\b(laugh|funny|joke|lol|haha)\b/i, '😂'], [/\b(fire|hot|insane|crazy|wild)\b/i, '🔥'],
  [/\b(money|rich|dollar|cash|paid|price|salary)\b/i, '💰'], [/\b(idea|think|smart|learn|lesson)\b/i, '💡'], [/\b(win|best|top|number one|champion)\b/i, '🏆'],
  [/\b(sad|cry|lost|miss)\b/i, '😢'], [/\b(wow|amazing|incredible|unbelievable)\b/i, '🤯'], [/\b(fast|quick|speed|rocket|grow|growth)\b/i, '🚀'],
  [/\b(time|minute|hour|clock|late)\b/i, '⏰'], [/\b(eat|food|delicious|hungry)\b/i, '😋'], [/\b(music|song|sing|dance)\b/i, '🎵'],
  [/\b(work|job|business|company)\b/i, '💼'], [/\b(yes|agree|right|correct|exactly)\b/i, '👍'], [/\b(no|wrong|never|stop)\b/i, '🚫'],
  [/\?$/, '🤔'], [/!$/, '😮'],
];
/** Fallback symbols libass can draw (DejaVu Sans) when colour emoji images aren't available. */
export const EMOJI_SYMBOL: Record<string, [string, string]> = {
  '❤️': ['♥', '#FF5A5A'], '😂': ['☺', '#FFE100'], '🔥': ['⚡', '#FFC800'], '💰': ['$', '#3DDC84'], '💡': ['★', '#FFE100'], '🏆': ['★', '#FFC800'],
  '😢': ['☹', '#7DB7FF'], '🤯': ['✸', '#FF8A3D'], '🚀': ['➚', '#FF8A3D'], '⏰': ['◷', '#FFFFFF'], '😋': ['☺', '#FFB000'], '🎵': ['♫', '#B388FF'],
  '💼': ['■', '#C69C6D'], '👍': ['✔', '#54D045'], '🚫': ['✖', '#FF4D4D'], '🤔': ['?', '#35D6E8'], '😮': ['!', '#FFC800'],
};

export type EmojiEvent = { t: number; end: number; emoji: string };

/** Emotional / key moments → emojis, limited by density. */
export function pickEmojis(segments: TranscriptSegment[], duration: number, density: NonNullable<Enhancements['ai_emojis']>['density'] = 'medium'): EmojiEvent[] {
  const per10 = density === 'low' ? 1 : density === 'high' ? 3 : 2;
  const minGap = 10 / per10;
  const out: EmojiEvent[] = [];
  for (const s of segments) {
    const words = s.words?.length ? s.words : [{ start: s.start, end: s.end, word: s.text }];
    for (const w of words) {
      const text = w.word.trim();
      const rule = EMOJI_RULES.find(([re]) => re.test(text));
      if (!rule) continue;
      const t = Math.max(0, w.start);
      if (t > duration - 0.6 || (out.length && t - out[out.length - 1].t < minGap)) continue;
      out.push({ t, end: Math.min(duration, t + 1.4), emoji: rule[1] });
    }
  }
  return out;
}

/** Keyword callouts: the strongest word near each emphasis time. */
export function pickKeywords(words: TranscriptWord[], times: number[]): { t: number; word: string }[] {
  return times
    .map((t) => {
      const near = words.filter((w) => Math.abs(w.start - t) < 1.2);
      const best = near.sort((a, b) => norm(b.word).length - norm(a.word).length)[0];
      const word = cleanHookText(best?.word ?? '').replace(/[.,!?;:]+$/, '');
      return word.length >= 3 ? { t, word } : null;
    })
    .filter((x): x is { t: number; word: string } => !!x);
}

/** ASS document with motion graphics and (fallback) emoji symbols. */
export function overlayAss(
  W: number,
  H: number,
  duration: number,
  o: {
    progressBar?: { color: string };
    keywords?: { t: number; word: string }[];
    keywordColor?: string;
    emojiSymbols?: EmojiEvent[];
    emojiPosition?: 'above' | 'corner';
    startAfter?: number;
  },
): string | null {
  const playY = playResY(W, H);
  const ev: string[] = [];
  const dlg = (layer: number, a: number, b: number, tags: string, body: string) =>
    ev.push(`Dialogue: ${layer},${assTimeOf(a)},${assTimeOf(b)},Fx,,0,0,0,,{${tags}}${body}`);
  if (o.progressBar) {
    const ms = Math.round(duration * 1000);
    dlg(20, 0, duration, `\\an7\\pos(0,${playY - 14})\\p1\\bord0\\shad0\\1c${assColor(o.progressBar.color)}\\clip(0,0,0,${playY})\\t(0,${ms},\\clip(0,0,1080,${playY}))`, `m 0 0 l 1080 0 l 1080 14 l 0 14{\\p0}`);
  }
  const after = o.startAfter ?? 0;
  for (const k of o.keywords ?? []) {
    if (k.t < after) continue;
    const y = Math.round(playY * 0.58);
    dlg(21, k.t, Math.min(duration, k.t + 1.3),
      `\\an5\\pos(540,${y})\\fnMontserrat Black\\fs${Math.round(64 * Math.min(1, playY / 1600) + 8)}\\bord14\\3c${assColor(o.keywordColor ?? '#54D045')}\\c&H111111&\\shad0\\fscx30\\fscy30\\t(0,140,\\fscx108\\fscy108)\\t(140,220,\\fscx100\\fscy100)\\fad(0,180)`,
      k.word.toUpperCase());
  }
  for (const e of o.emojiSymbols ?? []) {
    const [sym, color] = EMOJI_SYMBOL[e.emoji] ?? ['★', '#FFE100'];
    const pos = o.emojiPosition === 'corner' ? `\\an9\\pos(1020,${Math.round(playY * 0.1)})` : `\\an5\\pos(540,${Math.round(playY * 0.62)})`;
    dlg(22, e.t, e.end, `${pos}\\fnDejaVu Sans\\fs110\\c${assColor(color)}\\bord4\\3c&H000000&\\shad2\\fscx20\\fscy20\\t(0,160,\\fscx115\\fscy115)\\t(160,240,\\fscx100\\fscy100)\\fad(0,200)`, sym);
  }
  if (!ev.length) return null;
  const head = [
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', `PlayResY: ${playY}`, 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Fx,Montserrat Black,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,3,10,0,5,40,40,0,1', '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  return [...head, ...ev, ''].join('\n');
}

/** Merge every style and event of `doc` into `captions` (both on the same canvas). */
export function mergeAssDoc(captions: string, doc: string): string {
  const styles = doc.split('\n').filter((l) => l.startsWith('Style:'));
  const events = doc.split('\n').filter((l) => l.startsWith('Dialogue:'));
  const lines = captions.split('\n');
  const evIdx = lines.findIndex((l) => l.trim() === '[Events]');
  let styleIdx = -1;
  for (let i = 0; i < evIdx; i++) if (lines[i].startsWith('Style:')) styleIdx = i;
  if (evIdx < 0 || styleIdx < 0) return captions;
  lines.splice(styleIdx + 1, 0, ...styles);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return [...lines, ...events, ''].join('\n');
}

/* ─── Transitions ─────────────────────────────────────────────────────── */

export const XFADE: Record<NonNullable<NonNullable<Enhancements['transitions']>['style']>, string> = {
  fade: 'fade',
  slide: 'slideleft',
  zoom: 'zoomin',
  wipe: 'wipeleft',
};

/** Billable minutes for one clip and the per-minute features that ran. */
export function clipCharge(seconds: number, features: (keyof Enhancements)[]): number {
  const rate = features.reduce((s, f) => s + (PER_MINUTE[f] ?? 0), 0);
  return rate * Math.max(1, Math.ceil(seconds / 60));
}
