import { Injectable } from '@nestjs/common';
import { PublicationsRepository, type PostedPublicationRow } from '../clips/publications.repository';
import { PlatformsRepository } from '../platforms/platforms.repository';
import { StorageService } from '../storage/storage.service';
import { YoutubeStatsService } from './youtube-stats.service';
import { InstagramStatsService } from './instagram-stats.service';

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube Shorts',
  instagram: 'Instagram Reels',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly publicationsRepo: PublicationsRepository,
    private readonly platformsRepo: PlatformsRepository,
    private readonly youtubeStats: YoutubeStatsService,
    private readonly instagramStats: InstagramStatsService,
    private readonly storage: StorageService,
  ) {}

  async getOverview(userId: string, refresh = false) {
    if (refresh) {
      await this.refreshMetrics(userId);
    }

    const [platforms, publications, counts] = await Promise.all([
      this.platformsRepo.listByUser(userId),
      this.listAllPosted(userId, 100),
      this.countAll(userId),
    ]);

    const enrichedPublications = await Promise.all(
      publications.map((pub) => this.enrichPublication(pub)),
    );

    const byPlatform: Record<
      string,
      { posted_count: number; total_views: number; total_likes: number }
    > = {};

    let totalViews = 0;
    let totalLikes = 0;

    for (const pub of enrichedPublications) {
      const key = pub.platform;
      if (!byPlatform[key]) {
        byPlatform[key] = { posted_count: 0, total_views: 0, total_likes: 0 };
      }
      byPlatform[key].posted_count += 1;
      byPlatform[key].total_views += pub.view_count ?? 0;
      byPlatform[key].total_likes += pub.like_count ?? 0;
      totalViews += pub.view_count ?? 0;
      totalLikes += pub.like_count ?? 0;
    }

    return {
      summary: {
        posted_count: counts.posted,
        failed_count: counts.failed,
        pending_count: counts.pending,
        total_views: totalViews,
        total_likes: totalLikes,
        connected_platforms_count: platforms.length,
      },
      connected_platforms: platforms.map((p) => ({
        platform: p.platform,
        platform_label: PLATFORM_LABELS[p.platform] ?? p.platform,
        account_name: p.account_name,
        auth_status: p.auth_status,
        can_post: p.auth_status === 'authorized' && p.has_tokens,
        metrics_supported: p.platform === 'youtube' || p.platform === 'instagram',
      })),
      by_platform: byPlatform,
      publications: enrichedPublications,
    };
  }

  /**
   * Clip-section posts and Content Scheduler posts together, newest first.
   * A post that appears in both (same platform post id) is counted once.
   */
  private async listAllPosted(userId: string, limit: number): Promise<PostedPublicationRow[]> {
    const [direct, scheduled] = await Promise.all([
      this.publicationsRepo.listPostedByUser(userId, limit),
      this.publicationsRepo.listScheduledPostedByUser(userId, limit),
    ]);
    const seen = new Set(direct.map((p) => `${p.platform}:${p.platform_post_id}`).filter((k) => !k.endsWith(':null')));
    const merged = [
      ...direct.map((p) => ({ ...p, source: 'clip' as const })),
      ...scheduled.filter((p) => !p.platform_post_id || !seen.has(`${p.platform}:${p.platform_post_id}`)),
    ];
    return merged
      .sort((a, b) => Date.parse(b.posted_at ?? '') - Date.parse(a.posted_at ?? '') || 0)
      .slice(0, limit);
  }

  private async countAll(userId: string) {
    const [a, b] = await Promise.all([
      this.publicationsRepo.countByUser(userId),
      this.publicationsRepo.countScheduledByUser(userId),
    ]);
    return { posted: a.posted + b.posted, failed: a.failed + b.failed, pending: a.pending + b.pending };
  }

  async refreshMetrics(userId: string) {
    const publications = await this.listAllPosted(userId, 200);

    const [youtubeRefreshed, instagramRefreshed] = await Promise.all([
      this.refreshYoutubeMetrics(userId, publications),
      this.refreshInstagramMetrics(userId, publications),
    ]);

    return { refreshed: youtubeRefreshed + instagramRefreshed };
  }

  private async refreshYoutubeMetrics(
    userId: string,
    publications: PostedPublicationRow[],
  ): Promise<number> {
    const youtubeConn = await this.platformsRepo.getByPlatform(userId, 'youtube');
    if (!youtubeConn?.access_token) return 0;

    const youtubePosts = publications.filter(
      (p) => p.platform === 'youtube' && p.platform_post_id,
    );
    if (!youtubePosts.length) return 0;

    const videoIds = youtubePosts.map((p) => p.platform_post_id!).filter(Boolean);

    const stats = await this.youtubeStats.fetchVideoStats(
      youtubeConn.access_token,
      videoIds,
      youtubeConn.refresh_token,
      async (tokens) => {
        await this.platformsRepo.saveOAuthTokens(userId, 'youtube', {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokens.expires_at,
        });
      },
    );

    const statsMap = new Map(stats.map((s) => [s.videoId, s]));

    // Each row's update is independent, so write them together instead of
    // one round trip per post — this loop is why refreshing a busy account
    // crawled.
    const updates = youtubePosts
      .map((pub) => ({ pub, stat: statsMap.get(pub.platform_post_id!) }))
      .filter((entry) => entry.stat);

    await Promise.all(
      updates.map(({ pub, stat }) =>
        this.publicationsRepo.updateMetrics(
          pub.id,
          {
            view_count: stat!.viewCount,
            like_count: stat!.likeCount,
            comment_count: stat!.commentCount,
          },
          pub.source === 'scheduler' ? 'scheduler' : 'clip',
        ),
      ),
    );

    return updates.length;
  }

  private async refreshInstagramMetrics(
    userId: string,
    publications: PostedPublicationRow[],
  ): Promise<number> {
    const igConn = await this.platformsRepo.getByPlatform(userId, 'instagram');
    if (!igConn?.access_token) return 0;

    const igPosts = publications.filter(
      (p) => p.platform === 'instagram' && p.platform_post_id,
    );
    if (!igPosts.length) return 0;

    const mediaIds = igPosts.map((p) => p.platform_post_id!).filter(Boolean);
    const stats = await this.instagramStats.fetchMediaStats(igConn.access_token, mediaIds);
    const statsMap = new Map(stats.map((s) => [s.mediaId, s]));

    const updates = igPosts
      .map((pub) => ({ pub, stat: statsMap.get(pub.platform_post_id!) }))
      .filter((entry) => entry.stat);

    await Promise.all(
      updates.map(({ pub, stat }) =>
        this.publicationsRepo.updateMetrics(
          pub.id,
          {
            view_count: stat!.viewCount,
            like_count: stat!.likeCount,
            comment_count: stat!.commentCount,
          },
          pub.source === 'scheduler' ? 'scheduler' : 'clip',
        ),
      ),
    );

    return updates.length;
  }

  private async enrichPublication(pub: PostedPublicationRow) {
    const bucket = this.storage.clipsBucket();
    let thumbnail_url: string | null = pub.source === 'scheduler' ? pub.clip_thumbnail_url : null;

    if (!thumbnail_url && pub.clip_storage_path) {
      const thumbPath = this.storage.clipThumbPath(pub.clip_storage_path);
      if (await this.storage.objectExists(bucket, thumbPath)) {
        thumbnail_url = await this.storage.createSignedDownloadUrl(bucket, thumbPath);
      }
    }

    return {
      id: pub.id,
      clip_id: pub.clip_id || null,
      source: pub.source ?? 'clip',
      clip_title: pub.clip_title,
      platform: pub.platform,
      platform_label: PLATFORM_LABELS[pub.platform] ?? pub.platform,
      platform_post_id: pub.platform_post_id,
      platform_post_url: pub.platform_post_url,
      posted_at: pub.posted_at,
      view_count: Number(pub.view_count ?? 0),
      like_count: Number(pub.like_count ?? 0),
      comment_count: Number(pub.comment_count ?? 0),
      metrics_updated_at: pub.metrics_updated_at,
      metrics_supported: pub.platform === 'youtube' || pub.platform === 'instagram',
      thumbnail_url,
    };
  }
}
