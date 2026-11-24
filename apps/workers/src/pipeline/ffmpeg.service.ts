import { existsSync } from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { escapeFfmpegPath, runCommand } from './exec.util';
import { resolveBinary } from './resolve-binary.util';
import { layoutGraph, outputSize, type LayoutConfig } from './layout';

/** Near-lossless CRF for files that are re-encoded later. */
const INTERMEDIATE_CRF = '14';

const QUALITY_PRESETS: Record<string, { crf: string; scale: string }> = {
  hd: { crf: '20', scale: '1080:1920' },
  full_hd: { crf: '18', scale: '1080:1920' },
  '4k': { crf: '17', scale: '2160:3840' },
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

/** A silent stereo track of `seconds` (base for mixes when the clip has no audio). */
const silence = (seconds: number) => `anullsrc=r=44100:cl=stereo,atrim=duration=${Math.max(0.1, seconds).toFixed(3)}`;

/** An image shown from t to end, popping in, centred at (x, y) on the frame. */
export type ImageOverlay = { path: string; t: number; end: number; x: number; y: number; size: number };

/**
 * Caption filter plus image overlays as one filter_complex ending in [vout].
 * Each image scales from 20% to 115% to 100% (pop) and fades out.
 */
export function overlayGraph(captionVf: string, overlays: ImageOverlay[]): { inputs: string[]; graph: string | null } {
  if (!overlays.length) return { inputs: [], graph: null };
  const inputs: string[] = [];
  const parts = [`[0:v]${captionVf}[c0]`];
  overlays.forEach((o, i) => {
    inputs.push('-loop', '1', '-t', (o.end + 0.1).toFixed(2), '-i', o.path);
    const a = o.t.toFixed(2);
    const grow = `min(1.15\,0.2+0.95*(t-${a})/0.16)`;
    const settle = `if(gt(t-${a}\,0.16)\,max(1\,1.15-(t-${a}-0.16)/0.1*0.15)\,${grow})`;
    parts.push(
      `[${i + 1}:v]format=rgba,scale=w='${o.size}*${settle}':h=-1:eval=frame,fade=t=out:st=${(o.end - 0.2).toFixed(2)}:d=0.2:alpha=1[e${i}]`,
      `[c${i}][e${i}]overlay=x='${o.x}-w/2':y='${o.y}-h/2':enable='between(t,${a},${o.end.toFixed(2)})':eval=frame[c${i + 1}]`,
    );
  });
  parts.push(`[c${overlays.length}]format=yuv420p[vout]`);
  return { inputs, graph: parts.join(';') };
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
    /** Extra filters after framing (colour, zoom) and for the audio (cleanup). */
    extra: { video?: string[]; audio?: string | null } = {},
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
    if (extra.video?.length) {
      graph.push(`[base]${extra.video.join(',')},format=yuv420p[fx]`);
      last = 'fx';
    }
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
      ...(extra.audio ? ['-af', extra.audio] : []),
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      // Intermediate file: captions are burned in a second pass, so keep this
      // one near-lossless and let the final pass set the export quality.
      '-crf',
      INTERMEDIATE_CRF,
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
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
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
    opts: {
      intro?: string | null; outro?: string | null; width: number; height: number; maxBumperSeconds: number; workDir: string;
      /** xfade transition name and seconds; joins with a plain cut when absent. */
      transition?: { name: string; seconds: number } | null;
    },
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
    if (opts.transition && parts.length > 1) {
      await this.joinWithTransition(parts, outputPath, opts.transition);
      return;
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

  /**
   * Opening hook card: background from the clip (or a colour), hook text
   * burned from an ASS file, a synthesised sound effect (or silence).
   * Output matches the concat format of normalizeForConcat.
   */
  async renderHookCard(opts: {
    clipPath: string;
    assPath: string;
    outputPath: string;
    width: number;
    height: number;
    seconds: number;
    clipSeconds: number;
    background: string;
    sfx: string | null;
  }): Promise<void> {
    const { width: W, height: H, seconds } = opts;
    const fontsDir = SUBTITLE_FONT_DIRS.find((d) => existsSync(d));
    const ass = `ass=${escapeFfmpegPath(opts.assPath)}${fontsDir ? `:fontsdir=${escapeFfmpegPath(fontsDir)}` : ''}`;
    const audio = opts.sfx
      ? `${opts.sfx},apad=whole_dur=${seconds}[a]`
      : `anullsrc=r=44100:cl=stereo,atrim=duration=${seconds}[a]`;
    await runCommand(this.ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', opts.clipPath,
      '-filter_complex', `${opts.background};[bg]${ass},format=yuv420p[v];${audio}`,
      '-map', '[v]', '-map', '[a]',
      '-t', String(seconds),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      opts.outputPath,
    ]);
  }

  /** Mix a sound effect into a clip's audio at `atSeconds`; video is copied. */
  async mixSfx(input: string, output: string, sfx: string, atSeconds = 0): Promise<void> {
    const audio = await this.hasAudio(input);
    const delay = Math.round(atSeconds * 1000);
    const fx = `${sfx},adelay=${delay}|${delay}[fx]`;
    const graph = audio
      ? `${fx};[0:a]aresample=44100,aformat=channel_layouts=stereo[a0];[a0][fx]amix=inputs=2:duration=first:normalize=0[a]`
      : `${fx};${silence(await this.durationOf(input))}[a0];[a0][fx]amix=inputs=2:duration=first:normalize=0[a]`;
    await runCommand(this.ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', input,
      '-filter_complex', graph,
      '-map', '0:v:0', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      output,
    ]);
  }

  /**
   * Speech cleanup: keep only the given clip-relative intervals of
   * [startSec, startSec+durationSec] and join them, with 15 ms audio fades so
   * cuts don't click. Near-lossless: it is re-encoded by cutClip.
   */
  async cutSegments(input: string, output: string, startSec: number, durationSec: number, keep: [number, number][]): Promise<void> {
    const audio = await this.hasAudio(input);
    const parts: string[] = [];
    keep.forEach(([a, b], i) => {
      parts.push(`[0:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
      if (audio) {
        parts.push(`[0:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=${Math.max(0, b - a - 0.015).toFixed(3)}:d=0.015[a${i}]`);
      }
    });
    const n = keep.length;
    const concat = keep.map((_, i) => `[v${i}]${audio ? `[a${i}]` : ''}`).join('') + `concat=n=${n}:v=1:a=${audio ? 1 : 0}[v]${audio ? '[a]' : ''}`;
    await runCommand(this.ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', startSec.toFixed(3), '-t', durationSec.toFixed(3), '-i', input,
      '-filter_complex', `${parts.join(';')};${concat}`,
      '-map', '[v]', ...(audio ? ['-map', '[a]'] : []),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', INTERMEDIATE_CRF,
      ...(audio ? ['-c:a', 'aac', '-b:a', '192k'] : []),
      '-movflags', '+faststart',
      output,
    ]);
  }

  /** Mix several sound effects (lavfi sources) at their times; video is copied. */
  async mixSfxEvents(input: string, output: string, events: { t: number; src: string }[], volume = 1): Promise<void> {
    if (!events.length) return fs.copyFile(input, output);
    const audio = await this.hasAudio(input);
    const fx = events.map((e, i) => {
      const ms = Math.round(e.t * 1000);
      return `${e.src},volume=${volume.toFixed(2)},adelay=${ms}|${ms}[s${i}]`;
    });
    const labels = events.map((_, i) => `[s${i}]`).join('');
    // No source audio: the effects become the track, padded to the video's length.
    const graph = audio
      ? `${fx.join(';')};[0:a]aresample=44100,aformat=channel_layouts=stereo[a0];[a0]${labels}amix=inputs=${events.length + 1}:duration=first:normalize=0[a]`
      : `${fx.join(';')};${silence(await this.durationOf(input))}[a0];[a0]${labels}amix=inputs=${events.length + 1}:duration=first:normalize=0[a]`;
    await runCommand(this.ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
      '-filter_complex', graph, '-map', '0:v:0', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart', output,
    ]);
  }

  /**
   * Voice dubbing mixdown: each dubbed line starts at its time and is sped up
   * (max 1.6×) to fit its slot; the original track stays underneath, ducked,
   * so music and room sound remain. Video is copied.
   */
  async mixDub(input: string, output: string, lines: { path: string; t: number; tempo: number }[], originalVolume = 0.18): Promise<void> {
    const audio = await this.hasAudio(input);
    const ins: string[] = [];
    const parts: string[] = [];
    lines.forEach((l, i) => {
      ins.push('-i', l.path);
      const ms = Math.round(l.t * 1000);
      const tempo = Math.min(1.6, Math.max(1, l.tempo));
      parts.push(`[${i + 1}:a]aresample=44100,aformat=channel_layouts=stereo,atempo=${tempo.toFixed(3)},adelay=${ms}|${ms}[d${i}]`);
    });
    const labels = lines.map((_, i) => `[d${i}]`).join('');
    const graph = audio
      ? `${parts.join(';')};[0:a]aresample=44100,aformat=channel_layouts=stereo,volume=${originalVolume}[bg];[bg]${labels}amix=inputs=${lines.length + 1}:duration=first:normalize=0,alimiter=limit=0.95[a]`
      : `${parts.join(';')};${silence(await this.durationOf(input))}[bg];[bg]${labels}amix=inputs=${lines.length + 1}:duration=first:normalize=0[a]`;
    await runCommand(this.ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', input, ...ins,
      '-filter_complex', graph, '-map', '0:v:0', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest',
      '-movflags', '+faststart', output,
    ]);
  }

  /** Duration of a media file in seconds (0 if unknown). */
  async durationOf(file: string): Promise<number> {
    try {
      const { stdout } = await runCommand(this.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
      return Number(String(stdout).trim()) || 0;
    } catch {
      return 0;
    }
  }

  /** Join normalised parts with xfade/acrossfade (each overlap shortens the total by `seconds`). */
  async joinWithTransition(parts: string[], outputPath: string, t: { name: string; seconds: number }): Promise<void> {
    const durs = await Promise.all(parts.map((p) => this.durationOf(p)));
    const d = Math.min(t.seconds, ...durs.map((x) => Math.max(0.1, x / 2 - 0.05)));
    const ins = parts.flatMap((p) => ['-i', p]);
    const g: string[] = [];
    let v = '0:v';
    let a = '0:a';
    let offset = 0;
    for (let i = 1; i < parts.length; i++) {
      offset += durs[i - 1] - d;
      g.push(`[${v}][${i}:v]xfade=transition=${t.name}:duration=${d.toFixed(3)}:offset=${offset.toFixed(3)}[v${i}]`);
      g.push(`[${a}][${i}:a]acrossfade=d=${d.toFixed(3)}[a${i}]`);
      v = `v${i}`;
      a = `a${i}`;
    }
    await runCommand(this.ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', ...ins,
      '-filter_complex', g.join(';'), '-map', `[${v}]`, '-map', `[${a}]`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart', outputPath,
    ]);
  }

  async burnCaptions(
    inputPath: string,
    captionsPath: string,
    outputPath: string,
    captionStyle: string,
    /** Export quality: this is the final encode, so it sets the file quality. */
    exportQuality = 'hd',
    /** Images (e.g. colour emojis) popped in over the video in the same pass. */
    overlays: ImageOverlay[] = [],
  ): Promise<void> {
    const crf = (QUALITY_PRESETS[exportQuality] ?? QUALITY_PRESETS.hd).crf;
    const escaped = escapeFfmpegPath(captionsPath);
    const attempts = this.buildSubtitleFilterAttempts(escaped, captionStyle);

    for (const [label, vf] of attempts) {
      try {
        this.logger.log(`Burning captions (${label}) → ${outputPath}`);
        const ov = overlayGraph(vf, overlays);
        await runCommand(this.ffmpeg, [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          inputPath,
          ...ov.inputs,
          ...(ov.graph ? ['-filter_complex', ov.graph] : ['-vf', vf]),
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          crf,
          '-map',
          ov.graph ? '[vout]' : '0:v:0',
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
