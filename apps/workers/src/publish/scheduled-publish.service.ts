import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, UnrecoverableError } from 'bullmq';
import * as path from 'path';
import { EmailService } from '@autoclipr/emails';
import { DatabaseService } from '../database/database.service';
import { TempFilesService } from '../pipeline/temp-files.service';
import { CLIP_QUEUE } from '../jobs.constants';
import { PublishService } from './publish.service';

export const SCHEDULER_TICK_JOB = 'scheduled_posts_tick';
export const PUBLISH_SCHEDULED_JOB = 'publish_scheduled_target';

/** Attempts per destination before it is marked failed (1 try + 2 retries). */
export const PUBLISH_ATTEMPTS = 3;
const TICK_EVERY_MS = 60 * 1000;
/** A target stuck in `publishing` this long was interrupted mid-upload. */
const STUCK_PUBLISHING_MS = 30 * 60 * 1000;
/** A target `queued` this long lost its BullMQ job (e.g. Redis was flushed). */
const LOST_QUEUED_MS = 15 * 60 * 1000;
const CLAIM_BATCH = 25;

/** Plans that include the Content Scheduler (kept in sync with the API). */
export const SCHEDULER_PLANS = ['creator', 'pro', 'business'];
export const SCHEDULER_PLAN_ERROR =
  'Content scheduling needs a Creator or Business plan. Upgrade, then retry this post.';

const PLATFORM_LABELS: Record<string, string> = { youtube: 'YouTube Shorts', instagram: 'Instagram Reels' };

/**
 * Errors retrying cannot fix: the account needs the user's attention.
 * Anything else (network, 5xx, rate limits) is retried with backoff.
 */
export function isPermanentPublishError(message: string): boolean {
  return /not (authorized|connected)|reconnect|authorize|missing|invalid_grant|permission|not available|unsupported/i.test(
    message,
  );
}

/** Overall post status from its destinations. */
export function overallStatus(statuses: string[]): string {
  if (!statuses.length) return 'draft';
  if (statuses.some((s) => ['queued', 'publishing', 'retrying'].includes(s))) return 'publishing';
  if (statuses.some((s) => s === 'scheduled')) return 'scheduled';
  const published = statuses.filter((s) => s === 'published').length;
  const failed = statuses.filter((s) => s === 'failed').length;
  if (published === statuses.length) return 'published';
  if (published && failed) return 'partially_published';
  if (failed) return 'failed';
  return statuses[0];
}

/**
 * Publishes scheduled posts.
 *
 * Postgres is the source of truth. A BullMQ job scheduler fires a tick every
 * minute; the tick claims due destinations with `FOR UPDATE SKIP LOCKED`
 * (so two workers never take the same one) and enqueues one publish job per
 * destination. Each publish first flips the row to `publishing` with a
 * conditional update, so a duplicate job does nothing, and a destination is
 * only marked published once the platform has returned a post id.
 */
@Injectable()
export class ScheduledPublishService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledPublishService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly publish: PublishService,
    private readonly temp: TempFilesService,
    private readonly email: EmailService,
    @InjectQueue(CLIP_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      // Idempotent: re-registering on every boot keeps a single schedule.
      await this.queue.upsertJobScheduler(
        'scheduled-posts-tick',
        { every: TICK_EVERY_MS },
        { name: SCHEDULER_TICK_JOB, opts: { removeOnComplete: 50, removeOnFail: 50 } },
      );
      this.logger.log('Scheduled-post tick registered (every 60s)');
    } catch (err) {
      this.logger.error(`Could not register scheduled-post tick: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Recover interrupted work, then queue every destination that is due. */
  async tick(): Promise<number> {
    // Interrupted mid-upload: we cannot tell whether the platform received
    // it, so fail it for the user to check rather than risk a double post.
    const stuck = await this.db.client.query(
      `UPDATE scheduled_post_targets
          SET status = 'failed',
              error_message = 'Publishing was interrupted. Check the platform before retrying.',
              updated_at = NOW()
        WHERE status = 'publishing' AND publishing_started_at < NOW() - ($1 || ' milliseconds')::interval
        RETURNING scheduled_post_id`,
      [String(STUCK_PUBLISHING_MS)],
    );
    // Queued but the job is gone: nothing was sent, so it is safe to requeue.
    await this.db.client.query(
      `UPDATE scheduled_post_targets SET status = 'scheduled', updated_at = NOW()
        WHERE status = 'queued' AND updated_at < NOW() - ($1 || ' milliseconds')::interval`,
      [String(LOST_QUEUED_MS)],
    );
    for (const row of stuck.rows) await this.refreshPost(row.scheduled_post_id as string);

    const due = await this.db.client.query(
      `UPDATE scheduled_post_targets t
          SET status = 'queued', updated_at = NOW()
        WHERE t.id IN (
          SELECT id FROM scheduled_post_targets
           WHERE status = 'scheduled' AND scheduled_at <= NOW()
           ORDER BY scheduled_at
           LIMIT ${CLAIM_BATCH}
           FOR UPDATE SKIP LOCKED)
        RETURNING t.id, t.scheduled_post_id, t.retry_count`,
    );

    const posts = new Set<string>();
    for (const row of due.rows) {
      await this.queue.add(
        PUBLISH_SCHEDULED_JOB,
        { targetId: row.id },
        {
          // One job per destination per retry round; a re-add is a no-op.
          jobId: `sched-${row.id}-${row.retry_count}`,
          attempts: PUBLISH_ATTEMPTS,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 200,
          removeOnFail: 200,
        },
      );
      posts.add(row.scheduled_post_id as string);
    }
    for (const id of posts) await this.refreshPost(id);
    if (due.rowCount) this.logger.log(`Queued ${due.rowCount} scheduled destination(s)`);
    return due.rowCount ?? 0;
  }

  /**
   * Publish one destination. `attemptsMade` is BullMQ's count of earlier
   * failed attempts for this job.
   */
  async publishTarget(targetId: string, attemptsMade: number): Promise<void> {
    const claimed = await this.db.client.query(
      `UPDATE scheduled_post_targets
          SET status = 'publishing', publishing_started_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status IN ('queued', 'retrying')
        RETURNING id, scheduled_post_id, user_id, platform, caption_override`,
      [targetId],
    );
    const target = claimed.rows[0];
    if (!target) {
      this.logger.log(`Target ${targetId} already handled; skipping`);
      return;
    }
    await this.refreshPost(target.scheduled_post_id);

    const postRes = await this.db.client.query(
      `SELECT p.id, p.user_id, p.title, p.caption, p.description, p.hashtags, p.media_storage_path,
              pr.subscription_tier
         FROM scheduled_posts p
         LEFT JOIN profiles pr ON pr.id = p.user_id
        WHERE p.id = $1`,
      [target.scheduled_post_id],
    );
    const post = postRes.rows[0];
    const caption = this.buildCaption(target.caption_override ?? post?.caption ?? '', post?.hashtags);

    const workDir = await this.temp.createJobDir(`sched_${targetId}`);
    try {
      if (!post) throw new UnrecoverableError('The scheduled post no longer exists.');
      // The user may have downgraded after scheduling.
      if (!SCHEDULER_PLANS.includes(post.subscription_tier)) throw new UnrecoverableError(SCHEDULER_PLAN_ERROR);
      const localPath = path.join(workDir, 'media.mp4');
      await this.publish.downloadClip(post.media_storage_path, localPath);

      const result = await this.publish.publishToPlatform({
        platform: target.platform,
        userId: target.user_id,
        title: (post.title || caption.split('\n')[0] || 'New video').slice(0, 100),
        caption: post.description ? `${caption}\n\n${post.description}` : caption,
        localClipPath: localPath,
      });

      await this.db.client.query(
        `UPDATE scheduled_post_targets
            SET status = 'published', platform_post_id = $2, platform_post_url = $3,
                published_at = NOW(), error_message = NULL, updated_at = NOW()
          WHERE id = $1`,
        [targetId, result.postId, result.postUrl],
      );
      await this.refreshPost(target.scheduled_post_id);
      this.logger.log(`Published scheduled target ${targetId} to ${target.platform}`);
      await this.notify(target.user_id, 'published', { platform: target.platform, caption, postUrl: result.postUrl });
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      const permanent = err instanceof UnrecoverableError || isPermanentPublishError(message);
      const willRetry = !permanent && attemptsMade + 1 < PUBLISH_ATTEMPTS;

      await this.db.client.query(
        `UPDATE scheduled_post_targets
            SET status = $2, error_message = $3, retry_count = retry_count + 1, updated_at = NOW()
          WHERE id = $1`,
        [targetId, willRetry ? 'retrying' : 'failed', message],
      );
      await this.refreshPost(target.scheduled_post_id);
      this.logger.warn(`Scheduled target ${targetId} ${willRetry ? 'will retry' : 'failed'}: ${message}`);

      if (!willRetry) {
        await this.notify(target.user_id, 'failed', { platform: target.platform, caption, reason: message });
        // Stop BullMQ retrying something we have marked failed.
        throw new UnrecoverableError(message);
      }
      throw err;
    } finally {
      await this.temp.cleanup(workDir);
    }
  }

  private buildCaption(caption: string, hashtags?: string | null): string {
    const tags = (hashtags ?? '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ');
    return [caption.trim(), tags].filter(Boolean).join('\n\n');
  }

  /** Recompute the post's overall status from its destinations. */
  private async refreshPost(postId: string): Promise<void> {
    const res = await this.db.client.query(
      `SELECT status FROM scheduled_post_targets WHERE scheduled_post_id = $1`,
      [postId],
    );
    const status = overallStatus(res.rows.map((r) => r.status as string));
    await this.db.client.query(
      `UPDATE scheduled_posts
          SET status = $2,
              published_at = CASE WHEN $2 IN ('published', 'partially_published') THEN COALESCE(published_at, NOW()) ELSE published_at END,
              updated_at = NOW()
        WHERE id = $1 AND status <> 'cancelled'`,
      [postId, status],
    );
  }

  private async notify(
    userId: string,
    kind: 'published' | 'failed',
    vars: { platform: string; caption: string; postUrl?: string | null; reason?: string },
  ): Promise<void> {
    try {
      const res = await this.db.client.query(
        `SELECT email, full_name, email_notifications_enabled, scheduler_email_notifications
           FROM profiles WHERE id = $1`,
        [userId],
      );
      const u = res.rows[0];
      if (!u?.email || u.email_notifications_enabled === false || u.scheduler_email_notifications === false) return;
      const userName = (u.full_name as string) || (u.email as string).split('@')[0];
      const platform = PLATFORM_LABELS[vars.platform] ?? vars.platform;
      if (kind === 'published') {
        await this.email.sendPostPublished(u.email, {
          userName,
          caption: vars.caption,
          platform,
          publishedAt: new Date().toUTCString(),
          postUrl: vars.postUrl ?? null,
        });
      } else {
        await this.email.sendPostFailed(u.email, { userName, caption: vars.caption, platform, reason: vars.reason ?? 'Unknown error' });
      }
    } catch (err) {
      // A notification problem must never change the publish outcome.
      this.logger.warn(`Scheduler email failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
