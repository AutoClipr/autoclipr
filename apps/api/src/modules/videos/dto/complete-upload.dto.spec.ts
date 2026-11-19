import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteUploadDto } from './complete-upload.dto';

const check = (body: object) => validate(plainToInstance(CompleteUploadDto, body));

describe('CompleteUploadDto', () => {
  it('accepts an empty body', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it('accepts valid options', async () => {
    expect(
      await check({
        clip_count: 10,
        durations: [15, 30],
        caption_style: 'emoji',
        caption_language: 'es',
        platforms: ['tiktok'],
        export_quality: 'full_hd',
      }),
    ).toHaveLength(0);
  });

  it('rejects out-of-range or unknown values', async () => {
    const errors = await check({ clip_count: 50, caption_style: 'comic', export_quality: '8k' });
    expect(errors.map((e) => e.property).sort()).toEqual(['caption_style', 'clip_count', 'export_quality']);
  });
});
