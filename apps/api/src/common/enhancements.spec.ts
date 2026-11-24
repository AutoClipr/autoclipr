import { ENHANCEMENTS, enhancementAllowed, estimateEnhancementCredits, settleEnhancementCredits } from './enhancements';

describe('enhancements', () => {
  it('has four groups and the spec prices', () => {
    expect(new Set(ENHANCEMENTS.map((e) => e.group))).toEqual(new Set(['creative', 'sound', 'look', 'translate']));
    const price = Object.fromEntries(ENHANCEMENTS.map((e) => [e.id, e.creditsPerMinute]));
    expect(price).toMatchObject({ motion_graphics: 6, enhance_audio: 6, auto_sfx: 7, voice_dubbing: 10, ai_emojis: 0 });
  });

  it('estimates at whole minutes and settles to real lengths', () => {
    expect(estimateEnhancementCredits(['enhance_audio', 'auto_sfx'], 5, 90)).toEqual({ perMinute: 13, credits: 130 });
    expect(estimateEnhancementCredits(['ai_emojis'], 5, 30)).toEqual({ perMinute: 0, credits: 0 });
    expect(settleEnhancementCredits(13, [45, 61, 20])).toBe(13 + 26 + 13);
  });

  it('gates premium and unbuilt features', () => {
    const zoom = ENHANCEMENTS.find((e) => e.id === 'auto_zoom')!;
    const eye = ENHANCEMENTS.find((e) => e.id === 'eye_contact')!;
    const emojis = ENHANCEMENTS.find((e) => e.id === 'ai_emojis')!;
    expect(enhancementAllowed('basic', zoom)).toBe(false);
    expect(enhancementAllowed('all', zoom)).toBe(true);
    expect(enhancementAllowed('all', eye)).toBe(false);
    expect(enhancementAllowed('basic', emojis)).toBe(true);
  });
});
