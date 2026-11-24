import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportUrlDto } from './import-url.dto';
import { CompleteUploadDto } from './complete-upload.dto';
import { EnhancementsDto } from './enhancements.dto';

const ALL = {
  motion_graphics: { progress_bar: true, keywords: true, color: '#54D045' },
  ai_emojis: { density: 'high', position: 'corner' },
  speech_cleanup: { pauses: true, fillers: true, max_pause: 0.6 },
  enhance_audio: { noise: 'strong' },
  auto_sfx: { intensity: 'bold', volume: 70 },
  auto_zoom: { strength: 'medium' },
  transitions: { style: 'wipe', duration: 0.4 },
  color_correction: { preset: 'warm' },
  voice_dubbing: { language: 'es' },
  caption_translation: { language: 'es' },
};

describe('request DTOs with layout, hook and enhancements', () => {
  it('accepts every enhancement with valid settings', async () => {
    const dto = plainToInstance(EnhancementsDto, ALL);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects bad enhancement settings', async () => {
    const dto = plainToInstance(EnhancementsDto, {
      ai_emojis: { density: 'tons' },
      speech_cleanup: { max_pause: 9 },
      auto_sfx: { volume: 500 },
      transitions: { style: 'spin' },
      voice_dubbing: { language: 'klingon' },
      motion_graphics: { color: 'green' },
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property).sort()).toEqual(['ai_emojis', 'auto_sfx', 'motion_graphics', 'speech_cleanup', 'transitions', 'voice_dubbing']);
  });

  it.each([
    ['import-url', ImportUrlDto, { url: 'https://youtube.com/watch?v=abc' }],
    ['complete-upload', CompleteUploadDto, {}],
  ])('%s validates nested layout, hook and enhancements', async (_name, Cls, base) => {
    const ok = plainToInstance(Cls as never, {
      ...base,
      layout: { aspect_ratio: '16:9', layout: 'fit', background: 'blur' },
      hook: { kind: 'viral', template_id: 'halo', placement: 'overlay', duration: 3 },
      enhancements: ALL,
    });
    expect(await validate(ok as object)).toHaveLength(0);
    const bad = plainToInstance(Cls as never, {
      ...base,
      layout: { aspect_ratio: '3:2' },
      hook: { kind: 'viral', template_id: 'nope' },
      enhancements: { auto_zoom: { strength: 'extreme' } },
    });
    const props = (await validate(bad as object)).map((e) => e.property).sort();
    expect(props).toEqual(['enhancements', 'hook', 'layout']);
  });
});
