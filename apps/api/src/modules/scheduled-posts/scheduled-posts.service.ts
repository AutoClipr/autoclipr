import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseAdminService } from '../../database/supabase-admin.service';
import { ClipsRepository } from '../clips/clips.repository';
import { PlatformsRepository } from '../platforms/platforms.repository';
import { StorageService } from '../storage/storage.service';
import {
  CreateScheduledPostDto,
  ListScheduledPostsQuery,
  RescheduleDto,
  RetryDto,
  UPLOAD_EXTENSIONS,
  UploadUrlDto,
} from './scheduled-posts.dto';

/** Target states the worker owns; the user cannot change a post in them. */
const IN_FLIGHT = ['queued', 'publishing', 'retrying'];
/** Earliest a post can be scheduled, so the minute tick reliably sees it. */
const MIN_LEAD_MS = 60 * 1000;
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;
/** Plans that include the Content Scheduler. */
export const SCHEDULER_PLANS = ['creator', 'business'];
export const SCHEDULER_UPGRADE_MESSAGE =
  'Content scheduling is available on the Creator and Business plans. Upgrade to schedule posts.';

const POST_COLUMNS =
  'id, user_id, clip_id, media_storage_path, media_thumbnail_url, media_duration_seconds, title, caption, description, hashtags, scheduled_at, timezone, status, published_at, cancelled_at, created_at, updated_at, scheduled_post_targets(id, platform, caption_override, status, platform_post_id, platform_post_url, error_message, retry_count, published_at)';

type Target = { id: string; platform: string; status: string };
type Post = { id: string; status: string; scheduled_post_targets?: Target[] } & Record<string, unknown>;

@Injectable()
export class ScheduledPostsService {
  private readonly logger = new Logger(ScheduledPostsService.name);

  constructor(
    private readonly supabase: SupabaseAdminService,
    private readonly clips: ClipsRepository,
    private readonly platforms: PlatformsRepository,
    private readonly storage: StorageService,
  ) {}

  private db() {
    return this.supabase.getClient();
  }

  /**
   * Signed upload URL for a local video. Files go to the clips bucket under
   * `{userId}/scheduled/`, the prefix `create` later checks, so a post can
   * only ever point at its owner's uploads.
   */
  async createUploadUrl(userId: string, dto: UploadUrlDto) {
    await this.assertPaidPlan(userId);
    const ext = dto.filename.split('.').pop()?.toLowerCase() ?? '';
    if (!(UPLOAD_EXTENSIONS as readonly string[]).includes(ext) || !dto.mime_type.startsWith('video/')) {
      throw new BadRequestException(`Upload an ${UPLOAD_EXTENSIONS.join(', ').toUpperCase()} video.`);
    }
    const path = `${userId}/scheduled/${randomUUID()}.${ext}`;
    const signed = await this.storage.createSignedUploadUrl(path, this.storage.clipsBucket());
    return { upload_url: signed.signedUrl, media_storage_path: path };
  }

  async list(userId: string, q: ListScheduledPostsQuery) {
    let query = this.db().from('scheduled_posts').select(POST_COLUMNS).eq('user_id', userId);
    if (q.startDate) query = query.gte('scheduled_at', q.startDate);
    if (q.endDate) query = query.lte('scheduled_at', q.endDate);
    if (q.status) query = query.eq('status', q.status);
    const { data, error } = await query.order('scheduled_at', { ascending: true });
    if (error) throw new Error(error.message);
    const posts = (data ?? []) as Post[];
    return q.platform
      ? posts.filter((p) => p.scheduled_post_targets?.some((t) => t.platform === q.platform))
      : posts;
  }

  async get(userId: string, id: string): Promise<Post> {
    const { data, error } = await this.db()
      .from('scheduled_posts')
      .select(POST_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Scheduled post not found');
    return data as Post;
  }

  async create(userId: string, dto: CreateScheduledPostDto) {
    await this.assertPaidPlan(userId);
    const values = await this.validate(userId, dto);
    const { data, error } = await this.db()
      .from('scheduled_posts')
      .insert({ user_id: userId, ...values.post })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Could not save the post');
    await this.insertTargets(userId, data.id as string, dto, values.post);
    this.logger.log(`Scheduled post ${data.id} created (${values.post.status}) for ${userId}`);
    return this.get(userId, data.id as string);
  }

  /** Edit a draft or scheduled post: caption, media, destinations or time. */
  async update(userId: string, id: string, dto: CreateScheduledPostDto) {
    await this.assertPaidPlan(userId);
    const existing = await this.get(userId, id);
    this.assertEditable(existing);
    const values = await this.validate(userId, dto);
    const { error } = await this.db()
      .from('scheduled_posts')
      .update(values.post)
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    // Destinations are replaced wholesale; none has been published yet.
    await this.db().from('scheduled_post_targets').delete().eq('scheduled_post_id', id);
    await this.insertTargets(userId, id, dto, values.post);
    return this.get(userId, id);
  }

  async reschedule(userId: string, id: string, dto: RescheduleDto) {
    await this.assertPaidPlan(userId);
    const existing = await this.get(userId, id);
    this.assertEditable(existing);
    if (existing.status !== 'scheduled') {
      throw new BadRequestException('Only scheduled posts can be rescheduled.');
    }
    this.assertTime(dto.scheduled_at);
    await this.db()
      .from('scheduled_posts')
      .update({ scheduled_at: dto.scheduled_at, ...(dto.timezone ? { timezone: dto.timezone } : {}) })
      .eq('id', id)
      .eq('user_id', userId);
    await this.db()
      .from('scheduled_post_targets')
      .update({ scheduled_at: dto.scheduled_at })
      .eq('scheduled_post_id', id)
      .eq('status', 'scheduled');
    return this.get(userId, id);
  }

  /**
   * Removes the post from the calendar. Published content stays on the
   * platforms; we cannot delete it there.
   */
  async remove(userId: string, id: string) {
    const existing = await this.get(userId, id);
    if (this.inFlight(existing)) {
      throw new ConflictException('This post is being published right now. Try again in a minute.');
    }
    await this.db().from('scheduled_posts').delete().eq('id', id).eq('user_id', userId);
    return { deleted: true };
  }

  /** Move every waiting destination to "now"; the worker picks it up within a minute. */
  async publishNow(userId: string, id: string) {
    await this.assertPaidPlan(userId);
    const existing = await this.get(userId, id);
    this.assertEditable(existing);
    if (!existing.scheduled_post_targets?.length) {
      throw new BadRequestException('Pick at least one account to publish to.');
    }
    const now = new Date().toISOString();
    await this.db()
      .from('scheduled_posts')
      .update({ scheduled_at: now, status: 'scheduled' })
      .eq('id', id)
      .eq('user_id', userId);
    await this.db()
      .from('scheduled_post_targets')
      .update({ scheduled_at: now, status: 'scheduled' })
      .eq('scheduled_post_id', id)
      .in('status', ['draft', 'scheduled']);
    return this.get(userId, id);
  }

  /** Re-queue failed destinations only, so a published one is never posted twice. */
  async retry(userId: string, id: string, dto: RetryDto) {
    await this.assertPaidPlan(userId);
    const existing = await this.get(userId, id);
    const failed = (existing.scheduled_post_targets ?? []).filter(
      (t) => t.status === 'failed' && (!dto.platform || t.platform === dto.platform),
    );
    if (!failed.length) throw new BadRequestException('There is nothing to retry.');
    const now = new Date().toISOString();
    for (const t of failed) {
      await this.db()
        .from('scheduled_post_targets')
        .update({ status: 'scheduled', scheduled_at: now, error_message: null })
        .eq('id', t.id)
        .eq('status', 'failed');
    }
    await this.db().from('scheduled_posts').update({ status: 'scheduled' }).eq('id', id).eq('user_id', userId);
    return this.get(userId, id);
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  /**
   * Scheduling is a paid feature. Viewing and deleting stay open so a user
   * who downgrades can still see and clean up their calendar.
   */
  private async assertPaidPlan(userId: string) {
    const { data } = await this.db()
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    if (!SCHEDULER_PLANS.includes((data?.subscription_tier as string) ?? '')) {
      throw new ForbiddenException(SCHEDULER_UPGRADE_MESSAGE);
    }
  }

  private inFlight(post: Post): boolean {
    return (post.scheduled_post_targets ?? []).some((t) => IN_FLIGHT.includes(t.status));
  }

  private assertEditable(post: Post) {
    if (this.inFlight(post)) {
      throw new ConflictException('This post is being published right now. Try again in a minute.');
    }
    if (!['draft', 'scheduled'].includes(post.status)) {
      throw new BadRequestException('Only drafts and scheduled posts can be changed.');
    }
  }

  private assertTime(iso: string) {
    const at = new Date(iso).getTime();
    const now = Date.now();
    if (at < now + MIN_LEAD_MS) throw new BadRequestException('Pick a time at least a minute from now.');
    if (at > now + MAX_AHEAD_MS) throw new BadRequestException('Posts can be scheduled up to a year ahead.');
  }

  /** Checks media ownership, destinations and time; returns the row to save. */
  private async validate(userId: string, dto: CreateScheduledPostDto) {
    const status = dto.status ?? 'scheduled';

    let media: { media_storage_path: string; media_thumbnail_url: string | null; media_duration_seconds: number | null; clip_id: string | null };
    if (dto.clip_id) {
      const clip = await this.clips.getById(dto.clip_id, userId);
      if (!clip) throw new NotFoundException('Clip not found');
      if (clip.status !== 'completed' || !clip.storage_path) {
        throw new BadRequestException('That clip is not ready yet.');
      }
      media = {
        clip_id: clip.id,
        media_storage_path: clip.storage_path,
        media_thumbnail_url: clip.thumbnail_url,
        media_duration_seconds: clip.duration_seconds,
      };
    } else if (dto.media_storage_path) {
      if (!dto.media_storage_path.startsWith(`${userId}/scheduled/`) || dto.media_storage_path.includes('..')) {
        throw new BadRequestException('Upload the video again before scheduling it.');
      }
      media = {
        clip_id: null,
        media_storage_path: dto.media_storage_path,
        media_thumbnail_url: null,
        media_duration_seconds: dto.media_duration_seconds ?? null,
      };
    } else {
      throw new BadRequestException('Choose a clip or upload a video.');
    }

    const platforms = [...new Set(dto.targets.map((t) => t.platform))];
    if (status === 'scheduled') {
      if (!platforms.length) throw new BadRequestException('Pick at least one account to publish to.');
      if (!dto.scheduled_at) throw new BadRequestException('Pick a date and time.');
      this.assertTime(dto.scheduled_at);
    }
    if (platforms.length) {
      const connections = await this.platforms.listByUser(userId);
      for (const platform of platforms) {
        const conn = connections.find((c) => c.platform === platform);
        if (!conn || conn.auth_status !== 'authorized' || !conn.has_tokens) {
          throw new BadRequestException(`Connect and authorize ${platform} in Settings → Platforms first.`);
        }
      }
    }

    return {
      post: {
        ...media,
        title: dto.title?.trim() || null,
        caption: dto.caption?.trim() ?? '',
        description: dto.description?.trim() || null,
        hashtags: dto.hashtags?.trim() || null,
        scheduled_at: dto.scheduled_at ?? null,
        timezone: dto.timezone || 'UTC',
        status,
      },
    };
  }

  private async insertTargets(
    userId: string,
    postId: string,
    dto: CreateScheduledPostDto,
    post: { status: string; scheduled_at: string | null },
  ) {
    const seen = new Set<string>();
    const rows = dto.targets
      .filter((t) => !seen.has(t.platform) && seen.add(t.platform))
      .map((t) => ({
        scheduled_post_id: postId,
        user_id: userId,
        platform: t.platform,
        caption_override: t.caption_override?.trim() || null,
        scheduled_at: post.scheduled_at,
        status: post.status,
      }));
    if (!rows.length) return;
    const { error } = await this.db().from('scheduled_post_targets').insert(rows);
    if (error) throw new Error(error.message);
  }
}
