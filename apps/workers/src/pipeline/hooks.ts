/**
 * AI Hook & Headline rendering. Every template is a render spec here, keyed
 * by the template id from the API registry (apps/api/src/common/hook-templates.ts).
 *
 * Text and animation are ASS events (libass: \t, \move, \fad, \clip, \blur,
 * vector drawings), burned with the existing caption pass. "Opening" hooks
 * get a short card built by FFmpeg (frozen frame, blur, colour, montage of the
 * clip's own shots, split) and joined in front of the clip; "overlay" hooks
 * are merged into the caption file so they cost no extra encode. Sound effects
 * are synthesised by FFmpeg (no third-party audio).
 */

export type HookConfig = {
  kind: 'viral' | 'headline';
  template_id: string;
  placement: 'opening' | 'overlay';
  duration: number;
  text?: string;
  sfx?: boolean;
  sfx_type?: 'whoosh' | 'pop' | 'riser' | 'hit' | 'none';
  font?: string;
  size?: number;
  color?: string;
  bg_color?: string;
  position?: 'top' | 'middle' | 'bottom';
  animation?: 'none' | 'fade' | 'pop' | 'slide' | 'typewriter';
  background?: 'none' | 'box' | 'pill';
  use_brand?: boolean;
};

type Anim = 'pop' | 'slide' | 'words' | 'fade' | 'zoomblur' | 'flicker' | 'drop' | 'snap' | 'none';
type Extra = 'glow' | 'extrude' | 'underline' | 'scribble' | 'burst' | 'number' | 'kicker' | 'accent';
export type CardBg = 'blur' | 'white' | 'color' | 'frame' | 'montage' | 'flashes' | 'split';

export type HookSpec = {
  font: string;
  size: number;
  color: string;
  accent: string;
  outline: number;
  outlineColor: string;
  shadow: number;
  bold: boolean;
  italic: boolean;
  upper: boolean;
  scaleX: number;
  spacing: number;
  /** Opaque label behind the text (ASS BorderStyle 3). */
  box?: { color: string; pad: number };
  /** Box/brush reveals left→right. */
  sweep?: boolean;
  anim: Anim;
  pos: 'top' | 'middle' | 'bottom';
  tilt: number;
  card: CardBg;
  cardColor: string;
  extra?: Extra;
  accentFont?: string;
  maxChars: number;
};

const S = (o: Partial<HookSpec>): HookSpec => ({
  font: 'Montserrat Black', size: 110, color: '#FFFFFF', accent: '#54D045', outline: 0, outlineColor: '#000000', shadow: 3,
  bold: true, italic: false, upper: false, scaleX: 100, spacing: 0, anim: 'pop', pos: 'middle', tilt: 0,
  card: 'blur', cardColor: '#000000', maxChars: 14, ...o,
});

export const HOOK_SPECS: Record<string, HookSpec> = {
  // ── Viral hooks ────────────────────────────────────────────────────────
  montage: S({ font: 'EB Garamond', size: 120, color: '#111111', shadow: 0, bold: false, anim: 'words', card: 'montage', box: { color: '#FAFAFA', pad: 18 } }),
  cutaway: S({ font: 'Montserrat ExtraBold', size: 96, color: '#111111', shadow: 0, anim: 'slide', card: 'white' }),
  halo: S({ font: 'Montserrat Black', size: 170, color: '#FFE45C', anim: 'zoomblur', pos: 'top', upper: true, extra: 'glow', accent: '#FFD000', maxChars: 9 }),
  condensed_italic: S({ font: 'Montserrat ExtraBold', size: 150, italic: true, scaleX: 72, upper: true, anim: 'snap', outline: 4, maxChars: 12 }),
  cadence: S({ font: 'Montserrat ExtraBold', size: 104, anim: 'words', outline: 5, shadow: 2, pos: 'middle' }),
  hero: S({ font: 'Pacifico', size: 150, color: '#FFE600', bold: false, outline: 6, anim: 'zoomblur', pos: 'top', extra: 'accent', accentFont: 'Montserrat Black', maxChars: 10 }),
  highlighter: S({ font: 'Montserrat ExtraBold', size: 96, color: '#111111', shadow: 0, box: { color: '#FFE600', pad: 14 }, sweep: true, anim: 'fade', card: 'frame' }),
  match_cut: S({ font: 'Montserrat Black', size: 124, upper: true, outline: 6, anim: 'words', card: 'flashes', maxChars: 10 }),
  neon: S({ font: 'Pacifico', size: 140, color: '#FFE6FF', bold: false, accent: '#FF2BD6', anim: 'flicker', extra: 'glow', card: 'blur', maxChars: 12 }),
  script_editorial: S({ font: 'EB Garamond', size: 120, bold: false, italic: true, anim: 'fade', pos: 'top', extra: 'accent', accentFont: 'Pacifico', accent: '#FFFFFF' }),
  polaroid_tilt: S({ font: 'Montserrat ExtraBold', size: 88, color: '#151515', shadow: 0, box: { color: '#FFFFFF', pad: 26 }, anim: 'drop', tilt: -6 }),
  depth: S({ font: 'Montserrat Black', size: 190, color: '#F5F0E6', upper: true, anim: 'pop', pos: 'top', extra: 'extrude', accent: '#3A2E26', maxChars: 8 }),
  interrupt: S({ font: 'EB Garamond', size: 140, italic: true, bold: false, anim: 'pop', card: 'color', cardColor: '#0B3A9E', shadow: 0 }),
  scribble: S({ font: 'Montserrat ExtraBold', size: 104, upper: true, outline: 4, anim: 'pop', extra: 'scribble', accent: '#FF3B6B', tilt: -3 }),
  brush: S({ font: 'Montserrat Black', size: 104, color: '#111111', upper: true, shadow: 0, box: { color: '#FFC400', pad: 22 }, sweep: true, anim: 'fade', tilt: -2 }),
  glass: S({ font: 'Montserrat ExtraBold', size: 100, color: '#FFFFFF', shadow: 0, box: { color: '#FFFFFF', pad: 30 }, anim: 'fade', pos: 'bottom' }),
  comic: S({ font: 'Montserrat Black', size: 92, color: '#111111', upper: true, shadow: 0, box: { color: '#FFFFFF', pad: 16 }, outline: 0, anim: 'pop', tilt: -4, extra: 'burst', accent: '#FFE600' }),
  split: S({ font: 'Montserrat Black', size: 110, color: '#111111', upper: true, shadow: 0, anim: 'slide', card: 'split', cardColor: '#F2F2F2', pos: 'bottom' }),
  numbered_list: S({ font: 'Montserrat Black', size: 130, upper: true, outline: 5, anim: 'pop', extra: 'number', accent: '#E8FF3A', maxChars: 10 }),
  // ── Headlines ──────────────────────────────────────────────────────────
  editorial: S({ font: 'EB Garamond', size: 104, bold: false, anim: 'fade', pos: 'bottom', extra: 'accent', accentFont: 'Pacifico', accent: '#E8FF3A', card: 'frame' }),
  statement: S({ font: 'Montserrat Black', size: 104, anim: 'slide', pos: 'bottom', extra: 'kicker', card: 'frame' }),
  sunset: S({ font: 'Montserrat Black', size: 66, upper: true, shadow: 0, box: { color: '#FF1E9B', pad: 18 }, anim: 'pop', pos: 'top', card: 'frame', maxChars: 18 }),
  classic: S({ font: 'Montserrat Black', size: 66, color: '#111111', upper: true, shadow: 0, box: { color: '#FFFFFF', pad: 18 }, anim: 'pop', pos: 'top', card: 'frame', maxChars: 18 }),
};

export const specFor = (id: string): HookSpec => HOOK_SPECS[id] ?? HOOK_SPECS.cadence;

/** Apply headline customisation (and brand colours) on top of the template. */
export function resolveSpec(cfg: HookConfig, brand?: { primary?: string; font?: string } | null): HookSpec {
  const base = specFor(cfg.template_id);
  if (cfg.kind !== 'headline') return base;
  const s: HookSpec = { ...base };
  if (cfg.font) s.font = cfg.font;
  if (cfg.size) s.size = cfg.size;
  if (cfg.color) s.color = cfg.color;
  if (cfg.position) s.pos = cfg.position;
  if (cfg.animation) s.anim = cfg.animation === 'typewriter' ? 'words' : cfg.animation;
  if (cfg.background === 'none') s.box = undefined;
  else if (cfg.background) s.box = { color: cfg.bg_color ?? s.box?.color ?? '#000000', pad: cfg.background === 'pill' ? 26 : 16 };
  else if (cfg.bg_color && s.box) s.box = { ...s.box, color: cfg.bg_color };
  if (cfg.use_brand && brand) {
    if (brand.primary) {
      if (s.box) s.box = { ...s.box, color: brand.primary };
      else s.accent = brand.primary;
    }
    if (brand.font) s.font = brand.font;
  }
  return s;
}

/* ─── ASS helpers ───────────────────────────────────────────────────── */

/** "#RRGGBB" → "&HBBGGRR&" for inline tags. */
export function assColor(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) ?? ['', 'FF', 'FF', 'FF'];
  return `&H${m[3]}${m[2]}${m[1]}&`.toUpperCase();
}
const styleColor = (hex: string, alpha = '00') => `&H${alpha}${assColor(hex).slice(2, 8)}`;

export function assTimeOf(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

/** Remove characters that would break ASS markup. */
export const cleanHookText = (t: string) => t.replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim();

/** Greedy word wrap to at most maxChars per line (max 3 lines). */
export function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(' ').filter(Boolean)) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  if (lines.length > 3) return [...lines.slice(0, 2), lines.slice(2).join(' ')];
  return lines;
}

export const playResY = (W: number, H: number) => Math.max(200, Math.round((1080 * H) / W));

function anchorY(pos: HookSpec['pos'], playY: number): number {
  return Math.round(pos === 'top' ? playY * 0.22 : pos === 'bottom' ? playY * 0.7 : playY * 0.45);
}

function animTags(a: Anim, sx: number, y: number, tilt: number): string {
  switch (a) {
    case 'pop':
      return `\\fscx${Math.round(sx * 0.3)}\\fscy30\\t(0,170,\\fscx${Math.round(sx * 1.08)}\\fscy108)\\t(170,250,\\fscx${sx}\\fscy100)\\fad(0,180)`;
    case 'slide':
      return `\\move(540,${y + 140},540,${y},0,280)\\fad(140,180)`;
    case 'zoomblur':
      return `\\fscx${Math.round(sx * 1.7)}\\fscy170\\blur14\\t(0,320,\\fscx${sx}\\fscy100\\blur0)\\fad(0,200)`;
    case 'flicker':
      return `\\alpha&HFF&\\t(0,60,\\alpha&H00&)\\t(110,150,\\alpha&HB0&)\\t(170,210,\\alpha&H00&)\\t(420,450,\\alpha&H90&)\\t(450,490,\\alpha&H00&)\\fad(0,200)`;
    case 'drop':
      return `\\move(540,${y - 360},540,${y},0,320)\\frz${tilt - 14}\\t(0,320,\\frz${tilt})\\fad(0,180)`;
    case 'snap':
      return `\\fscy0\\t(0,150,\\fscy112)\\t(150,220,\\fscy100)\\fad(0,160)`;
    case 'fade':
    case 'words':
      return '\\fad(220,200)';
    default:
      return '';
  }
}

/** Inline markup for special words (accent word, leading number). */
function decorate(lines: string[], s: HookSpec): string[] {
  if (s.extra === 'number') {
    return lines.map((l, i) =>
      i === 0 ? l.replace(/^(#?\d+)/, `{\\c${assColor(s.accent)}\\fscx130\\fscy130}$1{\\c${assColor(s.color)}\\fscx${s.scaleX}\\fscy100}`) : l,
    );
  }
  if (s.extra === 'accent') {
    // Longest word gets the accent font and colour.
    const words = lines.join(' ').split(' ');
    const key = words.reduce((a, b) => (b.replace(/\W/g, '').length > a.replace(/\W/g, '').length ? b : a), '');
    let done = false;
    return lines.map((l) =>
      l
        .split(' ')
        .map((w) => {
          if (done || w !== key) return w;
          done = true;
          return `{\\fn${s.accentFont ?? s.font}\\c${assColor(s.accent)}\\fscx115\\fscy115}${w}{\\fn${s.font}\\c${assColor(s.color)}\\fscx${s.scaleX}\\fscy100}`;
        })
        .join(' '),
    );
  }
  return lines;
}

/**
 * A full ASS document for one hook, drawn for `dur` seconds starting at
 * `start`. Style "Hook"; layers 10+ so it sits above captions when merged.
 */
export function buildHookAss(text: string, s: HookSpec, W: number, H: number, dur: number, start = 0): string {
  const playY = playResY(W, H);
  // Font sizes are tuned for a 1080×1920 canvas; shrink a little on short frames.
  const fs = Math.round(s.size * Math.min(1, Math.max(0.6, playY / 1600)));
  const raw = cleanHookText(s.upper ? text.toUpperCase() : text) || 'Watch this';
  const maxChars = Math.max(6, Math.round(s.maxChars * (s.size / fs)));
  let lines = wrapLines(raw, maxChars);
  const y = anchorY(s.pos, playY);
  const t0 = start;
  const t1 = start + dur;
  const borderStyle = s.box ? 3 : 1;
  const style = [
    'Hook', s.font, fs, styleColor(s.color), styleColor(s.color),
    styleColor(s.box ? s.box.color : s.outlineColor, s.extra === 'glow' ? '40' : '00'),
    styleColor('#000000', '80'),
    s.bold ? -1 : 0, s.italic ? -1 : 0, 0, 0, s.scaleX, 100, s.spacing, 0,
    borderStyle, s.box ? s.box.pad : s.outline, s.box ? 0 : s.shadow, 5, 60, 60, 0, 1,
  ].join(',');
  const glass = s === HOOK_SPECS.glass || (s.box && s.box.color.toUpperCase() === '#FFFFFF' && s.color.toUpperCase() === '#FFFFFF');
  const head = [
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', `PlayResY: ${playY}`, 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${style}`, '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const ev: string[] = [];
  const dlg = (layer: number, a: number, b: number, tags: string, body: string) =>
    ev.push(`Dialogue: ${layer},${assTimeOf(a)},${assTimeOf(b)},Hook,,0,0,0,,{${tags}}${body}`);
  const base = `\\an5\\pos(540,${y})${s.tilt ? `\\frz${s.tilt}` : ''}`;
  const sweep = s.sweep ? `\\clip(0,0,0,${playY})\\t(0,300,\\clip(0,0,1080,${playY}))` : '';
  const glassTags = glass ? `\\3a&H90&\\c${assColor('#FFFFFF')}` : '';

  // Kicker: first short phrase small on its own line.
  let kicker: string | null = null;
  if (s.extra === 'kicker') {
    const words = raw.split(' ');
    if (words.length > 3) {
      kicker = words.slice(0, 2).join(' ');
      lines = wrapLines(words.slice(2).join(' '), maxChars);
    }
  }
  const body = decorate(lines, s).join('\\N');
  const lineH = fs * 1.15;

  // Background drawings.
  if (s.extra === 'burst') {
    const r = Math.round(fs * 2.4);
    const pts: string[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = i % 2 ? r * 0.62 : r;
      pts.push(`${Math.round(Math.cos(a) * rr)} ${Math.round(Math.sin(a) * rr)}`);
    }
    dlg(10, t0, t1, `\\an7\\pos(540,${y})\\p1\\bord5\\3c&H000000&\\1c${assColor(s.accent)}${animTags('pop', 100, y, 0)}\\frz8`, `m ${pts[0]} l ${pts.slice(1).join(' ')}{\\p0}`);
  }
  if (s.extra === 'glow') {
    dlg(11, t0, t1, `${base}\\bord14\\blur16\\3c${assColor(s.accent)}\\1a&HFF&\\shad0${animTags(s.anim, s.scaleX, y, s.tilt)}`, body);
  }
  if (s.extra === 'extrude') {
    for (let i = 7; i >= 1; i--) {
      dlg(11, t0, t1, `\\an5\\pos(${540 + i * 4},${y + i * 4})\\c${assColor(s.accent)}\\bord0\\shad0${animTags(s.anim, s.scaleX, y, 0)}`, body);
    }
  }

  if (s.anim === 'words') {
    // Words land one at a time, then the full line holds.
    const words = raw.split(' ');
    const n = Math.max(1, words.length);
    const step = Math.min(0.38, (dur * 0.6) / n);
    for (let i = 0; i < n; i++) {
      const a = t0 + i * step;
      const b = i === n - 1 ? t1 : t0 + (i + 1) * step;
      const shown = decorate(wrapLines(words.slice(0, i + 1).join(' '), maxChars), s).join('\\N');
      dlg(12, a, b, `${base}${i === n - 1 ? '\\fad(0,200)' : ''}${glassTags}`, shown);
    }
  } else {
    dlg(12, t0, t1, `${base}${animTags(s.anim, s.scaleX, y, s.tilt)}${sweep}${glassTags}`, body);
  }

  if (kicker) {
    const ky = Math.round(y - (lines.length * lineH) / 2 - fs * 0.55);
    dlg(12, t0, t1, `\\an5\\pos(540,${ky})\\fs${Math.round(fs * 0.42)}\\fnMontserrat SemiBold\\b0${animTags('fade', 100, ky, 0)}`, cleanHookText(kicker));
  }

  if (s.extra === 'underline' || s.extra === 'scribble') {
    const uy = Math.round(y + (lines.length * lineH) / 2 + 10);
    const w = Math.min(900, Math.round(Math.max(...lines.map((l) => l.length)) * fs * 0.55));
    const x0 = 540 - Math.round(w / 2);
    const seg = Math.max(40, Math.round(w / 8));
    let path = 'm 0 12';
    for (let x = 0; x < w; x += seg) path += ` b ${x + seg / 3} -10 ${x + (2 * seg) / 3} 34 ${x + seg} 12`;
    dlg(13, t0 + 0.15, t1, `\\an7\\pos(${x0},${uy})\\p1\\1a&HFF&\\bord7\\shad0\\3c${assColor(s.accent)}\\clip(${x0},0,${x0},${playY})\\t(0,350,\\clip(${x0},0,${x0 + w + 20},${playY}))\\fad(0,180)`, `${path}{\\p0}`);
  }

  return [...head, ...ev, ''].join('\n');
}

/**
 * Merge a hook document into a caption document so both burn in one pass.
 * Both use PlayResX 1080 and the same PlayResY for the frame.
 */
export function mergeAss(captions: string, hook: string): string {
  const style = hook.split('\n').find((l) => l.startsWith('Style: Hook,'));
  const events = hook.split('\n').filter((l) => l.startsWith('Dialogue:'));
  if (!style) return captions;
  const lines = captions.split('\n');
  const evIdx = lines.findIndex((l) => l.trim() === '[Events]');
  if (evIdx < 0) return captions;
  // Last Style line before [Events].
  let styleIdx = -1;
  for (let i = 0; i < evIdx; i++) if (lines[i].startsWith('Style:')) styleIdx = i;
  if (styleIdx < 0) return captions;
  lines.splice(styleIdx + 1, 0, style);
  return [...lines.filter((l, i) => !(i === lines.length - 1 && l === '')), ...events, ''].join('\n');
}

/* ─── Sound effects (synthesised, original) ─────────────────────────── */

/** lavfi source for a sound effect, stereo 44.1 kHz. */
export function sfxSource(kind: HookConfig['sfx_type']): string | null {
  const fmt = 'aformat=sample_rates=44100:channel_layouts=stereo';
  switch (kind) {
    case 'whoosh':
      return `anoisesrc=d=0.7:c=pink:a=0.6,bandpass=f=1400:w=1800,afade=t=in:d=0.3,afade=t=out:st=0.32:d=0.38,volume=0.7,${fmt}`;
    case 'pop':
      return `sine=f=880:d=0.16,afade=t=out:st=0.01:d=0.15,volume=0.6,${fmt}`;
    case 'riser':
      return `aevalsrc=0.25*sin(2*PI*(150*t+450*t*t)):d=1:s=44100,afade=t=in:d=0.6,afade=t=out:st=0.85:d=0.15,${fmt}`;
    case 'hit':
      return `sine=f=58:d=0.6,afade=t=out:d=0.6,volume=1.6,${fmt}`;
    default:
      return null;
  }
}

/* ─── Opening card background ───────────────────────────────────────── */

/**
 * filter_complex that produces [bg] (W×H, `dur` s, 30 fps) for an opening
 * card. Input 0 is the finished clip. Montage/flash cards use the clip's own
 * shots only, never outside footage.
 */
export function cardBackground(spec: HookSpec, W: number, H: number, dur: number, clipSeconds: number): string {
  const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30`;
  const still = (label: string, at: number) => `[0:v]trim=start=${at.toFixed(2)}:duration=0.05,setpts=PTS-STARTPTS,${fit},tpad=stop_mode=clone:stop_duration=${dur}[${label}]`;
  const at = Math.min(0.5, clipSeconds / 4);
  switch (spec.card) {
    case 'white':
    case 'color':
      return `color=c=${spec.card === 'white' ? 'white' : spec.cardColor.replace('#', '0x')}:s=${W}x${H}:r=30:d=${dur}[bg]`;
    case 'frame':
      return `${still('st', at)};[st]trim=duration=${dur}[bg]`;
    case 'split': {
      const h2 = Math.round(H / 2 / 2) * 2;
      return `${still('st', at)};[st]trim=duration=${dur},scale=${W}:${h2}:force_original_aspect_ratio=increase,crop=${W}:${h2}[top];color=c=${spec.cardColor.replace('#', '0x')}:s=${W}x${H - h2}:r=30:d=${dur}[bot];[top][bot]vstack[bg]`;
    }
    case 'montage':
    case 'flashes': {
      const n = spec.card === 'flashes' ? Math.max(4, Math.round(dur / 0.25)) : 4;
      const len = dur / n;
      const span = Math.max(1, clipSeconds - len - 0.1);
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const st = Math.min(span, (span * (i + 0.5)) / n);
        parts.push(`[0:v]trim=start=${st.toFixed(2)}:duration=${len.toFixed(3)},setpts=PTS-STARTPTS,${fit}${spec.card === 'montage' ? ',eq=brightness=-0.08' : ''}[m${i}]`);
      }
      return `${parts.join(';')};${Array.from({ length: n }, (_, i) => `[m${i}]`).join('')}concat=n=${n}:v=1:a=0,trim=duration=${dur}[bg]`;
    }
    default:
      return `${still('st', at)};[st]trim=duration=${dur},boxblur=28:2,eq=brightness=-0.12[bg]`;
  }
}

/** Short, readable fallback hook when the AI is unavailable. */
export function fallbackHook(title: string, hookText: string, kind: 'viral' | 'headline'): string {
  const src = cleanHookText(title || hookText || 'Watch this');
  const words = src.split(' ').filter(Boolean);
  const max = kind === 'headline' ? 8 : 6;
  return words.slice(0, max).join(' ') + (words.length > max ? '…' : '');
}
