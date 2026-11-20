const { test } = require('node:test');
const assert = require('node:assert/strict');
const { watermarkAss } = require('../dist/pipeline/ffmpeg.service');

test('watermark ASS script is sized to the frame and runs for the whole clip', () => {
  const ass = watermarkAss(1080, 1920);
  assert.match(ass, /PlayResX: 1080/);
  assert.match(ass, /PlayResY: 1920/);
  assert.match(ass, /Style: Mark,DejaVu Sans,46,/);
  assert.match(ass, /Dialogue: 0,0:00:00\.00,9:59:59\.00,Mark,,0,0,0,,Made with AutoClipr/);
  // Alignment 9 = top-right.
  assert.match(ass, /,1,1,1,9,58,58,58,1$/m);
});
