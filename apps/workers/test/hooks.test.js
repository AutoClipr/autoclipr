const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../dist/pipeline/hooks.js');
const { shiftCues } = require('../dist/pipeline/srt.js');

const TEMPLATE_IDS = [
  'montage', 'cutaway', 'halo', 'condensed_italic', 'cadence', 'hero', 'highlighter', 'match_cut', 'neon',
  'script_editorial', 'polaroid_tilt', 'depth', 'interrupt', 'scribble', 'brush', 'glass', 'comic', 'split',
  'numbered_list', 'editorial', 'statement', 'sunset', 'classic',
];

test('every API template has a render spec', () => {
  for (const id of TEMPLATE_IDS) assert.ok(H.HOOK_SPECS[id], id);
});

test('hook ASS: canvas, style and timed events for every template and ratio', () => {
  for (const [W, Hh, playY] of [[1080, 1920, 1920], [1920, 1080, 608], [1080, 1080, 1080], [1080, 1350, 1350]]) {
    for (const id of TEMPLATE_IDS) {
      const ass = H.buildHookAss('3 things {nobody} tells you about money', H.specFor(id), W, Hh, 2.5, 0);
      assert.match(ass, new RegExp(`PlayResY: ${playY}`));
      assert.match(ass, /^Style: Hook,/m);
      const ev = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
      assert.ok(ev.length >= 1, id);
      assert.ok(ev.every((l) => /0:00:0\d\.\d\d,0:00:0\d\.\d\d,Hook/.test(l)), id);
      assert.ok(!ass.includes('{nobody}'), 'braces are stripped');
      // Nothing outlives the hook.
      assert.ok(ev.every((l) => l.split(',')[2] <= '0:00:02.50'), id);
    }
  }
});

test('word-by-word templates reveal words cumulatively', () => {
  const ev = H.buildHookAss('one two three', H.specFor('cadence'), 1080, 1920, 3).split('\n').filter((l) => l.startsWith('Dialogue:'));
  assert.equal(ev.length, 3);
  assert.match(ev[0], /}one$/);
  assert.match(ev[2], /}one two three$/);
});

test('numbered list colours the leading number; kicker splits the statement', () => {
  assert.match(H.buildHookAss('3 habits', H.specFor('numbered_list'), 1080, 1920, 2), /\\c&H3AFFE8&\\fscx130\\fscy130}3/);
  const st = H.buildHookAss('Stop waiting. Start creating today', H.specFor('statement'), 1080, 1920, 2);
  assert.match(st, /}Stop waiting\.$/m);
});

test('merging puts the hook style and events into the caption file', () => {
  const caps = ['[Script Info]', 'PlayResY: 1920', '', '[V4+ Styles]', 'Format: Name', 'Style: Default,x', '', '[Events]', 'Format: Layer', 'Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,hi', ''].join('\n');
  const out = H.mergeAss(caps, H.buildHookAss('Hello there', H.specFor('classic'), 1080, 1920, 2));
  const lines = out.split('\n');
  assert.ok(lines.indexOf('Style: Default,x') < lines.findIndex((l) => l.startsWith('Style: Hook,')));
  assert.ok(lines.findIndex((l) => l.startsWith('Style: Hook,')) < lines.indexOf('[Events]'));
  assert.ok(lines.some((l) => l.includes(',Hook,')));
  assert.ok(lines.includes('Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,hi'));
  assert.equal(H.mergeAss('no styles', 'Style: Hook,a'), 'no styles');
});

test('headline customisation and brand colours override the template', () => {
  const s = H.resolveSpec({ kind: 'headline', template_id: 'classic', placement: 'overlay', duration: 3, font: 'EB Garamond', size: 90, color: '#FF0000', position: 'bottom', animation: 'typewriter', background: 'pill', bg_color: '#00FF00' });
  assert.equal(s.font, 'EB Garamond');
  assert.equal(s.size, 90);
  assert.equal(s.pos, 'bottom');
  assert.equal(s.anim, 'words');
  assert.deepEqual(s.box, { color: '#00FF00', pad: 26 });
  assert.equal(H.resolveSpec({ kind: 'headline', template_id: 'sunset', placement: 'overlay', duration: 3, background: 'none' }).box, undefined);
  assert.equal(H.resolveSpec({ kind: 'headline', template_id: 'sunset', placement: 'overlay', duration: 3, use_brand: true }, { primary: '#123456' }).box.color, '#123456');
  // Viral hooks keep their designed look.
  assert.equal(H.resolveSpec({ kind: 'viral', template_id: 'halo', placement: 'opening', duration: 2, font: 'Pacifico' }).font, 'Montserrat Black');
});

test('cards, sounds, wrapping and fallbacks', () => {
  assert.match(H.cardBackground(H.specFor('interrupt'), 1080, 1920, 2, 30), /color=c=0x0B3A9E:s=1080x1920/);
  assert.match(H.cardBackground(H.specFor('montage'), 1080, 1920, 2, 30), /concat=n=4:v=1:a=0/);
  assert.match(H.cardBackground(H.specFor('split'), 1080, 1920, 2, 30), /vstack\[bg\]/);
  assert.match(H.cardBackground(H.specFor('cadence'), 1080, 1920, 2, 30), /boxblur/);
  for (const k of ['whoosh', 'pop', 'riser', 'hit']) assert.match(H.sfxSource(k), /channel_layouts=stereo/);
  assert.equal(H.sfxSource('none'), null);
  assert.deepEqual(H.wrapLines('a bb ccc dddd eeeee', 6), ['a bb', 'ccc', 'dddd eeeee']);
  assert.ok(H.wrapLines('one two three four five six seven eight nine', 6).length <= 3);
  assert.equal(H.fallbackHook('How I saved money every single month', '', 'viral'), 'How I saved money every single…');
  assert.equal(H.assColor('#112233'), '&H332211&');
  assert.equal(H.assTimeOf(62.5), '0:01:02.50');
  assert.deepEqual(shiftCues([{ start: 1, end: 2, text: 'a' }], 2.5), [{ start: 3.5, end: 4.5, text: 'a' }]);
});

test('hook text stays off the face: top hangs from 8%, middle in the lower third, bottom from 86%', () => {
  assert.equal(H.anchorY('middle', 1920, 300), Math.round(1920 * 0.66));
  assert.equal(H.anchorY('top', 1920, 300), Math.round(1920 * 0.08 + 150));
  assert.equal(H.anchorY('bottom', 1920, 300), Math.round(1920 * 0.86 - 150));
  const y = Number(/\\pos\(540,(\d+)\)/.exec(H.buildHookAss('Short hook', H.specFor('cadence'), 1080, 1920, 2))[1]);
  assert.ok(y > 1920 * 0.6, `cadence sits low (${y})`);
});
