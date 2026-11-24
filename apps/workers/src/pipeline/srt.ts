/**
 * SRT parsing and per-clip timestamp mapping. Pure functions (unit-tested).
 *
 * A clip cut from [clipStart, clipEnd) of the source keeps every cue that
 * overlaps that window, trimmed to it and re-based so the clip starts at 0.
 */

export type SrtCue = { start: number; end: number; text: string };

const TIME = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
const ARROW = /^\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/;

/** "HH:MM:SS,mmm" → seconds; null if malformed. */
export function srtTime(t: string): number | null {
  const m = TIME.exec(t.trim());
  if (!m) return null;
  const [, h, mi, s, ms] = m;
  if (Number(mi) > 59 || Number(s) > 59) return null;
  return Number(h) * 3600 + Number(mi) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
}

/**
 * Parse SRT text. Malformed blocks are skipped (counted in `skipped`), cues
 * are returned sorted by start time, and tags like <i> are stripped.
 */
export function parseSrt(input: string): { cues: SrtCue[]; skipped: number } {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n\s*\n/);
  const cues: SrtCue[] = [];
  let skipped = 0;
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) continue;
    const idx = lines.findIndex((l) => ARROW.test(l));
    if (idx < 0) {
      skipped++;
      continue;
    }
    const m = ARROW.exec(lines[idx])!;
    const start = srtTime(m[1]);
    const end = srtTime(m[2]);
    const body = lines
      .slice(idx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .trim();
    if (start == null || end == null || end <= start || !body) {
      skipped++;
      continue;
    }
    cues.push({ start, end, text: body });
  }
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return { cues, skipped };
}

/**
 * Cues for one clip: keep those overlapping [clipStart, clipEnd), clamp to the
 * window and shift so the clip starts at 0. Order is preserved; cues shorter
 * than 50 ms after clamping are dropped (a sliver at the cut point).
 */
export function cuesForClip(cues: SrtCue[], clipStart: number, clipEnd: number): SrtCue[] {
  const out: SrtCue[] = [];
  for (const c of cues) {
    if (c.end <= clipStart || c.start >= clipEnd) continue;
    const start = Math.max(c.start, clipStart) - clipStart;
    const end = Math.min(c.end, clipEnd) - clipStart;
    if (end - start < 0.05) continue;
    out.push({ start: round3(start), end: round3(end), text: c.text });
  }
  return out;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Seconds → "HH:MM:SS,mmm". */
export function formatSrtTime(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

export function toSrt(cues: SrtCue[]): string {
  return cues.map((c, i) => `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}\n`).join('\n');
}

/** Move every cue later by `seconds` (e.g. after an opening hook card). */
export function shiftCues(cues: SrtCue[], seconds: number): SrtCue[] {
  return cues.map((c) => ({ ...c, start: c.start + seconds, end: c.end + seconds }));
}
