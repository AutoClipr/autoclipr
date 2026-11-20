import { Injectable } from '@nestjs/common';
import { SupabaseAdminService } from '../../database/supabase-admin.service';

export interface CreatorChannelRow {
  channel_id: string;
  channel_handle: string | null;
  channel_name: string;
  description: string | null;
  avatar_url: string | null;
  country: string | null;
  category: string;
  subscriber_count: number | null;
  total_views: number | null;
  video_count: number | null;
  published_at: string | null;
  last_fetched_at: string | null;
}

/** Stats returned by YouTube for one channel, ready to write. */
export interface CreatorStatsUpdate {
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  description: string | null;
  avatar_url: string | null;
  country: string | null;
  subscriber_count: number | null;
  total_views: number | null;
  video_count: number | null;
  published_at: string | null;
}

const COLUMNS =
  'channel_id, channel_handle, channel_name, description, avatar_url, country, category, subscriber_count, total_views, video_count, published_at, last_fetched_at';

@Injectable()
export class CreatorsRepository {
  constructor(private readonly supabase: SupabaseAdminService) {}

  private db() {
    return this.supabase.getClient();
  }

  /** Every tracked channel. The set is curated (tens–hundreds of rows). */
  async listActive(): Promise<CreatorChannelRow[]> {
    const { data, error } = await this.db()
      .from('creator_channels')
      .select(COLUMNS)
      .eq('is_active', true);
    if (error) throw new Error(error.message);
    return (data as CreatorChannelRow[] | null) ?? [];
  }

  /** Last refresh that completed successfully, or null if none has yet. */
  async lastSuccessfulRefresh(): Promise<string | null> {
    const { data, error } = await this.db()
      .from('creator_refresh_runs')
      .select('finished_at')
      .eq('succeeded', true)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { finished_at: string } | null)?.finished_at ?? null;
  }

  async startRun(): Promise<string> {
    const { data, error } = await this.db().from('creator_refresh_runs').insert({}).select('id').single();
    if (error) throw new Error(error.message);
    return (data as { id: string }).id;
  }

  async finishRun(id: string, result: { succeeded: boolean; ok: number; failed: number; error?: string | null }) {
    const { error } = await this.db()
      .from('creator_refresh_runs')
      .update({
        finished_at: new Date().toISOString(),
        succeeded: result.succeeded,
        channels_ok: result.ok,
        channels_failed: result.failed,
        error: result.error ?? null,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  /**
   * Write fresh stats for one channel and record a history snapshot.
   * `previousId` differs from `stats.channel_id` when a stale ID was
   * re-resolved through the channel's handle.
   */
  async saveStats(previousId: string, stats: CreatorStatsUpdate): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.db()
      .from('creator_channels')
      .update({ ...stats, last_fetched_at: now, last_error: null, updated_at: now })
      .eq('channel_id', previousId);
    if (error) throw new Error(error.message);

    const { error: histErr } = await this.db().from('creator_stats_history').insert({
      channel_id: stats.channel_id,
      subscriber_count: stats.subscriber_count,
      total_views: stats.total_views,
      video_count: stats.video_count,
      recorded_at: now,
    });
    if (histErr) throw new Error(histErr.message);
  }

  async markError(channelId: string, message: string): Promise<void> {
    const { error } = await this.db()
      .from('creator_channels')
      .update({ last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq('channel_id', channelId);
    if (error) throw new Error(error.message);
  }
}
