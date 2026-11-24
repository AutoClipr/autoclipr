const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSrt, cuesForClip, srtTime, toSrt, formatSrtTime } = require('../dist/pipeline/srt');
const { outputSize, layoutGraph } = require('../dist/pipeline/layout');
const { buildAssFromCues, buildAss } = require('../dist/pipeline/caption-styles');

const SRT = `1
00:01:58,000 --> 00:02:01,500
Before and across the cut

2
00:02:00,000 --> 00:02:05,000
<i>Inside</i> the clip

bad block without times

3
00:02:03,000 --> 00:02:04,000
Overlapping cue

4
00:02:10,000 --> 00:02:09,000
End before start

5
00:02:29,990 --> 00:02:35,000
Sliver at the end

6
00:03:00,000 --> 00:03:02,000
After the clip
`;

test('parses SRT, skipping malformed blocks and stripping tags', () => {
  const { cues, skipped } = parseSrt('﻿' + SRT.replace(/\n/g, '\r\n'));
  assert.equal(cues.length, 5);
  assert.equal(skipped, 2);
  assert.deepEqual(cues[1], { start: 120, end: 125, text: 'Inside the clip' });
  assert.equal(srtTime('00:61:00,000'), null);
  assert.equal(srtTime('1:02:03.5'), 3723.5);
});

test('maps cues into a clip window: clamp, re-base, keep order, drop slivers', () => {
  const { cues } = parseSrt(SRT);
  const out = cuesForClip(cues, 120, 150);
  assert.deepEqual(out, [
    { start: 0, end: 1.5, text: 'Before and across the cut' },
    { start: 0, end: 5, text: 'Inside the clip' },
    { start: 3, end: 4, text: 'Overlapping cue' },
  ]);
  assert.deepEqual(cuesForClip(cues, 400, 430), []);
  assert.match(toSrt(out), /^1\n00:00:00,000 --> 00:00:01,500\nBefore and across the cut\n/);
  assert.equal(formatSrtTime(3723.5), '01:02:03,500');
});

test('output sizes follow the ratio and quality', () => {
  assert.deepEqual(outputSize('9:16'), [1080, 1920]);
  assert.deepEqual(outputSize('16:9'), [1920, 1080]);
  assert.deepEqual(outputSize('1:1'), [1080, 1080]);
  assert.deepEqual(outputSize('4:5'), [1080, 1350]);
  assert.deepEqual(outputSize('9:16', '4k'), [2160, 3840]);
  assert.deepEqual(outputSize(undefined), [1080, 1920]);
});

test('fill crops to cover; fit letterboxes with blur, black or colour', () => {
  assert.deepEqual(layoutGraph({ layout: 'fill', position: 'top' }, 1080, 1920), [
    '[0:v]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920:(iw-ow)/2:0,unsharp=5:5:0.6:5:5:0.0,setsar=1[base]',
  ]);
  const blur = layoutGraph({ layout: 'fit', crop_ratio: '4:3' }, 1080, 1920);
  assert.equal(blur.length, 4);
  assert.match(blur[2], /crop=w='min\(iw,ih\*4\/3\)'.*scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,unsharp/);
  assert.match(layoutGraph({ layout: 'fit', background: 'color', background_color: '#112233' }, 1080, 1080)[0], /pad=1080:1080:\(ow-iw\)\/2:\(oh-ih\)\/2:color=0x112233\[base\]$/);
  assert.match(layoutGraph({ layout: 'fit', background: 'color', background_color: 'nope' }, 1080, 1080)[0], /color=black/);
});

test('captions match the frame shape and SRT cues use the caption style', () => {
  assert.match(buildAss([{ word: 'hi', start: 0, end: 0.5 }], 'viral', 1, undefined, { width: 1920, height: 1080 }), /PlayResY: 608/);
  const ass = buildAssFromCues([{ start: 0, end: 1.5, text: 'Line one\nline two' }], 'minimal', undefined, { width: 1080, height: 1080 });
  assert.match(ass, /PlayResY: 1080/);
  assert.match(ass, /Dialogue: 0,0:00:00\.00,0:00:01\.50,Default,,0,0,0,,.*Line one\\Nline two/);
});
