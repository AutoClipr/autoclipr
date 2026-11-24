import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { AdminRepository } from './admin.repository';
import { DEFINITIONS, churnRate, isActive, mrrPaise, trend, windows } from './admin-metrics';

function fmtBytes(bytes: number) {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9)  return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6)  return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${bytes} B`;
}

@Injectable()
export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  async getAuditLogs(limit = 100, days = 30) {
    return this.repo.getAuditLogs(limit, days);
  }

  async getAnalytics(days = 30) {
    return this.repo.getAnalytics(days);
  }

  async getTopCreators(limit = 50) {
    return this.repo.getTopCreators(limit);
  }

  async getClipsByUser(limit = 50) {
    return this.repo.getClipsByUser(limit);
  }

  async getErrors(limit = 50) {
    return this.repo.getRecentErrors(limit);
  }

  /**
   * Executive dashboard for the last `days` days (UTC), compared with the
   * `days` before. Every value comes from real rows; anything not tracked is
   * null (never an estimate). Formulas: admin-metrics.ts → DEFINITIONS.
   */
  async getExecutiveDashboard(days = 30) {
    const range = [7, 30, 90].includes(days) ? days : 30;
    const now = Date.now();
    const { prevStart } = windows(range, now);
    const since = new Date(prevStart).toISOString();
    const [
      userCounts, userGrowth, recentUsers, revenue, recentTx, videoStats, videoDeletions, retentionNotices,
      clipStats, affiliateStats, creditStats, onlineUsers,
      signups, videoRows, clipRows, debits, payments, paidSubs, txStatus, jobs, activation, ai,
    ] = await Promise.all([
      this.repo.getUserCounts(),
      this.repo.getUserGrowthByMonth(),
      this.repo.getRecentUsers(8),
      this.repo.getRevenueSummary(),
      this.repo.getRecentTransactions(10),
      this.repo.getVideoStats(),
      this.repo.getVideoDeletionStats(),
      this.repo.getRetentionNoticeStats(),
      this.repo.getClipStats(),
      this.repo.getAffiliateStats(),
      this.repo.getCreditUsageStats(),
      this.repo.getOnlineUsers(),
      this.repo.createdSince('profiles', since),
      this.repo.createdSince('videos', since),
      this.repo.createdSince('clips', since),
      this.repo.creditDebitsSince(since),
      this.repo.paymentsSince(since),
      this.repo.paidSubscriptions(),
      this.repo.transactionStatusCounts(),
      this.repo.jobHealth(),
      this.repo.activationCounts(),
      this.repo.aiUsage(since),
    ]);

    const count = (at: string[]) => at.map((a) => ({ at: a, v: 1 }));
    const trends = {
      newUsers: trend(count(signups), range, now),
      videos: trend(count(videoRows), range, now),
      clips: trend(count(clipRows), range, now),
      creditsUsed: trend(debits.map((d) => ({ at: d.at, v: d.credits })), range, now),
      revenueRupees: trend(payments.map((p) => ({ at: p.at, v: Math.round(p.paise / 100) })), range, now),
    };

    const free = userCounts.total - userCounts.paid;
    const conversionRate = userCounts.total > 0 ? ((userCounts.paid / userCounts.total) * 100).toFixed(2) : '0.00';
    const activePaid = paidSubs.filter((s) => isActive(s, now));
    const mrrRupees = Math.round(mrrPaise(paidSubs, now) / 100);
    const byPlan: Record<string, number> = {};
    for (const s of activePaid) byPlan[s.plan] = (byPlan[s.plan] ?? 0) + 1;
    const refunded = txStatus.refunded ?? 0;
    const paidTx = txStatus.paid ?? 0;
    const cpus = Math.max(1, os.cpus().length);

    return {
      period: { days: range, from: new Date(windows(range, now).curStart).toISOString(), to: new Date(now).toISOString(), timezone: 'UTC' },
      definitions: DEFINITIONS,
      trends,
      users: {
        total: userCounts.total,
        paid: userCounts.paid,
        free,
        conversionRate,
        newToday: userCounts.today,
        online: onlineUsers,
        growth: userGrowth,
        recent: recentUsers,
      },
      revenue: {
        mrrRupees,
        arrRupees: mrrRupees * 12,
        totalRupees: Math.round(revenue.totalPaise / 100),
        transactionCount: revenue.transactionCount,
        arpuRupees: activePaid.length ? Math.round(mrrRupees / activePaid.length) : 0,
        byMonth: Object.entries(revenue.byMonth).map(([month, paise]) => ({ month, revenue: Math.round((paise as number) / 100) })),
        byPlan: revenue.byPlan,
        recent: recentTx,
      },
      subscriptions: {
        // Paid plans only: free Starter rows are not subscriptions anyone pays for.
        active: activePaid.length,
        cancelled: paidSubs.filter((s) => !isActive(s, now)).length,
        byPlan,
        churnRate: churnRate(paidSubs, now),
        renewalRate: null as number | null,
        refundRate: paidTx + refunded ? Math.round((refunded / (paidTx + refunded)) * 1000) / 10 : null,
        failedPayments: txStatus.failed ?? 0,
      },
      videos: {
        total: videoStats.total,
        today: videoStats.today,
        deleted: videoDeletions.total,
        deletedToday: videoDeletions.today,
        deletedByRetention: videoDeletions.byRetention,
        deletedByUser: videoDeletions.byUser,
        noticesSent: retentionNotices.total,
        noticesSentToday: retentionNotices.today,
        noticesVideosCovered: retentionNotices.videosCovered,
        avgDurationSecs: videoStats.avgDurationSecs,
        storageBytes: videoStats.totalBytes,
        storageFormatted: fmtBytes(videoStats.totalBytes),
        // No storage quota is configured, so there is no honest percentage.
        storagePct: null as number | null,
      },
      clips: {
        total: clipStats.total,
        today: clipStats.today,
        avgPerVideo: videoStats.total > 0 ? +(clipStats.total / videoStats.total).toFixed(1) : 0,
      },
      ai: {
        hooksGenerated: ai.hooks,
        // Every rendered clip gets AI captions and an AI title.
        captionsGenerated: clipStats.total,
        titlesGenerated: clipStats.total,
        scriptsGenerated: null as number | null,
        enhancementJobs: ai.enhancementJobs,
        creditsConsumed: creditStats.totalCreditsUsed,
      },
      affiliates: affiliateStats,
      // Sign-up country isn't recorded yet; nothing is estimated.
      countries: [] as { country: string; users: number; revenueRupees: number }[],
      countriesTracked: false,
      funnel: [
        { stage: 'Signed up', value: userCounts.total },
        { stage: 'Added a video', value: activation.withVideo },
        { stage: 'Got clips', value: activation.withClip },
        { stage: 'Paid', value: userCounts.paid },
      ],
      system: {
        // API server host, measured now (worker telemetry isn't collected).
        cpuPercent: Math.min(100, Math.round((os.loadavg()[0] / cpus) * 100)),
        memoryPercent: Math.round((process.memoryUsage().rss / os.totalmem()) * 1000) / 10,
        uptimeSecs: Math.round(process.uptime()),
        queueSize: jobs.queued,
        processingJobs: jobs.processing,
        failedJobs: jobs.failed24h,
        completedJobs24h: jobs.completed24h,
        avgProcessingSecs: jobs.avgProcessingSecs,
      },
    };
  }
}
