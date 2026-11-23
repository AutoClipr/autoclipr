import { PublicationsRepository } from './publications.repository';
import { SupabaseAdminService } from '../../database/supabase-admin.service';
import { createSupabaseMock, ChainableMock } from '../../test-utils/supabase-mock';

describe('PublicationsRepository', () => {
  let repo: PublicationsRepository;
  let chain: ChainableMock;
  let supabase: { getClient: jest.Mock };

  beforeEach(() => {
    chain = createSupabaseMock();
    supabase = { getClient: jest.fn().mockReturnValue(chain) };
    repo = new PublicationsRepository(supabase as unknown as SupabaseAdminService);
  });

  describe('listByClipIds', () => {
    it('returns [] without querying supabase when clipIds is empty', async () => {
      const result = await repo.listByClipIds([]);
      expect(result).toEqual([]);
      expect(supabase.getClient).not.toHaveBeenCalled();
    });

    it('returns publications on success', async () => {
      chain.__setResult({ data: [{ id: 'p1' }], error: null });
      const result = await repo.listByClipIds(['c1', 'c2']);
      expect(chain.in).toHaveBeenCalledWith('clip_id', ['c1', 'c2']);
      expect(result).toEqual([{ id: 'p1' }]);
    });

    it('defaults to [] when data is null', async () => {
      chain.__setResult({ data: null, error: null });
      const result = await repo.listByClipIds(['c1']);
      expect(result).toEqual([]);
    });

    it('throws when supabase returns an error', async () => {
      chain.__setResult({ data: null, error: { message: 'boom' } });
      await expect(repo.listByClipIds(['c1'])).rejects.toThrow('boom');
    });
  });

  describe('listByClip', () => {
    it('returns publications on success', async () => {
      chain.__setResult({ data: [{ id: 'p1' }], error: null });
      const result = await repo.listByClip('c1', 'u1');
      expect(chain.eq).toHaveBeenCalledWith('clip_id', 'c1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(result).toEqual([{ id: 'p1' }]);
    });

    it('defaults to [] when data is null', async () => {
      chain.__setResult({ data: null, error: null });
      const result = await repo.listByClip('c1', 'u1');
      expect(result).toEqual([]);
    });

    it('throws when supabase returns an error', async () => {
      chain.__setResult({ data: null, error: { message: 'boom' } });
      await expect(repo.listByClip('c1', 'u1')).rejects.toThrow('boom');
    });
  });

  describe('upsertPending', () => {
    it('returns the created publication on success', async () => {
      const row = { id: 'p1', status: 'pending' };
      chain.__setResult({ data: row, error: null });
      const result = await repo.upsertPending({
        user_id: 'u1',
        clip_id: 'c1',
        platform: 'youtube',
        job_id: 'j1',
      });
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', job_id: 'j1' }),
        { onConflict: 'clip_id,platform' },
      );
      expect(result).toBe(row);
    });

    it('defaults job_id to null when not given', async () => {
      chain.__setResult({ data: { id: 'p1' }, error: null });
      await repo.upsertPending({ user_id: 'u1', clip_id: 'c1', platform: 'tiktok' });
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ job_id: null }),
        expect.anything(),
      );
    });

    it('throws when supabase returns an error', async () => {
      chain.__setResult({ data: null, error: { message: 'boom' } });
      await expect(
        repo.upsertPending({ user_id: 'u1', clip_id: 'c1', platform: 'youtube' }),
      ).rejects.toThrow('boom');
    });

    it('throws when no row is returned', async () => {
      chain.__setResult({ data: null, error: null });
      await expect(
        repo.upsertPending({ user_id: 'u1', clip_id: 'c1', platform: 'youtube' }),
      ).rejects.toThrow('Failed to create publication');
    });
  });

  describe('listPostedByUser', () => {
    it('maps joined clip fields when clips is present', async () => {
      chain.__setResult({
        data: [
          {
            id: 'p1',
            clips: { title: 'Clip 1', thumbnail_url: 'thumb.jpg', viral_score: 9, storage_path: 'path' },
          },
        ],
        error: null,
      });
      const result = await repo.listPostedByUser('u1');
      expect(result[0]).toMatchObject({
        id: 'p1',
        clip_title: 'Clip 1',
        clip_thumbnail_url: 'thumb.jpg',
        clip_viral_score: 9,
        clip_storage_path: 'path',
      });
      expect((result[0] as unknown as { clips?: unknown }).clips).toBeUndefined();
    });

    it('falls back to defaults when clips is null', async () => {
      chain.__setResult({ data: [{ id: 'p1', clips: null }], error: null });
      const result = await repo.listPostedByUser('u1');
      expect(result[0]).toMatchObject({
        clip_title: 'Untitled clip',
        clip_thumbnail_url: null,
        clip_storage_path: null,
        clip_viral_score: null,
      });
    });

    it('defaults to [] when data is null', async () => {
      chain.__setResult({ data: null, error: null });
      const result = await repo.listPostedByUser('u1');
      expect(result).toEqual([]);
    });

    it('throws when supabase returns an error', async () => {
      chain.__setResult({ data: null, error: { message: 'boom' } });
      await expect(repo.listPostedByUser('u1')).rejects.toThrow('boom');
    });
  });

  describe('countByUser', () => {
    it('aggregates posted/failed/pending counts', async () => {
      const countsByStatus: Record<string, number> = { posted: 5, failed: 2, pending: 3 };

      // countByUser() calls `this.supabase.getClient()` once per status via
      // Promise.all, and awaiting a thenable defers the `.then()` call to a
      // microtask — by which time all three synchronous `.eq()` calls have
      // already run. A shared chain (and a shared "current count" variable)
      // would race and every call would resolve with the last status's
      // count. Returning a fresh, independently-scoped chain per
      // getClient() call keeps each status's result isolated.
      supabase.getClient.mockImplementation(() => {
        let capturedCount = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const localChain: any = {};
        localChain.from = jest.fn().mockReturnValue(localChain);
        localChain.select = jest.fn().mockReturnValue(localChain);
        localChain.eq = jest.fn().mockImplementation((field: string, value: string) => {
          if (field === 'status') capturedCount = countsByStatus[value];
          return localChain;
        });
        localChain.then = (
          resolve: (v: unknown) => unknown,
          reject: (e: unknown) => unknown,
        ) => Promise.resolve({ count: capturedCount, error: null }).then(resolve, reject);
        return localChain;
      });

      const result = await repo.countByUser('u1');
      expect(result).toEqual({ posted: 5, failed: 2, pending: 3 });
    });

    it('throws when any query returns an error', async () => {
      chain.__setResult({ data: null, error: { message: 'boom' }, count: null });
      await expect(repo.countByUser('u1')).rejects.toThrow('boom');
    });

    it('defaults a null count to 0', async () => {
      chain.__setResult({ data: null, error: null, count: null });
      const result = await repo.countByUser('u1');
      expect(result).toEqual({ posted: 0, failed: 0, pending: 0 });
    });
  });

  describe('updateMetrics', () => {
    it('resolves on success', async () => {
      chain.__setResult({ data: null, error: null });
      await expect(
        repo.updateMetrics('p1', { view_count: 1, like_count: 2, comment_count: 3 }),
      ).resolves.toBeUndefined();
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ view_count: 1, like_count: 2, comment_count: 3 }),
      );
    });

    it('throws when supabase returns an error', async () => {
      chain.__setResult({ data: null, error: { message: 'boom' } });
      await expect(
        repo.updateMetrics('p1', { view_count: 1, like_count: 2, comment_count: 3 }),
      ).rejects.toThrow('boom');
    });
  });

  describe('scheduler posts', () => {
    const row = (o: Record<string, unknown> = {}) => ({
      id: 't1', user_id: 'u1', platform: 'youtube', status: 'published', platform_post_id: 'v1', platform_post_url: 'u',
      error_message: null, published_at: '2026-11-22T00:00:00Z', view_count: null, like_count: 2, comment_count: 1,
      metrics_updated_at: null, created_at: 'c', updated_at: 'u',
      scheduled_posts: { clip_id: null, title: '', caption: 'First line\nmore', media_storage_path: 'm.mp4', media_thumbnail_url: 'thumb' },
      ...o,
    });

    it('maps published targets to posted publications', async () => {
      chain.__setResult({ data: [row(), row({ id: 't2', scheduled_posts: null })], error: null });
      const [a, b] = await repo.listScheduledPostedByUser('u1', 10);
      expect(chain.from).toHaveBeenCalledWith('scheduled_post_targets');
      expect(a).toMatchObject({
        id: 't1', source: 'scheduler', status: 'posted', clip_id: '', clip_title: 'First line',
        posted_at: '2026-11-22T00:00:00Z', view_count: 0, like_count: 2, clip_thumbnail_url: 'thumb', clip_storage_path: 'm.mp4',
      });
      expect(b).toMatchObject({ clip_title: 'Scheduled post', clip_thumbnail_url: null });
    });

    it('handles no rows and errors', async () => {
      chain.__setResult({ data: null, error: null });
      await expect(repo.listScheduledPostedByUser('u1')).resolves.toEqual([]);
      chain.__setResult({ data: null, error: { message: 'boom' } });
      await expect(repo.listScheduledPostedByUser('u1')).rejects.toThrow('boom');
    });

    it('counts targets by outcome', async () => {
      chain.__setResult({ data: null, error: null, count: 3 } as never);
      await expect(repo.countScheduledByUser('u1')).resolves.toEqual({ posted: 3, failed: 3, pending: 3 });
      chain.__setResult({ data: null, error: null, count: null } as never);
      await expect(repo.countScheduledByUser('u1')).resolves.toEqual({ posted: 0, failed: 0, pending: 0 });
      chain.__setResult({ data: null, error: { message: 'boom' } });
      await expect(repo.countScheduledByUser('u1')).rejects.toThrow('boom');
    });

    it('writes scheduler metrics to the target table', async () => {
      chain.__setResult({ data: null, error: null });
      await repo.updateMetrics('t1', { view_count: 1, like_count: 2, comment_count: 3 }, 'scheduler');
      expect(chain.from).toHaveBeenCalledWith('scheduled_post_targets');
    });
  });
});
