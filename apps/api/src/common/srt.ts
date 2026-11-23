/**
 * Minimal SRT validation for uploads (the worker does the per-clip mapping).
 * Mirrors apps/workers/src/pipeline/srt.ts parsing rules.
 */
export type SrtSummary = { cues: number; skipped: number; first: { start: number; end: number; text: string }[]; lastEnd: number };

const ARROW = /^\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
const sec = (h: string, m: string, s: string, ms: string) =>
  Number(m) > 59 || Number(s) > 59 ? null : Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;

export function summarizeSrt(input: string): SrtSummary {
  const blocks = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  const cues: { start: number; end: number; text: string }[] = [];
  let skipped = 0;
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    const i = lines.findIndex((l) => ARROW.test(l));
    if (i < 0) {
      skipped++;
      continue;
    }
    const m = ARROW.exec(lines[i])!;
    const start = sec(m[1], m[2], m[3], m[4]);
    const end = sec(m[5], m[6], m[7], m[8]);
    const text = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (start == null || end == null || end <= start || !text) {
      skipped++;
      continue;
    }
    cues.push({ start, end, text });
  }
  cues.sort((a, b) => a.start - b.start);
  return { cues: cues.length, skipped, first: cues.slice(0, 3), lastEnd: cues.reduce((mx, c) => Math.max(mx, c.end), 0) };
}
