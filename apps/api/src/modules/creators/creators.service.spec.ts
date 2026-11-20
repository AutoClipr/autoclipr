import { CreatorsService } from './creators.service';
import { CreatorChannelRow } from './creators.repository';

const row = (id: string, o: Partial<CreatorChannelRow> = {}): CreatorChannelRow => ({
  channel_id: id, channel_handle: `@${id}`, channel_name: id.toUpperCase(), description: null, avatar_url: null,
  country: 'US', category: 'Music', subscriber_count: null, total_views: null, video_count: null,
  published_at: null, last_fetched_at: null, ...o,
});

const ytRes = (items: unknown[], status = 200) =>
  ({ ok: status === 200, status, json: async () => ({ items }) }) as unknown as Response;

describe('CreatorsService', () => {
  let repo: Record<string, jest.Mock>;
  let key: string | undefined;
  let svc: CreatorsService;

  beforeEach(() => {
    key = 'k';
    repo = {
      listActive: jest.fn(),
      lastSuccessfulRefresh: jest.fn().mockResolvedValue('2026-01-01T00:00:00Z'),
      startRun: jest.fn().mockResolvedValue('run'),
      finishRun: jest.fn().mockResolvedValue(undefined),
      saveStats: jest.fn().mockResolvedValue(undefined),
      markError: jest.fn().mockResolvedValue(undefined),
    };
    svc = new CreatorsService(repo as never, { get: () => key } as never);
  });

  describe('leaderboard', () => {
    const rows = [
      row('a', { subscriber_count: 100, total_views: 5, video_count: 9 }),
      row('b', { subscriber_count: 300, total_views: 50, video_count: 1, category: 'Kids' }),
      row('c', { subscriber_count: 100, total_views: null, video_count: 9 }),
      row('d', { channel_name: 'Hidden', category: 'Kids' }),
    ];
    const base = { sort: 'rank' as const, page: 1, pageSize: 20 };

    beforeEach(() => repo.listActive.mockResolvedValue(rows));

    it('ranks by subscribers with ties sharing a rank and hidden counts last', async () => {
      const lb = await svc.leaderboard(base);
      expect(lb.items.map((i) => [i.channelId, i.globalRank, i.position])).toEqual([
        ['b', 1, 1], ['a', 2, 2], ['c', 2, 3], ['d', null, 4],
      ]);
      expect(lb.categories).toEqual([{ name: 'Kids', count: 2 }, { name: 'Music', count: 2 }]);
      expect(lb.lastRefreshedAt).toBe('2026-01-01T00:00:00Z');
      expect(lb.trackedChannels).toBe(4);
    });

    it('sorts by views and videos with stable tie-break', async () => {
      expect((await svc.leaderboard({ ...base, sort: 'views' })).items.map((i) => i.channelId)).toEqual(['b', 'a', 'c', 'd']);
      expect((await svc.leaderboard({ ...base, sort: 'videos' })).items.map((i) => i.channelId)).toEqual(['a', 'c', 'b', 'd']);
    });

    it('filters by category with a category rank, and searches name/handle/id', async () => {
      const kids = await svc.leaderboard({ ...base, category: 'kids' });
      expect(kids.items.map((i) => [i.channelId, i.globalRank, i.categoryRank])).toEqual([['b', 1, 1], ['d', null, null]]);
      expect((await svc.leaderboard({ ...base, q: 'hidd' })).items.map((i) => i.channelId)).toEqual(['d']);
      expect((await svc.leaderboard({ ...base, q: '@c' })).items.map((i) => i.channelId)).toEqual(['c']);
      expect((await svc.leaderboard({ ...base, q: 'B' })).items.map((i) => i.channelId)).toEqual(['b']);
    });

    it('paginates and clamps the page', async () => {
      const p2 = await svc.leaderboard({ ...base, page: 9, pageSize: 3 });
      expect([p2.page, p2.totalPages, p2.items.length, p2.items[0].position]).toEqual([2, 2, 1, 4]);
      const none = await svc.leaderboard({ ...base, q: 'zzz' });
      expect([none.total, none.totalPages, none.page]).toEqual([0, 1, 1]);
    });

    it('caches the snapshot', async () => {
      await svc.leaderboard(base);
      await svc.leaderboard(base);
      expect(repo.listActive).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    const yt = {
      id: 'a',
      snippet: { title: 'A!', customUrl: '@aa', description: 'desc', country: 'IN', publishedAt: 'p', thumbnails: { high: { url: 'h' } } },
      statistics: { subscriberCount: '10', viewCount: '20', videoCount: '3' },
    };

    it('skips without an API key', async () => {
      key = undefined;
      await expect(svc.refresh()).resolves.toEqual({ ok: 0, failed: 0, skipped: 'YOUTUBE_API_KEY not set' });
      expect(repo.startRun).not.toHaveBeenCalled();
    });

    it('saves stats, re-resolves by handle and records missing channels', async () => {
      repo.listActive.mockResolvedValue([row('a'), row('b'), row('c', { channel_handle: null }), row('e')]);
      const fetchFn = jest.fn()
        .mockResolvedValueOnce(ytRes([yt]))
        .mockResolvedValueOnce(ytRes([{ id: 'b2', statistics: { hiddenSubscriberCount: true, viewCount: 'x' } }]))
        .mockResolvedValueOnce(ytRes([]));
      svc.fetchFn = fetchFn;

      await expect(svc.refresh()).resolves.toEqual({ ok: 2, failed: 2 });
      expect(repo.saveStats).toHaveBeenCalledWith('a', expect.objectContaining({
        channel_name: 'A!', channel_handle: '@aa', avatar_url: 'h', country: 'IN', subscriber_count: 10, total_views: 20, video_count: 3,
      }));
      expect(repo.saveStats).toHaveBeenCalledWith('b', expect.objectContaining({
        channel_id: 'b2', channel_name: 'B', subscriber_count: null, total_views: null, avatar_url: null, country: 'US',
      }));
      expect(fetchFn.mock.calls[1][0]).toContain('forHandle=%40b');
      expect(repo.markError).toHaveBeenCalledWith('c', 'Channel not returned by YouTube');
      expect(repo.finishRun).toHaveBeenCalledWith('run', { succeeded: true, ok: 2, failed: 2, error: null });
    });

    it('records a per-channel save failure', async () => {
      repo.listActive.mockResolvedValue([row('a')]);
      repo.saveStats.mockRejectedValue(new Error('db'));
      repo.markError.mockRejectedValue(new Error('also'));
      svc.fetchFn = jest.fn().mockResolvedValue(ytRes([yt]));
      await expect(svc.refresh()).resolves.toEqual({ ok: 0, failed: 1 });
    });

    it('retries once on 5xx then fails the batch, keeping cached data', async () => {
      jest.useFakeTimers();
      repo.listActive.mockResolvedValue([row('a')]);
      svc.fetchFn = jest.fn().mockResolvedValue(ytRes([], 503));
      const p = svc.refresh();
      await jest.advanceTimersByTimeAsync(2000);
      await expect(p).resolves.toEqual({ ok: 0, failed: 1 });
      expect(svc.fetchFn).toHaveBeenCalledTimes(2);
      expect(repo.finishRun).toHaveBeenCalledWith('run', { succeeded: false, ok: 0, failed: 1, error: 'YouTube API 503' });
      jest.useRealTimers();
    });

    it('does not retry a 403', async () => {
      repo.listActive.mockResolvedValue([row('a')]);
      svc.fetchFn = jest.fn().mockResolvedValue(ytRes([], 403));
      await svc.refresh();
      expect(svc.fetchFn).toHaveBeenCalledTimes(1);
    });

    it('records a fatal listing error and refuses overlapping runs', async () => {
      let release!: (v: CreatorChannelRow[]) => void;
      repo.listActive.mockReturnValueOnce(new Promise((r) => (release = r)));
      const first = svc.refresh();
      await Promise.resolve();
      await expect(svc.refresh()).resolves.toEqual({ ok: 0, failed: 0, skipped: 'already running' });
      release([]);
      await first;

      repo.listActive.mockRejectedValueOnce(new Error('list'));
      await svc.refresh();
      expect(repo.finishRun).toHaveBeenLastCalledWith('run', { succeeded: false, ok: 0, failed: 0, error: 'list' });
    });
  });

  describe('schedule & bootstrap', () => {
    it('logs refresh results and swallows crashes', async () => {
      key = undefined;
      await expect(svc.scheduledRefresh()).resolves.toBeUndefined();
      key = 'k';
      repo.startRun.mockRejectedValueOnce(new Error('x'));
      await expect(svc.scheduledRefresh()).resolves.toBeUndefined();
      repo.listActive.mockResolvedValue([]);
      await expect(svc.refresh()).resolves.toEqual({ ok: 0, failed: 0 });
    });

    it('refreshes on boot only when never refreshed', async () => {
      const spy = jest.spyOn(svc, 'scheduledRefresh').mockResolvedValue();
      await svc.onApplicationBootstrap();
      expect(spy).not.toHaveBeenCalled();
      repo.lastSuccessfulRefresh.mockResolvedValueOnce(null);
      await svc.onApplicationBootstrap();
      expect(spy).toHaveBeenCalledTimes(1);
      repo.lastSuccessfulRefresh.mockRejectedValueOnce(new Error('db'));
      await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
    });
  });
});
