import { Injectable } from '@nestjs/common';
import { SupabaseAdminService } from '../../database/supabase-admin.service';

export interface Clip {
  id: string;
  user_id: string;
  video_id: string;
  title: string;
  start_time_ms: number;
  end_time_ms: number;
  storage_path: string | null;
  thumbnail_url: string | null;
  subtitle_url: string | null;
  status: string;
  ai_score: number | null;
  viral_score: number | null;
  duration_seconds: number | null;
  caption_style: string | null;
  caption_language: string | null;
  platform_targets: string[] | null;
  export_quality: string | null;
  viral_metrics: Record<string, unknown> | null;
  aspect_ratio: string;
  created_at: Date;
  updated_at: Date;
}

const CLIP_COLUMNS =
  'id, user_id, video_id, title, start_time_ms, end_time_ms, storage_path, thumbnail_url, subtitle_url, status, ai_score, viral_score, duration_seconds, caption_style, caption_language, platform_targets, export_quality, viral_metrics, aspect_ratio, created_at, updated_at';

@Injectable()
export class ClipsRepository {
  constructor(private readonly supabase: SupabaseAdminService) {}

  async listByUser(userId: string, limit: number, offset: number, videoId?: string) {
    let q = this.supabase
      .getClient()
      .from('clips')
      .select(CLIP_COLUMNS, { count: 'exact' })
      .eq('user_id', userId);
    if (videoId) q = q.eq('video_id', videoId);
    const { data, error, count } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return { items: (data ?? []) as Clip[], total: count ?? 0 };
  }

  /** The caller's clips by state: total, ready (completed) and still processing. */
  async statsByUser(userId: string): Promise<{ total: number; ready: number; processing: number }> {
    const count = async (filter?: (q: any) => any) => {
      let q: any = this.supabase.getClient().from('clips').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      if (filter) q = filter(q);
      const { count: c, error } = await q;
      if (error) throw new Error(error.message);
      return (c as number | null) ?? 0;
    };
    const [total, ready, failed] = await Promise.all([
      count(),
      count((q) => q.eq('status', 'completed')),
      count((q) => q.eq('status', 'failed')),
    ]);
    return { total, ready, processing: Math.max(0, total - ready - failed) };
  }

  /** Clip count per video for the given videos (only the caller's). */
  async countByVideoIds(userId: string, videoIds: string[]): Promise<Record<string, number>> {
    if (!videoIds.length) return {};
    const { data, error } = await this.supabase
      .getClient()
      .from('clips')
      .select('video_id')
      .eq('user_id', userId)
      .in('video_id', videoIds);
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const r of (data ?? []) as { video_id: string }[]) counts[r.video_id] = (counts[r.video_id] ?? 0) + 1;
    return counts;
  }

  async getById(id: string, userId: string): Promise<Clip | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clips')
      .select(CLIP_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as Clip) ?? null;
  }

  async listByVideoId(videoId: string, userId: string): Promise<Clip[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clips')
      .select(CLIP_COLUMNS)
      .eq('video_id', videoId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return (data ?? []) as Clip[];
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clips')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(error.message);
    return !!data;
  }
}
