import { summarizeSrt } from './srt';

describe('summarizeSrt', () => {
  it('counts valid cues, skips bad ones, sorts and previews', () => {
    const s = summarizeSrt('﻿2\r\n00:00:05,000 --> 00:00:06,000\r\n<b>Second</b>\r\n\r\n1\r\n00:00:01.5 --> 00:00:02,000\r\nFirst\r\n\r\n3\r\n00:00:09,000 --> 00:00:08,000\r\nBackwards\r\n\r\n4\r\n00:61:00,000 --> 00:62:00,000\r\nBad minutes\r\n\r\nno times\r\n');
    expect(s).toMatchObject({ cues: 2, skipped: 3, lastEnd: 6 });
    expect(s.first.map((c) => c.text)).toEqual(['First', 'Second']);
  });

  it('handles empty input', () => {
    expect(summarizeSrt('')).toEqual({ cues: 0, skipped: 0, first: [], lastEnd: 0 });
  });
});
