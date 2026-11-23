import { AnalyticsService } from './analytics.service';
import { PublicationsRepository, type PostedPublicationRow } from '../clips/publications.repository';
import { PlatformsRepository } from '../platforms/platforms.repository';
import { StorageService } from '../storage/storage.service';
import { YoutubeStatsService } from './youtube-stats.service';
import { InstagramStatsService } from './instagram-stats.service';

function makePublicationsRepo() {
  return {
    listPostedByUser: jest.fn(),
    countByUser: jest.fn(),
    updateMetrics: jest.fn(),
    listScheduledPostedByUser: jest.fn().mockResolvedValue([]),
    countScheduledByUser: jest.fn().mockResolvedValue({ posted: 0, failed: 0, pending: 0 }),
  } as unknown as jest.Mocked<PublicationsRepository>;
}

function makePlatformsRepo() {
  return {
    listByUser: jest.fn(),
    getByPlatform: jest.fn(),
    saveOAuthTokens: jest.fn(),
  } as unknown as jest.Mocked<PlatformsRepository>;
}

function makeStorage() {
  return {
    clipsBucket: jest.fn().mockReturnValue('clips'),
    clipThumbPath: jest.fn((path: string) => `${path}_thumb.jpg`),
    parseObjectPathFromUrl: jest.fn((url: string | null) => (url?.startsWith('https://sb/') ? url.slice(11) : null)),
    objectExists: jest.fn(),
    createSignedDownloadUrl: jest.fn(),
  } as unknown as jest.Mocked<StorageService>;
}

function makeYoutubeStats() {
  return { fetchVideoStats: jest.fn() } as unknown as jest.Mocked<YoutubeStatsService>;
}

function makeInstagramStats() {
  return { fetchMediaStats: jest.fn() } as unknown as jest.Mocked<InstagramStatsService>;
}

function makePublication(overrides: Partial<PostedPublicationRow> = {}): PostedPublicationRow {
  return {
    id: 'pub1',
    user_id: 'u1',
    clip_id: 'clip1',
    platform: 'youtube',
    status: 'posted',
    platform_post_id: 'video1',
    platform_post_url: 'https://youtube.com/v/video1',
    error_message: null,
    job_id: null,
    posted_at: '2024-01-01T00:00:00Z',
    view_count: 10,
    like_count: 2,
    comment_count: 1,
    metrics_updated_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    clip_title: 'My Clip',
    clip_thumbnail_url: null,
    clip_storage_path: 'clip1.mp4',
    clip_viral_score: 0.9,
    ...overrides,
  };
}

describe('AnalyticsService', () => {
  let publicationsRepo: jest.Mocked<PublicationsRepository>;
  let platformsRepo: jest.Mocked<PlatformsRepository>;
  let storage: jest.Mocked<StorageService>;
  let youtubeStats: jest.Mocked<YoutubeStatsService>;
  let instagramStats: jest.Mocked<InstagramStatsService>;
  let service: AnalyticsService;

  beforeEach(() => {
    publicationsRepo = makePublicationsRepo();
    platformsRepo = makePlatformsRepo();
    storage = makeStorage();
    youtubeStats = makeYoutubeStats();
    instagramStats = makeInstagramStats();
    service = new AnalyticsService(
      publicationsRepo,
      platformsRepo,
      youtubeStats,
      instagramStats,
      storage,
    );
  });

  describe('getOverview', () => {
    it('defaults refresh to false when the argument is omitted', async () => {
      platformsRepo.listByUser.mockResolvedValue([]);
      publicationsRepo.listPostedByUser.mockResolvedValue([]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 0, failed: 0, pending: 0 });

      const refreshSpy = jest.spyOn(service, 'refreshMetrics');
      await service.getOverview('u1');

      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('accumulates multiple posted publications on the same platform under one by_platform bucket', async () => {
      platformsRepo.listByUser.mockResolvedValue([
        { platform: 'instagram', account_name: 'IG', auth_status: 'authorized', has_tokens: false } as never,
      ]);
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ id: 'p1', platform: 'instagram', view_count: 10, like_count: 1, clip_storage_path: null }),
        makePublication({ id: 'p2', platform: 'instagram', view_count: 20, like_count: 2, clip_storage_path: null }),
      ]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 2, failed: 0, pending: 0 });

      const result = await service.getOverview('u1', false);

      expect(result.by_platform).toEqual({
        instagram: { posted_count: 2, total_views: 30, total_likes: 3 },
      });
      expect(result.connected_platforms[0]).toEqual(
        expect.objectContaining({ platform: 'instagram', can_post: false, metrics_supported: true }),
      );
    });

    it('aggregates summary, connected platforms, by_platform, and enriched publications', async () => {
      platformsRepo.listByUser.mockResolvedValue([
        { platform: 'youtube', account_name: 'Chan', auth_status: 'authorized', has_tokens: true } as never,
        { platform: 'tiktok', account_name: 'Tik', auth_status: 'connected', has_tokens: false } as never,
      ]);
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ platform: 'youtube', view_count: 100, like_count: 5 }),
        makePublication({ id: 'pub2', platform: 'instagram', view_count: 50, like_count: 3, clip_storage_path: null }),
      ]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 2, failed: 1, pending: 0 });
      storage.objectExists.mockResolvedValue(false);

      const result = await service.getOverview('u1', false);

      expect(result.summary).toEqual({
        posted_count: 2,
        failed_count: 1,
        pending_count: 0,
        total_views: 150,
        total_likes: 8,
        connected_platforms_count: 2,
      });
      expect(result.connected_platforms).toEqual([
        expect.objectContaining({
          platform: 'youtube',
          platform_label: 'YouTube Shorts',
          can_post: true,
          metrics_supported: true,
        }),
        expect.objectContaining({
          platform: 'tiktok',
          platform_label: 'TikTok',
          can_post: false,
          metrics_supported: false,
        }),
      ]);
      expect(result.by_platform).toEqual({
        youtube: { posted_count: 1, total_views: 100, total_likes: 5 },
        instagram: { posted_count: 1, total_views: 50, total_likes: 3 },
      });
      expect(result.publications).toHaveLength(2);
      expect(result.publications[0]).toEqual(
        expect.objectContaining({ id: 'pub1', platform: 'youtube', thumbnail_url: null }),
      );
    });

    it('refreshes metrics first when refresh=true', async () => {
      platformsRepo.listByUser.mockResolvedValue([]);
      publicationsRepo.listPostedByUser.mockResolvedValue([]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 0, failed: 0, pending: 0 });
      platformsRepo.getByPlatform.mockResolvedValue(null);

      const refreshSpy = jest.spyOn(service, 'refreshMetrics');
      await service.getOverview('u1', true);

      expect(refreshSpy).toHaveBeenCalledWith('u1');
    });

    it('produces a thumbnail_url when the thumbnail object exists in storage', async () => {
      platformsRepo.listByUser.mockResolvedValue([]);
      publicationsRepo.listPostedByUser.mockResolvedValue([makePublication()]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 1, failed: 0, pending: 0 });
      storage.objectExists.mockResolvedValue(true);
      storage.createSignedDownloadUrl.mockResolvedValue('https://signed.example.com/thumb.jpg');

      const result = await service.getOverview('u1', false);

      expect(storage.clipThumbPath).toHaveBeenCalledWith('clip1.mp4');
      expect(result.publications[0].thumbnail_url).toBe('https://signed.example.com/thumb.jpg');
    });

    it('signs scheduler thumbnails and falls back to a video preview for uploads', async () => {
      platformsRepo.listByUser.mockResolvedValue([]);
      publicationsRepo.listPostedByUser.mockResolvedValue([]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 0, failed: 0, pending: 0 });
      (publicationsRepo as any).listScheduledPostedByUser.mockResolvedValue([
        makePublication({ id: 't1', source: 'scheduler', clip_thumbnail_url: 'https://sb/u/a_thumb.jpg', clip_storage_path: 'u/a.mp4', posted_at: '2026-11-23T00:00:00Z' }),
        makePublication({ id: 't2', source: 'scheduler', clip_thumbnail_url: null, clip_storage_path: 'u/scheduled/b.mp4', posted_at: '2026-11-22T00:00:00Z' }),
        makePublication({ id: 't3', source: 'scheduler', clip_thumbnail_url: 'https://cdn.example/x.jpg', clip_storage_path: null, posted_at: '2026-11-21T00:00:00Z' }),
      ]);
      storage.objectExists.mockImplementation(async (_b: string, p: string) => p === 'u/a_thumb.jpg');
      storage.createSignedDownloadUrl.mockImplementation(async (_b: string, p: string) => `https://signed/${p}`);

      const { publications } = await service.getOverview('u1', false);

      expect(publications.map((p: any) => [p.id, p.thumbnail_url, p.preview_url])).toEqual([
        ['t1', 'https://signed/u/a_thumb.jpg', null],
        ['t2', null, 'https://signed/u/scheduled/b.mp4'],
        ['t3', 'https://cdn.example/x.jpg', null],
      ]);
    });

    it('returns no thumbnail when storage fails', async () => {
      platformsRepo.listByUser.mockResolvedValue([]);
      publicationsRepo.listPostedByUser.mockResolvedValue([makePublication()]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 1, failed: 0, pending: 0 });
      storage.objectExists.mockRejectedValue(new Error('down'));
      const { publications } = await service.getOverview('u1', false);
      expect(publications[0].thumbnail_url).toBeNull();
    });

    it('leaves thumbnail_url null when the publication has no clip_storage_path', async () => {
      platformsRepo.listByUser.mockResolvedValue([]);
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ clip_storage_path: null }),
      ]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 1, failed: 0, pending: 0 });

      const result = await service.getOverview('u1', false);

      expect(storage.objectExists).not.toHaveBeenCalled();
      expect(result.publications[0].thumbnail_url).toBeNull();
    });

    it('falls back to raw platform value and Untitled clip defaults when unknown/missing', async () => {
      platformsRepo.listByUser.mockResolvedValue([]);
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ platform: 'mystery' as never, clip_title: undefined as never, clip_storage_path: null }),
      ]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 1, failed: 0, pending: 0 });

      const result = await service.getOverview('u1', false);

      expect(result.publications[0].platform_label).toBe('mystery');
      expect(result.publications[0].metrics_supported).toBe(false);
    });

    it('coerces null-ish view/like/comment counts to numbers', async () => {
      platformsRepo.listByUser.mockResolvedValue([]);
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({
          view_count: null as never,
          like_count: null as never,
          comment_count: null as never,
          clip_storage_path: null,
        }),
      ]);
      publicationsRepo.countByUser.mockResolvedValue({ posted: 1, failed: 0, pending: 0 });

      const result = await service.getOverview('u1', false);

      expect(result.publications[0]).toEqual(
        expect.objectContaining({ view_count: 0, like_count: 0, comment_count: 0 }),
      );
      expect(result.summary.total_views).toBe(0);
      expect(result.summary.total_likes).toBe(0);
    });
  });

  describe('refreshMetrics', () => {
    it('returns the sum of youtube and instagram refreshed counts', async () => {
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ id: 'yt1', platform: 'youtube', platform_post_id: 'v1' }),
        makePublication({ id: 'ig1', platform: 'instagram', platform_post_id: 'm1' }),
      ]);
      platformsRepo.getByPlatform.mockImplementation(async (_userId, platform) => {
        if (platform === 'youtube') {
          return { access_token: 'yt-token', refresh_token: 'yt-refresh' } as never;
        }
        if (platform === 'instagram') {
          return { access_token: 'ig-token' } as never;
        }
        return null;
      });
      youtubeStats.fetchVideoStats.mockResolvedValue([
        { videoId: 'v1', viewCount: 10, likeCount: 2, commentCount: 1 },
      ]);
      instagramStats.fetchMediaStats.mockResolvedValue([
        { mediaId: 'm1', viewCount: 20, likeCount: 4, commentCount: 2 },
      ]);

      const result = await service.refreshMetrics('u1');

      expect(result).toEqual({ refreshed: 2 });
      expect(publicationsRepo.updateMetrics).toHaveBeenCalledWith('yt1', {
        view_count: 10,
        like_count: 2,
        comment_count: 1,
      }, 'clip');
      expect(publicationsRepo.updateMetrics).toHaveBeenCalledWith('ig1', {
        view_count: 20,
        like_count: 4,
        comment_count: 2,
      }, 'clip');
    });

    it('includes Content Scheduler posts, stores their stats on the target, and skips duplicates', async () => {
      publicationsRepo.listPostedByUser.mockResolvedValue([
        { id: 'p1', platform: 'youtube', platform_post_id: 'vidA', posted_at: '2026-11-20T00:00:00Z', clip_title: 'A' },
      ] as never);
      (publicationsRepo as any).listScheduledPostedByUser.mockResolvedValue([
        { id: 't1', platform: 'youtube', platform_post_id: 'vidB', posted_at: '2026-11-22T00:00:00Z', clip_title: 'B', source: 'scheduler' },
        { id: 't2', platform: 'youtube', platform_post_id: 'vidA', posted_at: '2026-11-21T00:00:00Z', clip_title: 'dup', source: 'scheduler' },
      ]);
      platformsRepo.getByPlatform.mockImplementation(async (_u: string, p: string) => (p === 'youtube' ? { access_token: 'tok' } : null) as never);
      youtubeStats.fetchVideoStats.mockResolvedValue([
        { videoId: 'vidA', viewCount: 1, likeCount: 0, commentCount: 0 },
        { videoId: 'vidB', viewCount: 46, likeCount: 3, commentCount: 1 },
      ] as never);

      await service.refreshMetrics('u1');

      expect(publicationsRepo.updateMetrics).toHaveBeenCalledWith('t1', { view_count: 46, like_count: 3, comment_count: 1 }, 'scheduler');
      expect(publicationsRepo.updateMetrics).toHaveBeenCalledWith('p1', { view_count: 1, like_count: 0, comment_count: 0 }, 'clip');
      expect(publicationsRepo.updateMetrics).not.toHaveBeenCalledWith('t2', expect.anything(), expect.anything());
    });

    it('returns 0 for youtube when there is no connected access token', async () => {
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ platform: 'youtube', platform_post_id: 'v1' }),
      ]);
      platformsRepo.getByPlatform.mockResolvedValue(null);

      const result = await service.refreshMetrics('u1');

      expect(result.refreshed).toBe(0);
      expect(youtubeStats.fetchVideoStats).not.toHaveBeenCalled();
    });

    it('returns 0 for youtube when there are no posted youtube publications', async () => {
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ platform: 'instagram', platform_post_id: 'm1' }),
      ]);
      platformsRepo.getByPlatform.mockResolvedValue({ access_token: 'yt-token' } as never);
      instagramStats.fetchMediaStats.mockResolvedValue([]);

      const result = await service.refreshMetrics('u1');

      expect(youtubeStats.fetchVideoStats).not.toHaveBeenCalled();
      expect(result.refreshed).toBe(0);
    });

    it('skips publications without a platform_post_id', async () => {
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ platform: 'youtube', platform_post_id: null }),
      ]);
      platformsRepo.getByPlatform.mockResolvedValue({ access_token: 'yt-token' } as never);

      const result = await service.refreshMetrics('u1');

      expect(youtubeStats.fetchVideoStats).not.toHaveBeenCalled();
      expect(result.refreshed).toBe(0);
    });

    it('skips a publication whose id is missing from the fetched stats map', async () => {
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ id: 'yt1', platform: 'youtube', platform_post_id: 'v1' }),
      ]);
      platformsRepo.getByPlatform.mockResolvedValue({ access_token: 'yt-token' } as never);
      youtubeStats.fetchVideoStats.mockResolvedValue([]);

      const result = await service.refreshMetrics('u1');

      expect(publicationsRepo.updateMetrics).not.toHaveBeenCalled();
      expect(result.refreshed).toBe(0);
    });

    it('persists refreshed youtube tokens via saveOAuthTokens when the token-refresh callback fires', async () => {
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ id: 'yt1', platform: 'youtube', platform_post_id: 'v1' }),
      ]);
      platformsRepo.getByPlatform.mockResolvedValue({
        access_token: 'expired',
        refresh_token: 'refresh-tok',
      } as never);
      youtubeStats.fetchVideoStats.mockImplementation(async (_token, _ids, _refresh, onTokenRefresh) => {
        await onTokenRefresh?.({ access_token: 'new-token', refresh_token: 'new-refresh', expires_at: 'exp' });
        return [{ videoId: 'v1', viewCount: 1, likeCount: 1, commentCount: 1 }];
      });

      await service.refreshMetrics('u1');

      expect(platformsRepo.saveOAuthTokens).toHaveBeenCalledWith('u1', 'youtube', {
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        token_expires_at: 'exp',
      });
    });

    it('returns 0 for instagram when there is no connected access token', async () => {
      publicationsRepo.listPostedByUser.mockResolvedValue([
        makePublication({ platform: 'instagram', platform_post_id: 'm1' }),
      ]);
      platformsRepo.getByPlatform.mockResolvedValue(null);

      const result = await service.refreshMetrics('u1');

      expect(result.refreshed).toBe(0);
      expect(instagramStats.fetchMediaStats).not.toHaveBeenCalled();
    });
  });
});
