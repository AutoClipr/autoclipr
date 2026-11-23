import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { escapeFfmpegPath, runCommand } from './exec.util';
import { resolveBinary } from './resolve-binary.util';
import { layoutGraph, outputSize, type LayoutConfig } from './layout';

const QUALITY_PRESETS: Record<string, { crf: string; scale: string }> = {
  hd: { crf: '23', scale: '1080:1920' },
  full_hd: { crf: '20', scale: '1080:1920' },
  '4k': { crf: '18', scale: '2160:3840' },
};

/** Font directories libass should search (Alpine installs fonts under /usr/share/fonts). */
const SUBTITLE_FONT_DIRS = ['/usr/share/fonts'];

/**
 * Starter-plan watermark as a one-line ASS script: "Made with AutoClipr",
 * top-right, semi-transparent, shown for the whole clip.
 */
export function watermarkAss(width: number, height: number): string {
  const size = Math.round(height * 0.024);
  const margin = Math.round(height * 0.03);
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // &H4D = ~70% opaque white; soft dark shadow for legibility on bright frames.
    `Style: Mark,DejaVu Sans,${size},&H4DFFFFFF,&H4DFFFFFF,&H80000000,&H80000000,1,0,0,0,100,100,0,0,1,1,1,9,${margin},${margin},${margin},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:00.00,9:59:59.00,Mark,,0,0,0,,Made with AutoClipr',
    '',
  ].join('\n');
}

/** A brand logo burned into the clip. */
export type LogoOverlay = {
  path: string;
  position: string;
  /** Width as % of the frame width. */
  size: number;
  /** 0–1 */
  opacity: number;
};

/** Scale the logo to size% of the frame width (aspect preserved) and apply opacity. */
export function logoScaleFilter(frameWidth: number, logo: Pick<LogoOverlay, 'size' | 'opacity'>): string {
  const width = Math.max(16, Math.round((frameWidth * Math.min(40, Math.max(5, logo.size))) / 100));
  const opacity = Math.min(1, Math.max(0.1, logo.opacity));
  return `scale=${width}:-1,format=rgba,colorchannelmixer=aa=${opacity.toFixed(2)}`;
}

/** overlay x:y for a corner, with a margin of 4% of the frame width. */
export function logoPosition(frameWidth: number, frameHeight: number, position: string): string {
  const m = Math.round(frameWidth * 0.04);
  // Keep top logos clear of the platform UI strip at the very top.
  const top = Math.round(frameHeight * 0.05);
  const bottom = Math.round(frameHeight * 0.12);
  switch (position) {
    case 'top-left':
      return `x=${m}:y=${top}:shortest=1`;
    case 'bottom-left':
      return `x=${m}:y=H-h-${bottom}:shortest=1`;
    case 'bottom-right':
      return `x=W-w-${m}:y=H-h-${bottom}:shortest=1`;
    case 'top-right':
    default:
      return `x=W-w-${m}:y=${top}:shortest=1`;
  }
}

/** Output frame size for an export quality, as [width, height]. */
export function exportSize(exportQuality: string): [number, number] {
  const [w, h] = (QUALITY_PRESETS[exportQuality] ?? QUALITY_PRESETS.hd).scale.split(':').map(Number);
  return [w, h];
}

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
    watermark = false,
    logo?: LogoOverlay | null,
    layout?: LayoutConfig | null,
  ): Promise<void> {
    const preset = QUALITY_PRESETS[exportQuality] ?? QUALITY_PRESETS.hd;
    const startSec = (startMs / 1000).toFixed(3);
    const durationSec = ((endMs - startMs) / 1000).toFixed(3);
    // Output canvas from the chosen aspect ratio (default vertical 9:16).
    const [W, H] = outputSize(layout?.aspect_ratio, exportQuality);

    // Base frame, then an optional brand logo, then the Starter watermark on
    // top. The watermark is drawn with the `ass` filter (libass), the same
    // renderer the captions use; if it fails the render fails — never a
    // silently clean file.
    const graph: string[] = layoutGraph(layout ?? {}, W, H, '0:v', 'base');
    let last = 'base';
    if (logo) {
      graph.push(`[1:v]${logoScaleFilter(W, logo)}[lg]`, `[${last}][lg]overlay=${logoPosition(W, H, logo.position)}[withlogo]`);
      last = 'withlogo';
    }
    if (watermark) {
      const assPath = path.join(path.dirname(outputPath), `${path.basename(outputPath)}.watermark.ass`);
      await fs.writeFile(assPath, watermarkAss(W, H), 'utf8');
      graph.push(`[${last}]ass=${escapeFfmpegPath(assPath)}[marked]`);
      last = 'marked';
    }

    this.logger.log(`Cutting clip ${startSec}s +${durationSec}s → ${outputPath}${logo ? ' (+logo)' : ''}`);

    await runCommand(this.ffmpeg, [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-y',
      '-ss',
      startSec,
      '-i',
      videoPath,
      ...(logo ? ['-loop', '1', '-i', logo.path] : []),
      '-t',
      durationSec,
      '-filter_complex',
      graph.join(';'),
      '-map',
      `[${last}]`,
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      preset.crf,
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

  /** Whether a media file has an audio stream. */
  async hasAudio(filePath: string): Promise<boolean> {
    try {
      const { stdout } = await runCommand(this.ffprobe, [
        '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', filePath,
      ]);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Re-encode a file to a fixed format (W×H, 30 fps, h264/aac 44.1 kHz
   * stereo) so pieces can be joined with the concat demuxer. Letterboxes to
   * keep aspect ratio; adds silence when the file has no audio; trims to
   * maxSeconds when given.
   */
  async normalizeForConcat(
    input: string,
    output: string,
    W: number,
    H: number,
    maxSeconds?: number,
    /** Keep the last maxSeconds instead of the first (outros). */
    fromEnd = false,
  ): Promise<void> {
    const audio = await this.hasAudio(input);
    // -sseof seeks relative to the end; a file shorter than that just plays whole.
    const tail = fromEnd && maxSeconds ? ['-sseof', `-${maxSeconds}`] : [];
    const vf = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p`;
    await runCommand(this.ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      ...tail,
      '-i', input,
      ...(audio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']),
      ...(maxSeconds ? ['-t', String(maxSeconds)] : []),
      '-map', '0:v:0',
      '-map', audio ? '0:a:0' : '1:a:0',
      '-vf', vf,
      '-af', 'aresample=44100,aformat=channel_layouts=stereo',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
      '-c:a', 'aac', '-b:a', '128k',
      '-shortest',
      '-movflags', '+faststart',
      output,
    ]);
  }

  /**
   * Put an intro and/or outro around a finished clip. Every piece is first
   * normalised to the clip's frame size so the join is a plain stream copy.
   */
  async addBumpers(
    clipPath: string,
    outputPath: string,
    opts: { intro?: string | null; outro?: string | null; width: number; height: number; maxBumperSeconds: number; workDir: string },
  ): Promise<void> {
    const base = path.join(opts.workDir, `${path.basename(clipPath, '.mp4')}`);
    const parts: string[] = [];
    if (opts.intro) {
      parts.push(`${base}.intro.mp4`);
      await this.normalizeForConcat(opts.intro, `${base}.intro.mp4`, opts.width, opts.height, opts.maxBumperSeconds);
    }
    parts.push(`${base}.body.mp4`);
    await this.normalizeForConcat(clipPath, `${base}.body.mp4`, opts.width, opts.height);
    if (opts.outro) {
      parts.push(`${base}.outro.mp4`);
      await this.normalizeForConcat(opts.outro, `${base}.outro.mp4`, opts.width, opts.height, opts.maxBumperSeconds, true);
    }
    const list = `${base}.concat.txt`;
    await fs.writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
    await runCommand(this.ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', list,
      '-c', 'copy', '-movflags', '+faststart',
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
