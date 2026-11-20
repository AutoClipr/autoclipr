import { CreatorsController } from './creators.controller';

describe('CreatorsController', () => {
  const service = { leaderboard: jest.fn().mockResolvedValue({ items: [] }) };
  const ctrl = new CreatorsController(service as never);

  beforeEach(() => service.leaderboard.mockClear());

  it('passes sanitized params with defaults', async () => {
    const res = await ctrl.leaderboard();
    expect(res).toEqual({ success: true, data: { items: [] }, meta: undefined });
    expect(service.leaderboard).toHaveBeenCalledWith({ sort: 'rank', category: undefined, q: undefined, page: 1, pageSize: 20 });
  });

  it('accepts valid values and clamps page size', async () => {
    await ctrl.leaderboard('views', 'Music', 'mr', '3', '500');
    expect(service.leaderboard).toHaveBeenCalledWith({ sort: 'views', category: 'Music', q: 'mr', page: 3, pageSize: 50 });
  });

  it('ignores invalid sort, "all" category and bad numbers', async () => {
    await ctrl.leaderboard('bogus', 'All', undefined, '-2', 'abc');
    expect(service.leaderboard).toHaveBeenCalledWith({ sort: 'rank', category: undefined, q: undefined, page: 1, pageSize: 20 });
  });
});
