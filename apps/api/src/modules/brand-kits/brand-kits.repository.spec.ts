import { BrandKitsRepository } from './brand-kits.repository';
import { createMockSupabaseClient, mockQueryBuilder, mockSupabaseAdminService } from '../../test-utils/supabase-mock';

describe('BrandKitsRepository', () => {
  let client: ReturnType<typeof createMockSupabaseClient>;
  let repo: BrandKitsRepository;
  const ok = (data: unknown, extra: Record<string, unknown> = {}) => mockQueryBuilder({ data, error: null, ...extra });
  const err = () => mockQueryBuilder({ data: null, error: { message: 'boom' } });

  beforeEach(() => {
    client = createMockSupabaseClient();
    repo = new BrandKitsRepository(mockSupabaseAdminService(client) as never);
  });

  it('scopes reads to the owner', async () => {
    const b = ok([{ id: 'k1' }]);
    client.from.mockReturnValue(b);
    await expect(repo.list('u1')).resolves.toEqual([{ id: 'k1' }]);
    expect(b.eq).toHaveBeenCalledWith('user_id', 'u1');

    client.from.mockReturnValue(ok({ id: 'k1' }));
    await expect(repo.get('u1', 'k1')).resolves.toEqual({ id: 'k1' });
    client.from.mockReturnValue(ok(null));
    await expect(repo.get('u1', 'k1')).resolves.toBeNull();
    client.from.mockReturnValue(ok(null));
    await expect(repo.list('u1')).resolves.toEqual([]);
    client.from.mockReturnValue(ok(null, { count: 2 }));
    await expect(repo.count('u1')).resolves.toBe(2);
    client.from.mockReturnValue(ok(null, { count: null }));
    await expect(repo.count('u1')).resolves.toBe(0);
  });

  it('writes', async () => {
    client.from.mockReturnValue(ok({ id: 'k1' }));
    await expect(repo.insert({ user_id: 'u1', name: 'n' })).resolves.toEqual({ id: 'k1' });
    const upd = ok({ id: 'k1' });
    client.from.mockReturnValue(upd);
    await expect(repo.update('u1', 'k1', { name: 'x' })).resolves.toEqual({ id: 'k1' });
    expect(upd.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'x', updated_at: expect.any(String) }));
    client.from.mockReturnValue(ok(null));
    await expect(repo.update('u1', 'k1', {})).resolves.toBeNull();
    client.from.mockReturnValue(ok(null));
    await expect(repo.remove('u1', 'k1')).resolves.toBeUndefined();
    client.from.mockReturnValue(ok(null));
    await expect(repo.clearDefault('u1')).resolves.toBeUndefined();
  });

  it('checks whether an asset is still referenced', async () => {
    const b = ok([{ id: 'k2' }]);
    client.from.mockReturnValue(b);
    await expect(repo.assetInUse('u1', 'u1/brand-kits/a.png', 'k1')).resolves.toBe(true);
    expect(b.neq).toHaveBeenCalledWith('id', 'k1');
    client.from.mockReturnValue(ok(null));
    await expect(repo.assetInUse('u1', 'p')).resolves.toBe(false);
  });

  it('throws on database errors', async () => {
    const calls = [
      () => repo.list('u'), () => repo.count('u'), () => repo.get('u', 'k'), () => repo.insert({ user_id: 'u', name: 'n' }),
      () => repo.update('u', 'k', {}), () => repo.remove('u', 'k'), () => repo.clearDefault('u'), () => repo.assetInUse('u', 'p'),
    ];
    for (const c of calls) {
      client.from.mockReturnValue(err());
      await expect(c()).rejects.toThrow('boom');
    }
  });
});
