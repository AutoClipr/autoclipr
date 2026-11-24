import { toUserMessage, withUserMessage } from './user-error.util';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MonitoringService, NR_EVENTS } from '@autoclipr/monitoring';
import { EmailService } from '@autoclipr/emails';
import { PipelineLogger } from '../common/pipeline-logger.util';
import { DatabaseService } from '../database/database.service';
import { CaptionService } from './caption.service';
import { FfmpegService } from './ffmpeg.service';
import { HookAnalysisService } from './hook-analysis.service';
import { TempFilesService } from './temp-files.service';
import type { BrandRenderConfig, PipelineStep, UrlPipelinePayload, ViralMoment } from './types';
import { type LogoOverlay } from './ffmpeg.service';
import { outputSize, type LayoutConfig } from './layout';
import { cuesForClip, parseSrt, shiftCues, toSrt, type SrtCue } from './srt';
import { buildHookAss, cardBackground, mergeAss, resolveSpec, sfxSource, type HookConfig, type HookSpec } from './hooks';
import { buildAssFromCues } from './caption-styles';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkersStorageService } from './storage.service';
import { WhisperService } from './whisper.service';
import { YtdlpService } from './ytdlp.service';

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
  youtube: 'YouTube Shorts',
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
};

@Injectable()
export class UrlPipelineService {
  private readonly logger = new Logger(UrlPipelineService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly temp: TempFilesService,
    private readonly ytdlp: YtdlpService,
    private readonly ffmpeg: FfmpegService,
    private readonly whisper: WhisperService,
    private readonly hooks: HookAnalysisService,
    private readonly captions: CaptionService,
    private readonly storage: WorkersStorageService,
    private readonly monitoring: MonitoringService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async run(data: UrlPipelinePayload, jobId?: string): Promise<void> {
    const videoId = data.video_id;
    const sourceUrl = data.source_url;
    const clipCount = data.clip_count ?? 10;
    const durations = data.durations ?? [15, 30, 45, 60];
    const captionStyle = data.caption_style ?? 'viral';
    const captionLanguage = data.caption_language ?? 'en';
    const platforms = data.platforms ?? ['tiktok', 'instagram', 'youtube', 'linkedin'];
    const exportQuality = data.export_quality ?? 'hd';
    const maxVideoSeconds = typeof data.max_video_seconds === 'number' ? data.max_video_seconds : 0;
    const watermark = data.watermark === true;
    const brand = data.brand ?? null;
    const layout = data.layout ?? null;

    const userRes = await this.db.client.query(
      `SELECT user_id, title, storage_path, source_url FROM videos WHERE id = $1`,
      [videoId],
    );
    const videoRow = userRes.rows[0];
    const userId = videoRow?.user_id as string | undefined;
    const existingStoragePath = videoRow?.storage_path as string | undefined;
    if (!userId) throw new Error('Video not found');

    const plog = new PipelineLogger(this.logger, videoId, jobId, this.monitoring, userId);
    const pipelineStarted = Date.now();
    plog.stepStart('pipeline', {
      source_url: sourceUrl,
      clip_count: clipCount,
      export_quality: exportQuality,
    });

    const isRemoteUrl = /^https?:\/\//i.test(sourceUrl);

    const workDir = await this.temp.createJobDir(videoId);
    const sourceVideoPath = this.temp.jobPath(workDir, 'source.mp4');
    const audioPath = this.temp.jobPath(workDir, 'audio.mp3');
    const thumbPath = this.temp.jobPath(workDir, 'thumb.jpg');

    const steps: PipelineStep[] = [
      { id: 'download', label: 'Download video', status: 'pending' },
      {
        id: 'analyze',
        label: 'AI analysis',
        status: 'pending',
        checks: [
          'Extract audio',
          'Generate transcript',
          'Detect speakers',
          'Identify viral moments',
          'Detect hooks',
          'Analyze engagement patterns',
          'Detect scene changes',
        ],
      },
      { id: 'clips', label: 'Generate shorts', status: 'pending' },
      { id: 'captions', label: 'AI captions', status: 'pending' },
      { id: 'export', label: 'Export & publish', status: 'pending' },
    ];

    try {
      // ── Step 1: yt-dlp download ─────────────────────────────────────
      const downloadStarted = Date.now();
      plog.stepStart('download', { remote: isRemoteUrl });
      steps[0].status = 'active';
      await this.updateProgress(jobId, 5, 1, steps);
      await this.db.client.query(`UPDATE videos SET status = 'importing' WHERE id = $1`, [
        videoId,
      ]);

      let meta: { title?: string } = {};
      let videoStoragePath = existingStoragePath ?? '';

      if (isRemoteUrl) {
        meta = await this.ytdlp.download(sourceUrl, sourceVideoPath);
        // Source stays on worker disk only — Supabase free tier allows 50 MB per file.
        videoStoragePath = this.storage.urlImportPath(videoId);
        this.logger.log(
          `Skipping source upload (${this.storage.formatBytes(await this.storage.getLocalFileSize(sourceVideoPath))} local). ` +
            `Clips only are stored in Supabase.`,
        );
      } else {
        if (!existingStoragePath || this.storage.isUrlImportPath(existingStoragePath)) {
          throw new Error('Video has no storage_path — upload the file first');
        }
        this.logger.log(`Loading from Supabase storage: ${existingStoragePath}`);
        await this.storage.downloadToFile(
          this.storage.bucketVideos(),
          existingStoragePath,
          sourceVideoPath,
        );
        videoStoragePath = existingStoragePath;
      }

      const durationSeconds = await this.ffmpeg.getDurationSeconds(sourceVideoPath);

      // Plan limit, checked before any AI work. Throwing here fails the job
      // and the catch below refunds the credits charged at submission.
      if (maxVideoSeconds > 0 && durationSeconds > maxVideoSeconds + 5) {
        const mins = Math.round(maxVideoSeconds / 60);
        throw withUserMessage(
          new Error(`Source is ${Math.round(durationSeconds)}s; plan limit ${maxVideoSeconds}s`),
          `This video is longer than your plan allows (up to ${mins} minutes). Your credits were refunded — trim the video or upgrade your plan.`,
        );
      }

      await this.ffmpeg.extractThumbnail(sourceVideoPath, thumbPath, 2);
      let thumbUrl: string | null = null;
      try {
        const thumbStoragePath = this.storage.objectPath(
          userId,
          'thumbs',
          `${videoId}.jpg`,
        );
        await this.storage.uploadLocalFile(
          this.storage.bucketVideos(),
          thumbStoragePath,
          thumbPath,
          'image/jpeg',
        );
        thumbUrl = this.storage.getPublicUrl(this.storage.bucketVideos(), thumbStoragePath);
      } catch (err) {
        this.logger.warn(`Thumbnail upload skipped: ${err}`);
      }

      await this.db.client.query(
        `UPDATE videos SET storage_path = $1, duration_seconds = $2, status = 'processing',
         thumbnail_url = $3, title = COALESCE(NULLIF($4, ''), title) WHERE id = $5`,
        [
          videoStoragePath,
          durationSeconds,
          thumbUrl,
          meta.title ?? null,
          videoId,
        ],
      );

      steps[0].status = 'completed';
      plog.stepDone('download', Date.now() - downloadStarted, {
        duration_seconds: durationSeconds,
        title: meta.title,
      });
      await this.updateProgress(jobId, 20, 1, steps);

      // ── Step 2: FFmpeg audio + Whisper + GPT hooks ──────────────────
      const analyzeStarted = Date.now();
      plog.stepStart('analyze');
      steps[1].status = 'active';
      await this.updateProgress(jobId, 25, 2, steps);
      await this.db.client.query(`UPDATE videos SET status = 'analyzing' WHERE id = $1`, [
        videoId,
      ]);

      await this.ffmpeg.extractAudio(sourceVideoPath, audioPath);
      const transcript = await this.whisper.transcribe(audioPath, captionLanguage, {
        durationSeconds,
      });

      const hookStarted = Date.now();
      const moments = await this.hooks.identifyMoments(
        transcript,
        durationSeconds,
        clipCount,
        durations,
      );

      this.monitoring.recordEvent(NR_EVENTS.HOOK_GENERATED, {
        userId,
        videoId,
        provider: this.hooks.getProviderLabel(),
        latency: Date.now() - hookStarted,
        tokens: moments.length,
      });

      const analysis = {
        source_url: sourceUrl,
        transcript_ready: !transcript.fallback,
        transcript_fallback: transcript.fallback ?? false,
        transcript_warning: transcript.fallback_reason ?? null,
        hook_analysis_provider: this.hooks.getProviderLabel(),
        transcript_preview: transcript.text.slice(0, 500),
        language: transcript.language ?? captionLanguage,
        speakers_detected: this.estimateSpeakers(transcript.text),
        viral_moments: moments.length,
        hooks_found: moments.filter((m) => m.hook_text.length > 10).length,
        scene_changes: Math.max(1, Math.floor(durationSeconds / 12)),
        engagement_score: this.avgScore(moments) / 100,
        segments_count: transcript.segments.length,
      };

      await this.db.client.query(
        `UPDATE videos SET analysis = $1::jsonb WHERE id = $2`,
        [JSON.stringify(analysis), videoId],
      );

      steps[1].status = 'completed';
      plog.stepDone('analyze', Date.now() - analyzeStarted, {
        segments: transcript.segments.length,
        moments: moments.length,
        transcript_fallback: transcript.fallback ?? false,
        hook_provider: this.hooks.getProviderLabel(),
      });
      await this.updateProgress(jobId, 45, 2, steps, analysis);

      // ── Step 3–5: Cut clips, burn captions, upload ───────────────────
      const clipsStarted = Date.now();
      plog.stepStart('clips', { count: moments.length });
      steps[2].status = 'active';
      await this.updateProgress(jobId, 50, 3, steps, analysis);

      const brandAssets = brand ? await this.loadBrandAssets(brand, workDir, plog) : null;
      const srtCues = data.subtitle_srt_path ? await this.loadSrt(data.subtitle_srt_path, workDir) : null;

      const clipIds: string[] = [];
      for (let i = 0; i < moments.length; i++) {
        const moment = moments[i];
        const clipId = await this.renderAndUploadClip({
          workDir,
          userId,
          videoId,
          index: i,
          moment,
          sourceVideoPath,
          transcript: transcript.segments,
          captionStyle,
          captionLanguage,
          platforms,
          exportQuality,
          watermark,
          brand: brandAssets,
          layout,
          srtCues,
          hook: data.hook ?? null,
        });
        clipIds.push(clipId);

        const pct = 50 + Math.floor(((i + 1) / moments.length) * 40);
        await this.updateProgress(jobId, pct, 3, steps, analysis, i + 1);
      }

      steps[2].status = 'completed';
      steps[3].status = 'completed';
      steps[4].status = 'active';
      plog.stepDone('clips', Date.now() - clipsStarted, { clip_ids: clipIds });
      await this.updateProgress(jobId, 95, 5, steps, analysis, moments.length);

      steps[4].status = 'completed';
      await this.db.client.query(`UPDATE videos SET status = 'ready' WHERE id = $1`, [videoId]);

      // Credits were already charged atomically by the API before this job was
      // queued (see VideosService.importFromUrl). Nothing to deduct here — the
      // old post-completion deduction silently no-opped when the balance had
      // since dropped, handing out the finished clips for free.

      // Send clip-ready email (non-blocking)
      void this.sendClipReadyEmail(userId, videoId, videoRow.title as string, moments.length);

      plog.stepDone('pipeline', Date.now() - pipelineStarted, {
        clips_created: moments.length,
        status: 'ready',
      });

      this.monitoring.recordEvent(NR_EVENTS.VIDEO_PROCESSING_COMPLETED, {
        userId,
        videoId,
        jobId,
        processingTime: Date.now() - pipelineStarted,
        duration: durationSeconds,
        clipsCreated: moments.length,
      });

      const platformLabels = platforms.map((p) => PLATFORM_LABELS[p] ?? p);
      const finalResult = {
        current_step: 5,
        progress_percent: 100,
        steps,
        analysis: {
          ...analysis,
          caption_style: captionStyle,
          caption_language: captionLanguage,
          platforms: platformLabels,
          export_resolution: exportQuality === '4k' ? '2160x3840' : '1080x1920',
          export_quality: exportQuality,
          clip_ids: clipIds,
        },
        clips_created: moments.length,
        auto_publish: data.auto_publish ?? false,
        publish_targets: platformLabels,
      };

      if (jobId) {
        await this.db.client.query(
          `UPDATE processing_jobs SET status = 'completed', result = $1::jsonb, completed_at = NOW() WHERE id = $2`,
          [JSON.stringify(finalResult), jobId],
        );
      }
    } catch (err) {
      plog.stepFail('pipeline', 0, err);
      await this.markPipelineFailed(jobId, steps, err);

      // Credits were taken up front, before this job was queued. The user got
      // nothing usable, so hand them back.
      const creditCost = (data as Record<string, unknown>).credit_cost as number | undefined;
      if (userId && creditCost && creditCost > 0) {
        await this.refundCredits(userId, creditCost, 'url_import_pipeline_failed', videoId);
      }

      throw err;
    } finally {
      await this.temp.cleanup(workDir);
    }
  }

  private async markPipelineFailed(
    jobId: string | undefined,
    steps: PipelineStep[],
    err: unknown,
  ) {
    const activeIdx = steps.findIndex((s) => s.status === 'active');
    if (activeIdx >= 0) {
      steps[activeIdx].status = 'failed';
    }
    if (!jobId) return;

    // Users see a friendly message; the full detail is logged by the job processor.
    const message = toUserMessage(err);
    await this.db.client.query(
      `UPDATE processing_jobs SET result = $1::jsonb WHERE id = $2`,
      [
        JSON.stringify({
          current_step: activeIdx >= 0 ? activeIdx + 1 : null,
          progress_percent: 0,
          steps,
          error_message: message,
          failed_step: activeIdx >= 0 ? steps[activeIdx].id : null,
        }),
        jobId,
      ],
    );
  }

  /**
   * Download a brand kit's logo / intro / outro once per job. A missing or
   * broken asset is skipped (logged), never fatal: the clips still render.
   */
  private async loadBrandAssets(brand: BrandRenderConfig, workDir: string, plog: PipelineLogger): Promise<BrandAssets> {
    const fetch = async (p: string | null, name: string) => {
      if (!p) return null;
      const dest = this.temp.jobPath(workDir, `brand_${name}${path.extname(p) || ''}`);
      try {
        await this.storage.downloadToFile(this.storage.bucketVideos(), p, dest);
        return dest;
      } catch (err) {
        this.logger.warn(`Brand ${name} unavailable (${p}): ${(err as Error).message}`);
        return null;
      }
    };
    const [logoFile, intro, outro] = await Promise.all([
      fetch(brand.logo_path, 'logo'),
      fetch(brand.intro_path, 'intro'),
      fetch(brand.outro_path, 'outro'),
    ]);
    plog.stepStart('brand_kit', { kit: brand.kit_id, logo: !!logoFile, intro: !!intro, outro: !!outro });
    return {
      logo: logoFile ? { path: logoFile, ...brand.logo } : null,
      intro,
      outro,
      maxBumperSeconds: brand.max_bumper_seconds || 15,
      captionStyle: brand.caption_style,
      captionOverrides: brand.captions,
    };
  }

  /** Download and parse the uploaded SRT once per job. Unreadable → AI captions. */
  private async loadSrt(objectPath: string, workDir: string): Promise<SrtCue[] | null> {
    const dest = this.temp.jobPath(workDir, 'source_subtitles.srt');
    try {
      await this.storage.downloadToFile(this.storage.bucketVideos(), objectPath, dest);
      const { cues } = parseSrt(await fs.readFile(dest, 'utf8'));
      return cues.length ? cues : null;
    } catch (err) {
      this.logger.warn(`Uploaded SRT unavailable (${objectPath}): ${(err as Error).message}; using AI captions`);
      return null;
    }
  }

  /** Text, resolved style, duration and sound for one clip's hook. */
  private async prepareHook(
    hook: HookConfig,
    moment: ViralMoment,
    transcript: import('./types').TranscriptSegment[],
    srtCues: SrtCue[] | null,
    brand: BrandAssets | null,
    clipSeconds: number,
  ) {
    const startS = moment.start_ms / 1000;
    const endS = moment.end_ms / 1000;
    const clipText = srtCues
      ? cuesForClip(srtCues, startS, endS).map((c) => c.text).join(' ')
      : transcript.filter((t) => t.end > startS && t.start < endS).map((t) => t.text).join(' ');
    const text = hook.text?.trim() || (await this.hooks.hookPhrase(clipText, moment.title, hook.kind));
    const spec = resolveSpec(hook, brand ? { primary: brand.captionOverrides?.highlight_color, font: brand.captionOverrides?.font } : null);
    const want = Math.min(5, Math.max(1, hook.duration || 2.5));
    // An overlay can't outlast the clip; an opening card can be any length.
    const seconds = hook.placement === 'overlay' ? Math.min(want, Math.max(1, clipSeconds - 0.2)) : want;
    const sfx = hook.sfx === false ? null : sfxSource(hook.sfx_type);
    return { text, spec, seconds, sfx };
  }

  /** A hook that fails to render never costs the clip: ship it without, refund the hook. */
  private async hookFailed(userId: string, videoId: string, index: number, hook: HookConfig & { credits?: number }, err: unknown) {
    this.logger.warn(`Hook skipped for clip ${index}: ${(err as Error)?.message ?? err}`);
    if (hook.credits && hook.credits > 0) await this.refundCredits(userId, hook.credits, 'hook_render_failed', videoId);
  }

  private async renderAndUploadClip(opts: {
    workDir: string;
    userId: string;
    videoId: string;
    index: number;
    moment: ViralMoment;
    sourceVideoPath: string;
    transcript: import('./types').TranscriptSegment[];
    captionStyle: string;
    captionLanguage: string;
    platforms: string[];
    exportQuality: string;
    watermark: boolean;
    brand?: BrandAssets | null;
    layout?: LayoutConfig | null;
    /** Uploaded subtitles for the whole source (seconds). */
    srtCues?: SrtCue[] | null;
    hook?: (HookConfig & { credits?: number }) | null;
  }): Promise<string> {
    const {
      workDir,
      userId,
      videoId,
      index,
      moment,
      sourceVideoPath,
      transcript,
      captionStyle,
      captionLanguage,
      platforms,
      exportQuality,
    } = opts;

    const rawClip = this.temp.jobPath(workDir, `clip_${index}_raw.mp4`);
    const captionedClip = this.temp.jobPath(workDir, `clip_${index}_final.mp4`);
    const srtPath = this.temp.jobPath(workDir, `clip_${index}.srt`);
    const captionsPath = this.temp.jobPath(workDir, `clip_${index}.ass`);
    const clipThumb = this.temp.jobPath(workDir, `clip_${index}_thumb.jpg`);

    await this.ffmpeg.cutClip(
      sourceVideoPath,
      rawClip,
      moment.start_ms,
      moment.end_ms,
      exportQuality,
      opts.watermark,
      opts.brand?.logo ?? null,
      opts.layout ?? null,
    );

    const [frameW, frameH] = outputSize(opts.layout?.aspect_ratio, exportQuality);
    const frame = { width: frameW, height: frameH };
    const styleId = opts.brand?.captionStyle ?? captionStyle;
    if (opts.srtCues) {
      // Uploaded subtitles: re-based to this clip, drawn in the caption style.
      const cues = cuesForClip(opts.srtCues, moment.start_ms / 1000, moment.end_ms / 1000);
      await fs.writeFile(srtPath, toSrt(cues), 'utf8');
      await fs.writeFile(captionsPath, buildAssFromCues(cues, styleId, opts.brand?.captionOverrides, frame), 'utf8');
    } else {
      // Plain SRT is uploaded as the clip's downloadable subtitle file.
      await this.captions.writeClipSrt(transcript, moment.start_ms, moment.end_ms, srtPath, captionStyle);
      await this.captions.writeClipAss(transcript, moment.start_ms, moment.end_ms, captionsPath, styleId, opts.brand?.captionOverrides, frame);
    }

    // AI hook: overlay hooks join the caption file (same burn pass); opening
    // hooks become a card in front of the finished clip further down.
    const clipSeconds = (moment.end_ms - moment.start_ms) / 1000;
    let hookUsed: { text: string; seconds: number; spec: HookSpec; sfx: string | null } | null = null;
    if (opts.hook) {
      try {
        hookUsed = await this.prepareHook(opts.hook, moment, transcript, opts.srtCues ?? null, opts.brand ?? null, clipSeconds);
        if (opts.hook.placement === 'overlay') {
          const caps = await fs.readFile(captionsPath, 'utf8');
          const hookAss = buildHookAss(hookUsed.text, hookUsed.spec, frameW, frameH, hookUsed.seconds, 0);
          await fs.writeFile(captionsPath, mergeAss(caps, hookAss), 'utf8');
        }
      } catch (err) {
        hookUsed = null;
        await this.hookFailed(userId, videoId, index, opts.hook, err);
      }
    }

    await this.ffmpeg.burnCaptions(rawClip, captionsPath, captionedClip, opts.brand?.captionStyle ?? captionStyle, exportQuality);

    if (hookUsed && opts.hook?.placement === 'overlay' && hookUsed.sfx) {
      const mixed = this.temp.jobPath(workDir, `clip_${index}_sfx.mp4`);
      try {
        await this.ffmpeg.mixSfx(captionedClip, mixed, hookUsed.sfx, 0);
        await fs.rename(mixed, captionedClip);
      } catch (err) {
        this.logger.warn(`Hook sound skipped for clip ${index}: ${(err as Error).message}`);
      }
    }

    // Brand intro/outro. Best effort: a bad bumper file must not cost the user
    // the clip, so on failure the clip ships without it.
    if (opts.brand && (opts.brand.intro || opts.brand.outro)) {
      const bumpered = this.temp.jobPath(workDir, `clip_${index}_branded.mp4`);
      try {
        const [bw, bh] = [frameW, frameH];
        await this.ffmpeg.addBumpers(captionedClip, bumpered, {
          intro: opts.brand.intro,
          outro: opts.brand.outro,
          width: bw,
          height: bh,
          maxBumperSeconds: opts.brand.maxBumperSeconds,
          workDir,
        });
        await fs.rename(bumpered, captionedClip);
      } catch (err) {
        this.logger.warn(`Intro/outro skipped for clip ${index}: ${(err as Error).message}`);
      }
    }

    // Opening hook card goes first, ahead of any brand intro, so it is the
    // first thing a viewer sees. The downloadable SRT is shifted to match.
    if (hookUsed && opts.hook?.placement === 'opening') {
      const cardAss = this.temp.jobPath(workDir, `clip_${index}_hook.ass`);
      const card = this.temp.jobPath(workDir, `clip_${index}_hook.mp4`);
      const withHook = this.temp.jobPath(workDir, `clip_${index}_hooked.mp4`);
      try {
        await fs.writeFile(cardAss, buildHookAss(hookUsed.text, hookUsed.spec, frameW, frameH, hookUsed.seconds, 0), 'utf8');
        await this.ffmpeg.renderHookCard({
          clipPath: rawClip,
          assPath: cardAss,
          outputPath: card,
          width: frameW,
          height: frameH,
          seconds: hookUsed.seconds,
          clipSeconds,
          background: cardBackground(hookUsed.spec, frameW, frameH, hookUsed.seconds, clipSeconds),
          sfx: hookUsed.sfx,
        });
        await this.ffmpeg.addBumpers(captionedClip, withHook, {
          intro: card, outro: null, width: frameW, height: frameH, maxBumperSeconds: hookUsed.seconds + 1, workDir,
        });
        await fs.rename(withHook, captionedClip);
        const srt = await fs.readFile(srtPath, 'utf8').catch(() => '');
        if (srt) await fs.writeFile(srtPath, toSrt(shiftCues(parseSrt(srt).cues, hookUsed.seconds)), 'utf8');
      } catch (err) {
        await this.hookFailed(userId, videoId, index, opts.hook, err);
        hookUsed = null;
      }
    }

    const durationSec = Math.round((moment.end_ms - moment.start_ms) / 1000);

    let hasThumb = false;
    try {
      await this.ffmpeg.extractThumbnail(
        captionedClip,
        clipThumb,
        Math.min(2, durationSec / 2),
      );
      hasThumb = true;
    } catch {
      // optional
    }

    const insertRes = await this.db.client.query(
      `INSERT INTO clips (
         user_id, video_id, title, start_time_ms, end_time_ms, status, aspect_ratio,
         ai_score, viral_score, duration_seconds, caption_style, caption_language,
         platform_targets, export_quality, viral_metrics
       )
       VALUES ($1, $2, $3, $4, $5, 'processing', $14, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
       RETURNING id`,
      [
        userId,
        videoId,
        moment.title,
        moment.start_ms,
        moment.end_ms,
        moment.viral_score / 100,
        moment.viral_score,
        durationSec,
        captionStyle,
        captionLanguage,
        platforms,
        exportQuality,
        JSON.stringify(moment.metrics),
        opts.layout?.aspect_ratio ?? '9:16',
      ],
    );

    const clipId = insertRes.rows[0].id as string;
    if (hookUsed && opts.hook) {
      // Best effort: needs the clips.hook column (migration 040_clip_hooks).
      await this.db.client
        .query(`UPDATE clips SET hook = $2::jsonb WHERE id = $1`, [
          clipId,
          JSON.stringify({
            kind: opts.hook.kind, template_id: opts.hook.template_id, text: hookUsed.text,
            placement: opts.hook.placement, duration: hookUsed.seconds, sfx: !!hookUsed.sfx,
            position: hookUsed.spec.pos, aspect_ratio: opts.layout?.aspect_ratio ?? '9:16',
            ai_text: !opts.hook.text, use_brand: !!opts.hook.use_brand,
          }),
        ])
        .catch((err: Error) => this.logger.warn(`Could not save hook settings for clip ${clipId}: ${err.message}`));
    }
    const clipStoragePath = this.storage.objectPath(userId, videoId, `${clipId}.mp4`);
    const srtStoragePath = this.storage.objectPath(userId, videoId, `${clipId}.srt`);

    await this.storage.uploadLocalFile(
      this.storage.bucketClips(),
      clipStoragePath,
      captionedClip,
      'video/mp4',
      { label: `clip ${index + 1}` },
    );

    let subtitleUrl: string | null = null;
    try {
      await this.storage.uploadLocalFile(
        this.storage.bucketClips(),
        srtStoragePath,
        srtPath,
        'text/plain',
      );
      subtitleUrl = this.storage.getPublicUrl(this.storage.bucketClips(), srtStoragePath);
    } catch {
      subtitleUrl = srtStoragePath;
    }

    let clipThumbUrl: string | null = null;
    const thumbStoragePath = this.storage.objectPath(userId, videoId, `${clipId}_thumb.jpg`);
    if (hasThumb) {
      try {
        await this.storage.uploadLocalFile(
          this.storage.bucketClips(),
          thumbStoragePath,
          clipThumb,
          'image/jpeg',
        );
        clipThumbUrl = this.storage.getPublicUrl(this.storage.bucketClips(), thumbStoragePath);
      } catch {
        clipThumbUrl = null;
      }
    }


    await this.db.client.query(
      `UPDATE clips SET storage_path = $1, thumbnail_url = $2, subtitle_url = $3, status = 'completed' WHERE id = $4`,
      [clipStoragePath, clipThumbUrl, subtitleUrl, clipId],
    );

    return clipId;
  }

  private async updateProgress(
    jobId: string | undefined,
    progress_percent: number,
    current_step: number,
    steps: PipelineStep[],
    analysis?: Record<string, unknown>,
    clips_created?: number,
  ) {
    if (!jobId) return;
    await this.db.client.query(
      `UPDATE processing_jobs SET result = $1::jsonb WHERE id = $2`,
      [
        JSON.stringify({
          current_step,
          progress_percent,
          steps,
          analysis,
          clips_created,
        }),
        jobId,
      ],
    );
  }

  /**
   * Give back credits charged up front for a pipeline that failed. Uses the
   * refund_credits RPC so the balance update and ledger entry stay consistent.
   * Best-effort: a refund failure is logged, never rethrown over the original
   * pipeline error.
   */
  private async refundCredits(
    userId: string,
    amount: number,
    reason: string,
    referenceId: string,
  ): Promise<void> {
    try {
      const res = await this.db.client.query<{ refund_credits: number | null }>(
        `SELECT refund_credits($1, $2, $3, $4) AS refund_credits`,
        [userId, amount, reason, referenceId],
      );
      const newBalance = res.rows[0]?.refund_credits ?? null;
      if (newBalance === null) {
        this.logger.warn(`Refund of ${amount} credits skipped — user ${userId} not found`);
        return;
      }
      this.logger.log(`Refunded ${amount} credits to ${userId} (new balance: ${newBalance})`);
    } catch (err) {
      this.logger.error(`Credit refund failed for user ${userId}: ${err}`);
    }
  }

  private estimateSpeakers(text: string): number {
    const matches = text.match(/\b(Speaker \d|Host:|Guest:)/gi);
    return matches ? Math.min(4, new Set(matches.map((m) => m.toLowerCase())).size) : 1;
  }

  private async sendClipReadyEmail(userId: string, videoId: string, videoTitle: string, clipsCount: number): Promise<void> {
    try {
      const userRes = await this.db.client.query(
        `SELECT email, email_notifications_enabled, clips_ready_email_notifications FROM profiles WHERE id = $1`,
        [userId],
      );
      const userEmail = userRes.rows[0]?.email as string | undefined;
      const notificationsEnabled = userRes.rows[0]?.email_notifications_enabled as boolean | undefined;
      const clipsReadyEnabled = userRes.rows[0]?.clips_ready_email_notifications as boolean | undefined;
      if (!userEmail || notificationsEnabled === false || clipsReadyEnabled === false) return;

      const appUrl = this.config.get<string>('appUrl') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://autoclipr.com';
      await this.email.sendClipReady(userEmail, {
        userName: userEmail.split('@')[0],
        clipTitle: videoTitle,
        clipsCount,
        generatedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        clipUrl: `${appUrl}/clips?video=${videoId}`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send clip-ready email for video ${videoId}: ${err}`);
    }
  }

  private avgScore(moments: ViralMoment[]): number {
    if (!moments.length) return 80;
    return Math.round(
      moments.reduce((a, m) => a + m.viral_score, 0) / moments.length,
    );
  }
}

type BrandAssets = {
  logo: LogoOverlay | null;
  intro: string | null;
  outro: string | null;
  maxBumperSeconds: number;
  captionStyle: string | null;
  captionOverrides: import('./caption-styles').CaptionOverrides;
};
