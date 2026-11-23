import { Injectable } from '@nestjs/common';
import { SupabaseAdminService } from '../../database/supabase-admin.service';
import type { PlatformId } from '../platforms/dto/platform.dto';

export interface ClipPublication {
  id: string;
  user_id: string;
  clip_id: string;
  platform: PlatformId;
  status: string;
  platform_post_id: string | null;
  platform_post_url: string | null;
  error_message: string | null;
  job_id: string | null;
  posted_at: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  metrics_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostedPublicationRow extends ClipPublication {
  /** Where the post came from: a clip's Post button, or the Content Scheduler. */
  source?: 'clip' | 'scheduler';
  clip_title: string;
  clip_thumbnail_url: string | null;
  clip_storage_path: string | null;
  clip_viral_score: number | null;
}

const PUBLICATION_COLUMNS =
  'id, user_id, clip_id, platform, status, platform_post_id, platform_post_url, error_message, job_id, posted_at, view_count, like_count, comment_count, metrics_updated_at, created_at, updated_at';

@Injectable()
export class PublicationsRepository {
  constructor(private readonly supabase: SupabaseAdminService) {}

  async listByClipIds(clipIds: string[]): Promise<ClipPublication[]> {
    if (!clipIds.length) return [];

    const { data, error } = await this.supabase
      .getClient()
      .from('clip_publications')
      .select(PUBLICATION_COLUMNS)
      .in('clip_id', clipIds)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as ClipPublication[];
  }

  async listByClip(clipId: string, userId: string): Promise<ClipPublication[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clip_publications')
      .select(PUBLICATION_COLUMNS)
      .eq('clip_id', clipId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as ClipPublication[];
  }

  async upsertPending(data: {
    user_id: string;
    clip_id: string;
    platform: PlatformId;
    job_id?: string | null;
  }): Promise<ClipPublication> {
    const { data: row, error } = await this.supabase
      .getClient()
      .from('clip_publications')
      .upsert(
        {
          user_id: data.user_id,
          clip_id: data.clip_id,
          platform: data.platform,
          status: 'pending',
          job_id: data.job_id ?? null,
          error_message: null,
          platform_post_id: null,
          platform_post_url: null,
          posted_at: null,
        },
        { onConflict: 'clip_id,platform' },
      )
      .select(PUBLICATION_COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    if (!row) throw new Error('Failed to create publication');
    return row as ClipPublication;
  }

  async listPostedByUser(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<PostedPublicationRow[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clip_publications')
      .select(
        `${PUBLICATION_COLUMNS}, clips!inner(title, thumbnail_url, viral_score, storage_path)`,
      )
      .eq('user_id', userId)
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    type JoinedRow = ClipPublication & {
      clips: {
        title?: string;
        thumbnail_url?: string | null;
        viral_score?: number | null;
        storage_path?: string | null;
      } | null;
    };

    return (data ?? []).map((row) => {
      const { clips, ...pub } = row as JoinedRow;
      return {
        ...pub,
        clip_title: clips?.title ?? 'Untitled clip',
        clip_thumbnail_url: clips?.thumbnail_url ?? null,
        clip_storage_path: clips?.storage_path ?? null,
        clip_viral_score: clips?.viral_score ?? null,
      };
    });
  }

  /**
   * Posts the Content Scheduler published, shaped like clip publications so
   * analytics can treat both the same. ids are scheduled_post_targets ids.
   */
  async listScheduledPostedByUser(userId: string, limit = 100): Promise<PostedPublicationRow[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('scheduled_post_targets')
      .select(
        'id, user_id, platform, status, platform_post_id, platform_post_url, error_message, published_at, view_count, like_count, comment_count, metrics_updated_at, created_at, updated_at, scheduled_posts!inner(clip_id, title, caption, media_storage_path, media_thumbnail_url)',
      )
      .eq('user_id', userId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    type Row = {
      id: string; user_id: string; platform: string; status: string;
      platform_post_id: string | null; platform_post_url: string | null; error_message: string | null;
      published_at: string | null; view_count: number | null; like_count: number | null; comment_count: number | null;
      metrics_updated_at: string | null; created_at: string; updated_at: string;
      scheduled_posts: { clip_id: string | null; title: string | null; caption: string | null; media_storage_path: string | null; media_thumbnail_url: string | null } | null;
    };
    return ((data ?? []) as unknown as Row[]).map((r) => {
      const post = r.scheduled_posts;
      const title = post?.title?.trim() || post?.caption?.split('\n')[0]?.trim() || 'Scheduled post';
      return {
        id: r.id,
        user_id: r.user_id,
        clip_id: post?.clip_id ?? '',
        platform: r.platform,
        status: 'posted',
        platform_post_id: r.platform_post_id,
        platform_post_url: r.platform_post_url,
        error_message: r.error_message,
        job_id: null,
        posted_at: r.published_at,
        view_count: Number(r.view_count ?? 0),
        like_count: Number(r.like_count ?? 0),
        comment_count: Number(r.comment_count ?? 0),
        metrics_updated_at: r.metrics_updated_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        source: 'scheduler',
        clip_title: title.slice(0, 200),
        clip_thumbnail_url: post?.media_thumbnail_url ?? null,
        clip_storage_path: post?.media_storage_path ?? null,
        clip_viral_score: null,
      } as PostedPublicationRow;
    });
  }

  /** Scheduler targets by outcome, for the analytics summary counts. */
  async countScheduledByUser(userId: string): Promise<{ posted: number; failed: number; pending: number }> {
    const groups: Record<'posted' | 'failed' | 'pending', string[]> = {
      posted: ['published'],
      failed: ['failed'],
      pending: ['queued', 'publishing', 'retrying'],
    };
    const entries = await Promise.all(
      (Object.keys(groups) as (keyof typeof groups)[]).map(async (k) => {
        const { count, error } = await this.supabase
          .getClient()
          .from('scheduled_post_targets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('status', groups[k]);
        if (error) throw new Error(error.message);
        return [k, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entries) as { posted: number; failed: number; pending: number };
  }

  async countByUser(userId: string): Promise<{
    posted: number;
    failed: number;
    pending: number;
  }> {
    const statuses = ['posted', 'failed', 'pending'] as const;
    const counts = await Promise.all(
      statuses.map(async (status) => {
        const { count, error } = await this.supabase
          .getClient()
          .from('clip_publications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', status);
        if (error) throw new Error(error.message);
        return count ?? 0;
      }),
    );

    return { posted: counts[0], failed: counts[1], pending: counts[2] };
  }

  async updateMetrics(
    publicationId: string,
    metrics: {
      view_count: number;
      like_count: number;
      comment_count: number;
    },
    source: 'clip' | 'scheduler' = 'clip',
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from(source === 'scheduler' ? 'scheduled_post_targets' : 'clip_publications')
      .update({
        view_count: metrics.view_count,
        like_count: metrics.like_count,
        comment_count: metrics.comment_count,
        metrics_updated_at: new Date().toISOString(),
      })
      .eq('id', publicationId);

    if (error) throw new Error(error.message);
  }
}
