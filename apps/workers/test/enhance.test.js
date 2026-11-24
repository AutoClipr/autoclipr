const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../dist/pipeline/enhance.js');
const { overlayGraph } = require('../dist/pipeline/ffmpeg.service.js');

const W = (word, start, end) => ({ word, start, end });
const words = [W('So', 10, 10.3), W('um', 10.4, 10.7), W('the', 10.8, 11), W('the', 11.05, 11.2), W('secret', 11.3, 11.8), W('is', 13.5, 13.7), W('money!', 13.8, 14.3)];

test('speech cleanup cuts fillers, repeats and long pauses', () => {
  const plan = E.cleanupIntervals(words, 10, 15, { max_pause: 0.6 });
  assert.equal(plan.removedFillers, 2); // "um" and the repeated "the"
  assert.ok(plan.removedPauses >= 1); // 11.8 → 13.5
  assert.ok(E.keptDuration(plan.keep) < 5 - 1.5);
  // Nothing removed when both options are off.
  assert.deepEqual(E.cleanupIntervals(words, 10, 15, { pauses: false, fillers: false }).keep, [[0, 5]]);
});

test('remapping drops cut words and shifts later ones', () => {
  const keep = [[0, 1], [2, 4]];
  assert.equal(E.remapTime(0.5, keep), 0.5);
  assert.equal(E.remapTime(1.5, keep), null);
  assert.equal(E.remapTime(3, keep), 2);
  const segs = E.remapSegments([{ start: 10, end: 14, text: 'a b c', words: [W('a', 10.2, 10.5), W('b', 11.2, 11.6), W('c', 12.5, 13)] }], 10, 14, keep);
  assert.deepEqual(segs[0].words.map((w) => w.word), ['a', 'c']);
  assert.deepEqual([segs[0].words[1].start, segs[0].words[1].end], [1.5, 2]);
});

test('emphasis, zoom, keywords, emojis and sound effects', () => {
  const ws = [W('I', 1, 1.2), W('made', 1.3, 1.6), W('$10,000', 1.7, 2.4), W('in', 2.5, 2.6), W('ONE', 6, 6.4), W('month!', 6.5, 7), W('love', 10.2, 10.5), W('this', 10.6, 10.9)];
  const t = E.emphasisTimes(ws, 12);
  assert.ok(t.includes(1.7) && t.includes(6), JSON.stringify(t));
  assert.ok(t.every((x, i) => i === 0 || x - t[i - 1] >= 3.5));
  const z = E.zoomFilter(t, 1080, 1920, 'strong');
  assert.match(z, /zoompan=z='1\+0\.22\*max\(/);
  assert.match(z, /s=1080x1920/);
  assert.equal(E.zoomFilter([], 1080, 1920), null);
  assert.ok(E.pickKeywords(ws, [1.7]).some((k) => k.word === '$10,000'));
  const em = E.pickEmojis([{ start: 0, end: 12, text: '', words: ws }], 12, 'high');
  assert.deepEqual(em.map((e) => e.emoji), ['😮', '❤️']);
  const fx = E.sfxEvents({ intensity: 'bold' }, { zooms: [2], keywords: [2.2], cuts: [5], emojis: [], punchlines: [7] });
  assert.deepEqual(fx.map((e) => e.kind), ['whoosh', 'whoosh', 'hit']); // keyword at 2.2 is within 0.6 s of the zoom
  assert.equal(E.sfxEvents({ intensity: 'subtle' }, { zooms: [], keywords: [], cuts: [5], emojis: [], punchlines: [7] }).length, 0);
});

test('overlays: progress bar, keywords, fallback emoji symbols, merged into captions', () => {
  const ass = E.overlayAss(1080, 1920, 10, { progressBar: { color: '#54D045' }, keywords: [{ t: 1, word: 'money' }, { t: 0.5, word: 'early' }], emojiSymbols: [{ t: 3, end: 4.4, emoji: '🔥' }], startAfter: 0.8 });
  assert.match(ass, /\\t\(0,10000,\\clip\(0,0,1080,1920\)\)/);
  assert.match(ass, /}MONEY$/m);
  assert.ok(!ass.includes('EARLY'), 'keywords during an overlay hook are skipped');
  assert.match(ass, /\\fnDejaVu Sans.*}⚡$/m);
  assert.equal(E.overlayAss(1080, 1920, 10, {}), null);
  const caps = ['[V4+ Styles]', 'Style: Default,x', '', '[Events]', 'Dialogue: 0,a', ''].join('\n');
  const merged = E.mergeAssDoc(caps, ass);
  assert.ok(merged.indexOf('Style: Fx,') < merged.indexOf('[Events]'));
  assert.ok(merged.includes('Dialogue: 0,a') && merged.includes(',Fx,,'));
});

test('look and sound filters', () => {
  for (const p of ['natural', 'vibrant', 'warm', 'cool']) assert.match(E.colorFilter(p), /^normalize=.*eq=/);
  assert.match(E.colorFilter('warm'), /colorbalance=rs=0\.06/);
  assert.match(E.audioCleanFilter('strong'), /afftdn=nr=22.*loudnorm=I=-14/);
  assert.equal(E.XFADE.slide, 'slideleft');
});

test('per-minute billing counts started minutes of features that ran', () => {
  assert.equal(E.clipCharge(45, ['enhance_audio', 'auto_sfx', 'ai_emojis']), 13);
  assert.equal(E.clipCharge(61, ['voice_dubbing']), 20);
  assert.equal(E.clipCharge(30, ['color_correction', 'speech_cleanup']), 0);
});

test('translated segments get even word timings', () => {
  const s = E.spreadWords({ start: 2, end: 4, text: 'hola a todos' });
  assert.deepEqual(s.words.map((w) => [w.word, +w.start.toFixed(2)]), [['hola', 2], ['a', 2.67], ['todos', 3.33]]);
});

test('emoji image overlays share the caption pass', () => {
  const g = overlayGraph('ass=x.ass', [{ path: '/tmp/e.png', t: 1, end: 2.4, x: 540, y: 1190, size: 170 }]);
  assert.deepEqual(g.inputs, ['-loop', '1', '-t', '2.50', '-i', '/tmp/e.png']);
  assert.match(g.graph, /^\[0:v\]ass=x\.ass\[c0\];/);
  assert.match(g.graph, /enable='between\(t,1\.00,2\.40\)'/);
  assert.match(g.graph, /\[vout\]$/);
  assert.deepEqual(overlayGraph('ass=x', []), { inputs: [], graph: null });
});
