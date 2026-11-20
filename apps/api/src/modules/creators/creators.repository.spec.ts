import { CreatorsRepository } from './creators.repository';
import { createMockSupabaseClient, mockQueryBuilder, mockSupabaseAdminService } from '../../test-utils/supabase-mock';

describe('CreatorsRepository', () => {
  let client: ReturnType<typeof createMockSupabaseClient>;
  let repo: CreatorsRepository;
  const err = { data: null, error: { message: 'boom' } };

  beforeEach(() => {
    client = createMockSupabaseClient();
    repo = new CreatorsRepository(mockSupabaseAdminService(client) as never);
  });

  it('lists active channels', async () => {
    const b = mockQueryBuilder({ data: [{ channel_id: 'a' }], error: null });
    client.from.mockReturnValue(b);
    await expect(repo.listActive()).resolves.toEqual([{ channel_id: 'a' }]);
    expect(client.from).toHaveBeenCalledWith('creator_channels');
    expect(b.eq).toHaveBeenCalledWith('is_active', true);
  });

  it('returns [] when no rows and throws on error', async () => {
    client.from.mockReturnValueOnce(mockQueryBuilder({ data: null, error: null }));
    await expect(repo.listActive()).resolves.toEqual([]);
    client.from.mockReturnValueOnce(mockQueryBuilder(err));
    await expect(repo.listActive()).rejects.toThrow('boom');
  });

  it('reads the last successful refresh', async () => {
    client.from.mockReturnValueOnce(mockQueryBuilder({ data: { finished_at: 't' }, error: null }));
    await expect(repo.lastSuccessfulRefresh()).resolves.toBe('t');
    client.from.mockReturnValueOnce(mockQueryBuilder({ data: null, error: null }));
    await expect(repo.lastSuccessfulRefresh()).resolves.toBeNull();
    client.from.mockReturnValueOnce(mockQueryBuilder(err));
    await expect(repo.lastSuccessfulRefresh()).rejects.toThrow('boom');
  });

  it('starts and finishes runs', async () => {
    client.from.mockReturnValueOnce(mockQueryBuilder({ data: { id: 'r1' }, error: null }));
    await expect(repo.startRun()).resolves.toBe('r1');
    client.from.mockReturnValueOnce(mockQueryBuilder(err));
    await expect(repo.startRun()).rejects.toThrow('boom');

    const b = mockQueryBuilder({ data: null, error: null });
    client.from.mockReturnValueOnce(b);
    await repo.finishRun('r1', { succeeded: true, ok: 2, failed: 0 });
    expect(b.update).toHaveBeenCalledWith(expect.objectContaining({ succeeded: true, channels_ok: 2, error: null }));
    client.from.mockReturnValueOnce(mockQueryBuilder(err));
    await expect(repo.finishRun('r1', { succeeded: false, ok: 0, failed: 1, error: 'x' })).rejects.toThrow('boom');
  });

  const stats = {
    channel_id: 'new', channel_name: 'N', channel_handle: null, description: null, avatar_url: null,
    country: null, subscriber_count: 1, total_views: 2, video_count: 3, published_at: null,
  };

  it('saves stats and a history snapshot', async () => {
    const upd = mockQueryBuilder({ data: null, error: null });
    const ins = mockQueryBuilder({ data: null, error: null });
    client.from.mockReturnValueOnce(upd).mockReturnValueOnce(ins);
    await repo.saveStats('old', stats);
    expect(upd.eq).toHaveBeenCalledWith('channel_id', 'old');
    expect(ins.insert).toHaveBeenCalledWith(expect.objectContaining({ channel_id: 'new', subscriber_count: 1 }));
  });

  it('throws when saving fails at either step', async () => {
    client.from.mockReturnValueOnce(mockQueryBuilder(err));
    await expect(repo.saveStats('old', stats)).rejects.toThrow('boom');
    client.from.mockReturnValueOnce(mockQueryBuilder({ data: null, error: null })).mockReturnValueOnce(mockQueryBuilder(err));
    await expect(repo.saveStats('old', stats)).rejects.toThrow('boom');
  });

  it('marks errors', async () => {
    const b = mockQueryBuilder({ data: null, error: null });
    client.from.mockReturnValueOnce(b);
    await repo.markError('a', 'x'.repeat(600));
    expect(b.update.mock.calls[0][0].last_error).toHaveLength(500);
    client.from.mockReturnValueOnce(mockQueryBuilder(err));
    await expect(repo.markError('a', 'x')).rejects.toThrow('boom');
  });
});
