import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';

function makeRepo(overrides: Partial<Record<keyof AdminRepository, jest.Mock>> = {}) {
  return {
    getAuditLogs: jest.fn().mockResolvedValue({ entries: [], total: 0 }),
    getAnalytics: jest.fn().mockResolvedValue({ days: 30 }),
    getTopCreators: jest.fn().mockResolvedValue([]),
    getClipsByUser: jest.fn().mockResolvedValue([]),
    getRecentErrors: jest.fn().mockResolvedValue({ entries: [], summary: {} }),
    getUserCounts: jest.fn().mockResolvedValue({ total: 0, paid: 0, today: 0 }),
    getUserGrowthByMonth: jest.fn().mockResolvedValue([]),
    getRecentUsers: jest.fn().mockResolvedValue([]),
    getRevenueSummary: jest.fn().mockResolvedValue({ totalPaise: 0, monthlyPaise: 0, byMonth: {}, byPlan: {}, transactionCount: 0 }),
    getRecentTransactions: jest.fn().mockResolvedValue([]),
    getSubscriptionStats: jest.fn().mockResolvedValue({ active: 0, cancelled: 0, byPlan: {} }),
    getVideoStats: jest.fn().mockResolvedValue({ total: 0, today: 0, totalBytes: 0, avgDurationSecs: 0 }),
    getVideoDeletionStats: jest.fn().mockResolvedValue({ total: 0, today: 0, byRetention: 0, byUser: 0 }),
    getRetentionNoticeStats: jest.fn().mockResolvedValue({ total: 0, today: 0, videosCovered: 0 }),
    getClipStats: jest.fn().mockResolvedValue({ total: 0, today: 0 }),
    getAffiliateStats: jest.fn().mockResolvedValue({ total: 0, active: 0, totalReferrals: 0, totalRevenuePaise: 0, top: [] }),
    getCreditUsageStats: jest.fn().mockResolvedValue({ totalCreditsUsed: 0, totalTransactions: 0 }),
    getOnlineUsers: jest.fn().mockResolvedValue(0),
    createdSince: jest.fn().mockResolvedValue([]),
    creditDebitsSince: jest.fn().mockResolvedValue([]),
    paymentsSince: jest.fn().mockResolvedValue([]),
    paidSubscriptions: jest.fn().mockResolvedValue([]),
    transactionStatusCounts: jest.fn().mockResolvedValue({}),
    jobHealth: jest.fn().mockResolvedValue({ queued: 0, processing: 0, completed24h: 0, failed24h: 0, avgProcessingSecs: null }),
    activationCounts: jest.fn().mockResolvedValue({ withVideo: 0, withClip: 0 }),
    aiUsage: jest.fn().mockResolvedValue({ hooks: 0, enhancementJobs: {} }),
    ...overrides,
  } as unknown as AdminRepository;
}

describe('AdminService', () => {
  describe('thin delegating methods', () => {
    it('getAuditLogs forwards limit/days and returns repo result', async () => {
      const repo = makeRepo({ getAuditLogs: jest.fn().mockResolvedValue({ entries: [{ id: '1' }], total: 1 }) });
      const service = new AdminService(repo);
      await expect(service.getAuditLogs(20, 5)).resolves.toEqual({ entries: [{ id: '1' }], total: 1 });
      expect(repo.getAuditLogs).toHaveBeenCalledWith(20, 5);
    });

    it('getAuditLogs applies defaults', async () => {
      const repo = makeRepo();
      const service = new AdminService(repo);
      await service.getAuditLogs();
      expect(repo.getAuditLogs).toHaveBeenCalledWith(100, 30);
    });

    it('getAnalytics forwards days with default', async () => {
      const repo = makeRepo();
      const service = new AdminService(repo);
      await service.getAnalytics();
      expect(repo.getAnalytics).toHaveBeenCalledWith(30);
      await service.getAnalytics(7);
      expect(repo.getAnalytics).toHaveBeenCalledWith(7);
    });

    it('getTopCreators forwards limit with default', async () => {
      const repo = makeRepo();
      const service = new AdminService(repo);
      await service.getTopCreators();
      expect(repo.getTopCreators).toHaveBeenCalledWith(50);
      await service.getTopCreators(5);
      expect(repo.getTopCreators).toHaveBeenCalledWith(5);
    });

    it('getClipsByUser forwards limit with default', async () => {
      const repo = makeRepo();
      const service = new AdminService(repo);
      await service.getClipsByUser();
      expect(repo.getClipsByUser).toHaveBeenCalledWith(50);
      await service.getClipsByUser(9);
      expect(repo.getClipsByUser).toHaveBeenCalledWith(9);
    });

    it('getErrors forwards limit with default and calls getRecentErrors', async () => {
      const repo = makeRepo();
      const service = new AdminService(repo);
      await service.getErrors();
      expect(repo.getRecentErrors).toHaveBeenCalledWith(50);
      await service.getErrors(3);
      expect(repo.getRecentErrors).toHaveBeenCalledWith(3);
    });
  });

  describe('getExecutiveDashboard', () => {
    it('composes the full dashboard payload from every repo call', async () => {
      const repo = makeRepo({
        getUserCounts: jest.fn().mockResolvedValue({ total: 100, paid: 25, today: 4 }),
        getUserGrowthByMonth: jest.fn().mockResolvedValue([{ month: 'Jan 26', total: 10, paid: 2 }]),
        getRecentUsers: jest.fn().mockResolvedValue([{ id: 'u1' }]),
        getRevenueSummary: jest.fn().mockResolvedValue({
          totalPaise: 500000,
          monthlyPaise: 199900,
          byMonth: { 'Jan 26': 199900 },
          byPlan: { creator: 199900 },
          transactionCount: 5,
        }),
        getRecentTransactions: jest.fn().mockResolvedValue([{ id: 'tx1' }]),
        getSubscriptionStats: jest.fn().mockResolvedValue({ active: 20, cancelled: 2, byPlan: { creator: 20 } }),
        getVideoStats: jest.fn().mockResolvedValue({ total: 50, today: 3, totalBytes: 2_000_000_000, avgDurationSecs: 90 }),
        getVideoDeletionStats: jest.fn().mockResolvedValue({ total: 12, today: 2, byRetention: 9, byUser: 3 }),
        getRetentionNoticeStats: jest.fn().mockResolvedValue({ total: 12, today: 2, videosCovered: 24 }),
        getClipStats: jest.fn().mockResolvedValue({ total: 200, today: 10 }),
        getAffiliateStats: jest.fn().mockResolvedValue({ total: 3, active: 2, totalReferrals: 9, totalRevenuePaise: 1000, top: [] }),
        getCreditUsageStats: jest.fn().mockResolvedValue({ totalCreditsUsed: 500, totalTransactions: 12 }),
        getOnlineUsers: jest.fn().mockResolvedValue(6),
        paidSubscriptions: jest.fn().mockResolvedValue([
          // Monthly ₹599 and yearly ₹6,252 (→ ₹521/mo): both active.
          { userId: 'a', plan: 'creator', status: 'active', periodEnd: null, cancelledAt: null, lastCharge: { paise: 59900, period: 'monthly' } },
          { userId: 'b', plan: 'pro', status: 'active', periodEnd: null, cancelledAt: null, lastCharge: { paise: 625200, period: 'yearly' } },
          // Cancelled 5 days ago: churned, not in MRR.
          { userId: 'c', plan: 'creator', status: 'cancelled', periodEnd: null, cancelledAt: new Date(Date.now() - 5 * 86400000).toISOString(), lastCharge: { paise: 59900, period: 'monthly' } },
        ]),
        transactionStatusCounts: jest.fn().mockResolvedValue({ paid: 9, refunded: 1, failed: 2 }),
        jobHealth: jest.fn().mockResolvedValue({ queued: 4, processing: 1, completed24h: 30, failed24h: 2, avgProcessingSecs: 95 }),
        activationCounts: jest.fn().mockResolvedValue({ withVideo: 60, withClip: 40 }),
        aiUsage: jest.fn().mockResolvedValue({ hooks: 12, enhancementJobs: { auto_zoom: 3 } }),
        createdSince: jest.fn().mockImplementation(async (table: string) => (table === 'profiles' ? [new Date().toISOString()] : [])),
      });
      const service = new AdminService(repo);

      const dashboard = await service.getExecutiveDashboard();

      expect(dashboard.users).toEqual({
        total: 100,
        paid: 25,
        free: 75,
        conversionRate: '25.00',
        newToday: 4,
        online: 6,
        growth: [{ month: 'Jan 26', total: 10, paid: 2 }],
        recent: [{ id: 'u1' }],
      });

      // MRR from active subscriptions: 599 + 6252/12 = 1120.
      expect(dashboard.revenue.mrrRupees).toBe(1120);
      expect(dashboard.revenue.arrRupees).toBe(1120 * 12);
      expect(dashboard.revenue.totalRupees).toBe(5000); // 500000 / 100
      expect(dashboard.revenue.arpuRupees).toBe(560); // MRR / 2 active paid subs
      expect(dashboard.revenue.byMonth).toEqual([{ month: 'Jan 26', revenue: 1999 }]);
      expect(dashboard.revenue.byPlan).toEqual({ creator: 199900 });
      expect(dashboard.revenue.recent).toEqual([{ id: 'tx1' }]);

      expect(dashboard.subscriptions.active).toBe(2);
      expect(dashboard.subscriptions.cancelled).toBe(1);
      expect(dashboard.subscriptions.byPlan).toEqual({ creator: 1, pro: 1 });
      expect(dashboard.subscriptions.churnRate).toBe(33.3); // 1 / (2 + 1)
      expect(dashboard.subscriptions.refundRate).toBe(10); // 1 / (9 + 1)
      expect(dashboard.subscriptions.failedPayments).toBe(2);
      expect(dashboard.subscriptions.renewalRate).toBeNull();

      expect(dashboard.videos.storageFormatted).toBe('2.0 GB');
      expect(dashboard.clips.avgPerVideo).toBe(4); // 200/50

      expect(dashboard.ai).toMatchObject({ hooksGenerated: 12, captionsGenerated: 200, scriptsGenerated: null, enhancementJobs: { auto_zoom: 3 }, creditsConsumed: 500 });
      expect(dashboard.affiliates).toEqual({ total: 3, active: 2, totalReferrals: 9, totalRevenuePaise: 1000, top: [] });
      // Nothing estimated: countries aren't tracked, funnel is real.
      expect(dashboard.countries).toEqual([]);
      expect(dashboard.countriesTracked).toBe(false);
      expect(dashboard.funnel.map((f) => f.value)).toEqual([100, 60, 40, 25]);
      expect(dashboard.system).toMatchObject({ queueSize: 4, processingJobs: 1, failedJobs: 2, avgProcessingSecs: 95 });
      expect(dashboard.videos.storagePct).toBeNull();
      expect(dashboard.trends.newUsers.current).toBe(1);
      expect(dashboard.period).toMatchObject({ days: 30, timezone: 'UTC' });
      expect(dashboard.definitions.mrr).toMatch(/yearly ÷ 12/);
    });

    it('avoids divide-by-zero: 0 users -> 0.00 conversion, 0 paid users -> 0 arpu, 0 videos -> 0 avgPerVideo', async () => {
      const repo = makeRepo({
        getUserCounts: jest.fn().mockResolvedValue({ total: 0, paid: 0, today: 0 }),
        getVideoStats: jest.fn().mockResolvedValue({ total: 0, today: 0, totalBytes: 0, avgDurationSecs: 0 }),
        getVideoDeletionStats: jest.fn().mockResolvedValue({ total: 0, today: 0, byRetention: 0, byUser: 0 }),
        getRetentionNoticeStats: jest.fn().mockResolvedValue({ total: 0, today: 0, videosCovered: 0 }),
        getClipStats: jest.fn().mockResolvedValue({ total: 0, today: 0 }),
      });
      const service = new AdminService(repo);

      const dashboard = await service.getExecutiveDashboard();
      expect(dashboard.users.conversionRate).toBe('0.00');
      expect(dashboard.revenue.arpuRupees).toBe(0);
      expect(dashboard.clips.avgPerVideo).toBe(0);
      expect(dashboard.videos.storageFormatted).toBe('0 B');
    });

    it('accepts 7/90-day ranges and falls back to 30', async () => {
      const service = new AdminService(makeRepo());
      expect((await service.getExecutiveDashboard(7)).trends.clips.series).toHaveLength(7);
      expect((await service.getExecutiveDashboard(90)).period.days).toBe(90);
      expect((await service.getExecutiveDashboard(13)).period.days).toBe(30);
    });

    it('formats storage sizes across every magnitude', async () => {
      const cases: [number, string][] = [
        [500, '500 B'],
        [5_000_000, '5.0 MB'],
        [5_000_000_000, '5.0 GB'],
        [5_000_000_000_000, '5.0 TB'],
      ];

      for (const [bytes, expected] of cases) {
        const repo = makeRepo({
          getVideoStats: jest.fn().mockResolvedValue({ total: 1, today: 0, totalBytes: bytes, avgDurationSecs: 0 }),
          getVideoDeletionStats: jest.fn().mockResolvedValue({ total: 0, today: 0, byRetention: 0, byUser: 0 }),
          getRetentionNoticeStats: jest.fn().mockResolvedValue({ total: 0, today: 0, videosCovered: 0 }),
        });
        const service = new AdminService(repo);
        const dashboard = await service.getExecutiveDashboard();
        expect(dashboard.videos.storageFormatted).toBe(expected);
      }
    });
  });
});
