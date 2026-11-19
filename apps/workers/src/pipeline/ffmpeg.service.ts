import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { escapeFfmpegPath, runCommand } from './exec.util';
import { resolveBinary } from './resolve-binary.util';

const QUALITY_PRESETS: Record<string, { crf: string; scale: string }> = {
  hd: { crf: '23', scale: '1080:1920' },
  full_hd: { crf: '20', scale: '1080:1920' },
  '4k': { crf: '18', scale: '2160:3840' },
};

/** Font directories libass should search (Alpine installs fonts under /usr/share/fonts). */
const SUBTITLE_FONT_DIRS = ['/usr/share/fonts'];

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);
  private readonly ffmpeg: string;
  private readonly ffprobe: string;

  constructor(private readonly config: ConfigService) {
    this.ffmpeg = resolveBinary(this.config.get<string>('ffmpegPath'), 'ffmpeg');
    this.ffprobe = resolveBinary(this.config.get<string>('ffprobePath'), 'ffprobe');
    this.logger.log(`ffmpeg binary: ${this.ffmpeg}`);
  }

  async getDurationSeconds(videoPath: string): Promise<number> {
    const { stdout } = await runCommand(this.ffprobe, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ]);
    const sec = parseFloat(stdout.trim());
    if (!Number.isFinite(sec) || sec <= 0) {
      throw new Error('Could not read video duration');
    }
    return Math.round(sec);
  }

  async extractAudio(videoPath: string, audioPath: string): Promise<void> {
    this.logger.log(`Extracting audio → ${audioPath}`);
    await runCommand(this.ffmpeg, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      videoPath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-b:a',
      '32k',
      audioPath,
    ]);
  }

  async extractThumbnail(videoPath: string, thumbPath: string, atSeconds = 3): Promise<void> {
    await runCommand(this.ffmpeg, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(atSeconds),
      '-i',
      videoPath,
      '-vframes',
      '1',
      '-q:v',
      '2',
      thumbPath,
    ]);
  }

  async cutClip(
    videoPath: string,
    outputPath: string,
    startMs: number,
    endMs: number,
    exportQuality = 'hd',
  ): Promise<void> {
    const preset = QUALITY_PRESETS[exportQuality] ?? QUALITY_PRESETS.hd;
    const startSec = (startMs / 1000).toFixed(3);
    const durationSec = ((endMs - startMs) / 1000).toFixed(3);
    const [w, h] = preset.scale.split(':');

    const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;

    this.logger.log(`Cutting clip ${startSec}s +${durationSec}s → ${outputPath}`);

    await runCommand(this.ffmpeg, [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-y',
      '-ss',
      startSec,
      '-i',
      videoPath,
      '-t',
      durationSec,
      '-vf',
      vf,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      preset.crf,
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-threads',
      '2',
      outputPath,
    ]);
  }

  async burnCaptions(
    inputPath: string,
    captionsPath: string,
    outputPath: string,
    captionStyle: string,
  ): Promise<void> {
    const escaped = escapeFfmpegPath(captionsPath);
    const attempts = this.buildSubtitleFilterAttempts(escaped, captionStyle);

    for (const [label, vf] of attempts) {
      try {
        this.logger.log(`Burning captions (${label}) → ${outputPath}`);
        await runCommand(this.ffmpeg, [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          inputPath,
          '-vf',
          vf,
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '23',
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-c:a',
          'copy',
          '-movflags',
          '+faststart',
          outputPath,
        ]);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Caption burn attempt "${label}" failed: ${message}`);
      }
    }

    this.logger.warn('All caption burn attempts failed — exporting clip without burned captions');
    await fs.copyFile(inputPath, outputPath);
  }

  /**
   * Captions are an ASS file that carries its own styles and animation, so
   * the `ass` filter renders them as designed. Falls back to `subtitles`
   * (which also reads ASS) if the first form isn't available.
   */
  private buildSubtitleFilterAttempts(
    escapedPath: string,
    _captionStyle: string,
  ): Array<[string, string]> {
    const attempts: Array<[string, string]> = [];
    for (const fontsDir of SUBTITLE_FONT_DIRS) {
      attempts.push([`ass:${fontsDir}`, `ass=${escapedPath}:fontsdir=${escapeFfmpegPath(fontsDir)}`]);
    }
    attempts.push(['ass', `ass=${escapedPath}`]);
    attempts.push(['subtitles', `subtitles=${escapedPath}`]);
    return attempts;
  }

}
