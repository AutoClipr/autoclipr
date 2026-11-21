const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyOverrides, buildAss, getCaptionStyle, hexToAss } = require('../dist/pipeline/caption-styles');
const { logoPosition, logoScaleFilter, exportSize } = require('../dist/pipeline/ffmpeg.service');

test('hexToAss converts #RRGGBB to &HAABBGGRR', () => {
  assert.equal(hexToAss('#54D045'), '&H0045D054');
  assert.equal(hexToAss('#ffffff', '96'), '&H96FFFFFF');
  assert.equal(hexToAss('red'), null);
  assert.equal(hexToAss(undefined), null);
});

test('brand overrides recolour text, highlight, box and position', () => {
  const base = getCaptionStyle('viral');
  const s = applyOverrides(base, {
    font: 'EB Garamond', size: 90, color: '#112233', highlight_color: '#54D045',
    background: true, background_color: '#000000', outline: 2, shadow: 0, position: 'top', alignment: 'left', max_words: 2,
  });
  assert.equal(s.font, 'EB Garamond');
  assert.equal(s.size, 90);
  assert.equal(s.primary, '&H00332211');
  assert.match(s.activeTags, /\\c&H0045D054&/);
  assert.equal(s.box, true);
  assert.equal(s.back, '&H30000000');
  assert.equal(s.wordsPerChunk, 2);
  assert.equal(s.alignment, 7);
  assert.equal(s.marginV, 260);
  // Base style untouched.
  assert.notEqual(base.font, 'EB Garamond');
});

test('no overrides returns the base style, and karaoke highlight fills the sung colour', () => {
  const base = getCaptionStyle('minimal');
  assert.equal(applyOverrides(base, undefined), base);
  const k = applyOverrides(getCaptionStyle('karaoke'), { highlight_color: '#FF0000' });
  assert.equal(k.primary, '&H000000FF');
});

test('buildAss uses the overridden style line', () => {
  const ass = buildAss([{ word: 'hello', start: 0, end: 0.5 }], 'viral', 1, { font: 'Pacifico', position: 'middle' });
  assert.match(ass, /Style: Default,Pacifico,/);
  assert.match(ass, /,5,80,80,0,1$/m);
});

test('logo is sized to the frame and placed in its corner', () => {
  assert.equal(logoScaleFilter(1080, { size: 20, opacity: 0.8 }), 'scale=216:-1,format=rgba,colorchannelmixer=aa=0.80');
  assert.equal(logoScaleFilter(1080, { size: 99, opacity: 5 }), 'scale=432:-1,format=rgba,colorchannelmixer=aa=1.00');
  assert.equal(logoPosition(1080, 1920, 'top-left'), 'x=43:y=96:shortest=1');
  assert.equal(logoPosition(1080, 1920, 'bottom-right'), 'x=W-w-43:y=H-h-230:shortest=1');
  assert.equal(logoPosition(1080, 1920, 'bottom-left'), 'x=43:y=H-h-230:shortest=1');
  assert.equal(logoPosition(1080, 1920, 'nonsense'), 'x=W-w-43:y=96:shortest=1');
  assert.deepEqual(exportSize('4k'), [2160, 3840]);
  assert.deepEqual(exportSize('unknown'), [1080, 1920]);
});
