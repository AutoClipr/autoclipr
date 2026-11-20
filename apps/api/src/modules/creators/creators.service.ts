import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreatorChannelRow, CreatorsRepository, CreatorStatsUpdate } from './creators.repository';

export const CREATOR_SORTS = ['rank', 'subscribers', 'views', 'videos'] as const;
export type CreatorSort = (typeof CREATOR_SORTS)[number];

export interface LeaderboardQuery {
  sort: CreatorSort;
  category?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export interface LeaderboardEntry {
  channelId: string;
  handle: string | null;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  country: string | null;
  category: string;
  subscribers: number | null;
  views: number | null;
  videos: number | null;
  publishedAt: string | null;
  /** Position among all tracked channels by subscribers. Null when hidden. */
  globalRank: number | null;
  /** Position within the selected category by subscribers. Null when hidden. */
  categoryRank: number | null;
  /** Position in the current sorted, filtered list (1-based). */
  position: number;
}

export interface Leaderboard {
  items: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  trackedChannels: number;
  categories: { name: string; count: number }[];
  lastRefreshedAt: string | null;
}

export interface RefreshResult {
  ok: number;
  failed: number;
  skipped?: string;
}

const YT = 'https://www.googleapis.com/youtube/v3/channels';
const BATCH = 50; // channels.list max ids per call (1 quota unit each)
const CACHE_MS = 60_000;

type YtChannel = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    country?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string } | undefined>;
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
};

const num = (v: string | undefined): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Descending, missing values last, channel_id as a stable tie-break. */
function byMetric(key: 'subscriber_count' | 'total_views' | 'video_count') {
  return (a: CreatorChannelRow, b: CreatorChannelRow) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return a.channel_id.localeCompare(b.channel_id);
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av || a.channel_id.localeCompare(b.channel_id);
  };
}

/** Competition ranking (1, 2, 2, 4) by subscribers; hidden counts are unranked. */
function subscriberRanks(rows: CreatorChannelRow[]): Map<string, number> {
  const ranks = new Map<string, number>();
  const sorted = rows.filter((r) => r.subscriber_count != null).sort(byMetric('subscriber_count'));
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    ranks.set(r.channel_id, prev && prev.subscriber_count === r.subscriber_count ? ranks.get(prev.channel_id)! : i + 1);
  });
  return ranks;
}

@Injectable()
export class CreatorsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CreatorsService.name);
  private cache: { at: number; rows: CreatorChannelRow[]; refreshedAt: string | null } | null = null;
  private running = false;

  constructor(
    private readonly repo: CreatorsRepository,
    private readonly config: ConfigService,
  ) {}

  /** Overridable in tests. */
  fetchFn: typeof fetch = (input, init) => fetch(input, init);

  /** Fill the cache right after the first deploy instead of waiting for 4 AM. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      if (!(await this.repo.lastSuccessfulRefresh())) void this.scheduledRefresh();
    } catch (err) {
      this.logger.warn(`Top creators bootstrap check failed: ${(err as Error).message}`);
    }
  }

  private async snapshot() {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache;
    const [rows, refreshedAt] = await Promise.all([this.repo.listActive(), this.repo.lastSuccessfulRefresh()]);
    this.cache = { at: Date.now(), rows, refreshedAt };
    return this.cache;
  }

  async leaderboard(query: LeaderboardQuery): Promise<Leaderboard> {
    const { rows, refreshedAt } = await this.snapshot();

    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    const categories = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const global = subscriberRanks(rows);
    const category = query.category?.trim();
    let filtered = category ? rows.filter((r) => r.category.toLowerCase() === category.toLowerCase()) : rows;
    const inCategory = subscriberRanks(filtered);

    const q = query.q?.trim().toLowerCase().replace(/^@/, '');
    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.channel_name.toLowerCase().includes(q) ||
          (r.channel_handle ?? '').toLowerCase().replace(/^@/, '').includes(q) ||
          r.channel_id.toLowerCase() === q,
      );
    }

    const key =
      query.sort === 'views' ? 'total_views' : query.sort === 'videos' ? 'video_count' : 'subscriber_count';
    const sorted = [...filtered].sort(byMetric(key));

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(Math.max(1, query.page), totalPages);
    const start = (page - 1) * query.pageSize;

    const items = sorted.slice(start, start + query.pageSize).map<LeaderboardEntry>((r, i) => ({
      channelId: r.channel_id,
      handle: r.channel_handle,
      name: r.channel_name,
      description: r.description,
      avatarUrl: r.avatar_url,
      country: r.country,
      category: r.category,
      subscribers: r.subscriber_count,
      views: r.total_views,
      videos: r.video_count,
      publishedAt: r.published_at,
      globalRank: global.get(r.channel_id) ?? null,
      categoryRank: category ? inCategory.get(r.channel_id) ?? null : null,
      position: start + i + 1,
    }));

    return {
      items,
      total,
      page,
      pageSize: query.pageSize,
      totalPages,
      trackedChannels: rows.length,
      categories,
      lastRefreshedAt: refreshedAt,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'top-creators-refresh' })
  async scheduledRefresh(): Promise<void> {
    try {
      const r = await this.refresh();
      this.logger.log(`Top creators refresh: ${r.ok} ok, ${r.failed} failed${r.skipped ? ` (${r.skipped})` : ''}`);
    } catch (err) {
      this.logger.error(`Top creators refresh crashed: ${(err as Error).message}`);
    }
  }

  /**
   * Pull fresh stats for every tracked channel. Costs 1 quota unit per 50
   * channels, plus 1 per channel whose stored ID no longer resolves (looked up
   * again by handle). Failures leave the previous cached values in place.
   */
  async refresh(): Promise<RefreshResult> {
    const key = this.config.get<string>('youtube.apiKey');
    if (!key) return { ok: 0, failed: 0, skipped: 'YOUTUBE_API_KEY not set' };
    if (this.running) return { ok: 0, failed: 0, skipped: 'already running' };
    this.running = true;
    let runId: string;
    try {
      runId = await this.repo.startRun();
    } catch (err) {
      this.running = false;
      throw err;
    }
    let ok = 0;
    let failed = 0;
    let fatal: string | null = null;
    try {
      const rows = await this.repo.listActive();
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        let found: Map<string, YtChannel>;
        try {
          found = new Map((await this.callYouTube(`id=${batch.map((r) => r.channel_id).join(',')}`, key)).map((c) => [c.id, c]));
        } catch (err) {
          fatal = (err as Error).message;
          failed += batch.length;
          continue;
        }
        for (const row of batch) {
          try {
            let ch = found.get(row.channel_id);
            if (!ch && row.channel_handle) {
              [ch] = await this.callYouTube(`forHandle=${encodeURIComponent(row.channel_handle)}`, key);
            }
            if (!ch) {
              await this.repo.markError(row.channel_id, 'Channel not returned by YouTube');
              failed++;
              continue;
            }
            await this.repo.saveStats(row.channel_id, this.toStats(ch, row));
            ok++;
          } catch (err) {
            failed++;
            await this.repo.markError(row.channel_id, (err as Error).message).catch(() => undefined);
          }
        }
      }
    } catch (err) {
      fatal = (err as Error).message;
    } finally {
      this.running = false;
    }

    await this.repo.finishRun(runId, { succeeded: ok > 0 && !fatal, ok, failed, error: fatal });
    this.cache = null;
    return { ok, failed };
  }

  private toStats(ch: YtChannel, row: CreatorChannelRow): CreatorStatsUpdate {
    const s = ch.snippet ?? {};
    const st = ch.statistics ?? {};
    const t = s.thumbnails ?? {};
    return {
      channel_id: ch.id,
      channel_name: s.title || row.channel_name,
      channel_handle: s.customUrl ?? row.channel_handle,
      description: s.description ?? null,
      avatar_url: t.high?.url ?? t.medium?.url ?? t.default?.url ?? null,
      country: s.country ?? row.country,
      subscriber_count: st.hiddenSubscriberCount ? null : num(st.subscriberCount),
      total_views: num(st.viewCount),
      video_count: num(st.videoCount),
      published_at: s.publishedAt ?? null,
    };
  }

  /** channels.list with one retry on 429/5xx. */
  private async callYouTube(selector: string, key: string, attempt = 0): Promise<YtChannel[]> {
    const res = await this.fetchFn(`${YT}?part=snippet,statistics&maxResults=${BATCH}&${selector}&key=${key}`);
    if (res.ok) return (((await res.json()) as { items?: YtChannel[] }).items ?? []);
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 2000));
      return this.callYouTube(selector, key, 1);
    }
    throw new Error(`YouTube API ${res.status}`);
  }
}
