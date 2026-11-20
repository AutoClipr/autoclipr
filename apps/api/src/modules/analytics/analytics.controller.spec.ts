import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

function makeService() {
  return {
    getOverview: jest.fn(),
    refreshMetrics: jest.fn(),
  } as unknown as jest.Mocked<AnalyticsService>;
}

describe('AnalyticsController', () => {
  let service: jest.Mocked<AnalyticsService>;
  let controller: AnalyticsController;

  let usersRepo: { getById: jest.Mock };

  beforeEach(() => {
    service = makeService();
    usersRepo = { getById: jest.fn().mockResolvedValue({ subscription_tier: 'pro' }) };
    controller = new AnalyticsController(service, usersRepo as never);
  });

  it.each([['starter'], ['free'], [null]])('refuses analytics on the %s tier', async (tier) => {
    usersRepo.getById.mockResolvedValue(tier ? { subscription_tier: tier } : null);
    await expect(controller.overview({ sub: 'u1' } as never)).rejects.toThrow('Analytics is available on the Creator');
    await expect(controller.refresh({ sub: 'u1' } as never)).rejects.toThrow('Analytics is available on the Creator');
    expect(service.getOverview).not.toHaveBeenCalled();
    expect(service.refreshMetrics).not.toHaveBeenCalled();
  });

  describe('overview', () => {
    it('fetches the overview without forcing a refresh and wraps it in ApiResponse.ok', async () => {
      service.getOverview.mockResolvedValue({ summary: { posted_count: 1 } } as never);

      const result = await controller.overview({ sub: 'u1' } as never);

      expect(service.getOverview).toHaveBeenCalledWith('u1', false);
      expect(result).toEqual({
        success: true,
        data: { summary: { posted_count: 1 } },
        meta: undefined,
      });
    });
  });

  describe('refresh', () => {
    it('refreshes metrics then returns the fresh overview', async () => {
      service.refreshMetrics.mockResolvedValue({ refreshed: 3 });
      service.getOverview.mockResolvedValue({ summary: { posted_count: 5 } } as never);

      const result = await controller.refresh({ sub: 'u1' } as never);

      expect(service.refreshMetrics).toHaveBeenCalledWith('u1');
      expect(service.getOverview).toHaveBeenCalledWith('u1', false);
      expect(result.data).toEqual({ summary: { posted_count: 5 } });
    });

    it('propagates errors from refreshMetrics without calling getOverview', async () => {
      service.refreshMetrics.mockRejectedValue(new Error('refresh failed'));

      await expect(controller.refresh({ sub: 'u1' } as never)).rejects.toThrow('refresh failed');
      expect(service.getOverview).not.toHaveBeenCalled();
    });
  });
});
