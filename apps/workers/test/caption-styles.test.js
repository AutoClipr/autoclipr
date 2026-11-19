/**
 * Caption engine: word timing, phrase chunking and per-style ASS output.
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  CAPTION_STYLE_IDS,
  buildAss,
  chunkWords,
  clipWords,
  getCaptionStyle,
  segmentWords,
  assTime,
  emojiFor,
} = require('../dist/pipeline/caption-styles.js');

const seg = (start, end, text, words) => ({ start, end, text, ...(words ? { words } : {}) });
const dialogues = (ass) => ass.split('\n').filter((l) => l.startsWith('Dialogue:'));

test('uses Whisper word timings when present', () => {
  const words = [{ start: 1, end: 1.4, word: 'Hello' }, { start: 1.5, end: 2, word: 'there' }];
  assert.deepStrictEqual(segmentWords(seg(1, 2, 'Hello there', words)), words);
});

test('spreads words across the segment when timings are missing', () => {
  const w = segmentWords(seg(10, 12, 'one two three'));
  assert.strictEqual(w.length, 3);
  assert.strictEqual(w[0].start, 10);
  assert.ok(Math.abs(w[2].end - 12) < 1e-9);
  assert.ok(w[1].start >= w[0].end - 1e-9);
});

test('keeps only words inside the clip, relative to its start', () => {
  const words = [
    { start: 4, end: 4.5, word: 'before' },
    { start: 5.2, end: 5.6, word: 'inside' },
    { start: 9.8, end: 10.4, word: 'edge' },
    { start: 11, end: 11.5, word: 'after' },
  ];
  const out = clipWords([seg(4, 11.5, 'x', words)], 5, 10);
  assert.deepStrictEqual(out.map((w) => w.word), ['inside', 'edge']);
  assert.ok(Math.abs(out[0].start - 0.2) < 1e-9);
  assert.ok(Math.abs(out[1].end - 5) < 1e-9); // clamped to clip end
});

test('chunks by size, sentence end and pauses', () => {
  const w = (word, start, end) => ({ word, start, end });
  const words = [w('a', 0, 0.2), w('b', 0.2, 0.4), w('c', 0.4, 0.6), w('d.', 0.6, 0.8), w('e', 0.8, 1), w('f', 2.5, 2.7)];
  const chunks = chunkWords(words, 3).map((c) => c.map((x) => x.word).join(' '));
  assert.deepStrictEqual(chunks, ['a b c', 'd.', 'e', 'f']);
});

test('formats ASS time as h:mm:ss.cc', () => {
  assert.strictEqual(assTime(0), '0:00:00.00');
  assert.strictEqual(assTime(65.234), '0:01:05.23');
  assert.strictEqual(assTime(3600.5), '1:00:00.50');
});

test('every style produces a valid ASS file with dialogue', () => {
  const words = clipWords([seg(0, 3, 'Money is not the goal, freedom is!')], 0, 3);
  for (const id of CAPTION_STYLE_IDS) {
    const ass = buildAss(words, id, 3);
    assert.match(ass, /\[V4\+ Styles\]/, id);
    assert.match(ass, /PlayResX: 1080/, id);
    assert.ok(dialogues(ass).length > 0, `${id} has dialogue`);
  }
});

test('highlight styles emit one line per word with the active word tagged', () => {
  const words = clipWords([seg(0, 1.5, 'one two three')], 0, 1.5);
  const lines = dialogues(buildAss(words, 'viral', 1.5));
  assert.strictEqual(lines.length, 3);
  assert.match(lines[1], /\\c&H0030E8FF&\}TWO/);
});

test('karaoke uses a fill sweep per word', () => {
  const words = clipWords([seg(0, 1.5, 'one two three')], 0, 1.5);
  const lines = dialogues(buildAss(words, 'karaoke', 1.5));
  assert.strictEqual(lines.length, 1);
  assert.strictEqual((lines[0].match(/\\kf\d+/g) || []).length, 3);
});

test('typewriter reveals words one by one', () => {
  const words = clipWords([seg(0, 1.5, 'one two three')], 0, 1.5);
  const texts = dialogues(buildAss(words, 'typewriter', 1.5)).map((l) => l.split(',,').pop().replace(/\{[^}]*\}/g, ''));
  assert.deepStrictEqual(texts, ['one', 'one two', 'one two three']);
});

test('punch shows one word per line', () => {
  const words = clipWords([seg(0, 1, 'go go')], 0, 1);
  assert.strictEqual(dialogues(buildAss(words, 'punch', 1)).length, 2);
});

test('braces in speech cannot inject override tags', () => {
  const words = clipWords([seg(0, 1, 'a {\\b1} b')], 0, 1);
  const ass = buildAss(words, 'minimal', 1);
  assert.ok(!ass.includes('{\\b1}'));
});

test('no speech in the window means no caption lines', () => {
  assert.strictEqual(dialogues(buildAss([], 'viral', 5)).length, 0);
});

test('unknown style falls back to viral', () => {
  assert.strictEqual(getCaptionStyle('nope').id, 'viral');
  assert.strictEqual(getCaptionStyle(undefined).id, 'viral');
});

test('emoji style uses symbols the caption font can draw, not colour emoji', () => {
  const tag = emojiFor('show me the money', getCaptionStyle('emoji'));
  assert.match(tag, /\$/);
  assert.match(tag, /\\fnMontserrat/); // switches back to the style font
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(tag));
});
