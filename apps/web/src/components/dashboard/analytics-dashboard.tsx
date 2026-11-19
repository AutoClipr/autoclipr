"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  Heart,
  Instagram,
  Loader2,
  MessageCircle,
  Percent,
  RefreshCw,
  Search,
  Send,
  Share2,
  Youtube,
} from "lucide-react";
import { apiFetch, type AnalyticsOverview } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { cn } from "@/lib/utils";

type Publication = AnalyticsOverview["publications"][number];

type RangeKey = "7d" | "30d" | "90d" | "month" | "prev_month" | "all";
const RANGES: { id: RangeKey; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "month", label: "This month" },
  { id: "prev_month", label: "Previous month" },
  { id: "all", label: "All time" },
];

type ChartMetric = "posts" | "views" | "likes";
type SortKey = "views" | "likes" | "comments" | "engagement" | "recent";
const PAGE_SIZE = 10;

function rangeBounds(key: RangeKey): { start: Date | null; end: Date } {
  const now = new Date();
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (key) {
    case "7d":
      return { start: day(new Date(now.getTime() - 6 * 864e5)), end: now };
    case "30d":
      return { start: day(new Date(now.getTime() - 29 * 864e5)), end: now };
    case "90d":
      return { start: day(new Date(now.getTime() - 89 * 864e5)), end: now };
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    case "prev_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      };
    default:
      return { start: null, end: now };
  }
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Engagement = (likes + comments) ÷ views, only over posts whose platform reports metrics and have views. */
function engagement(posts: Publication[]): number | null {
  const tracked = posts.filter((p) => p.metrics_supported && p.view_count > 0);
  const views = tracked.reduce((s, p) => s + p.view_count, 0);
  if (!views) return null;
  const inter = tracked.reduce((s, p) => s + p.like_count + p.comment_count, 0);
  return (inter / views) * 100;
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "youtube") return <Youtube className={cn("text-[#FF4d4d]", className)} />;
  if (platform === "instagram") return <Instagram className={cn("text-pink-400", className)} />;
  return <Share2 className={cn("text-[#94A3B8]", className)} />;
}

export function AnalyticsDashboard({ initialData, loadFailed = false }: { initialData: AnalyticsOverview; loadFailed?: boolean }) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    loadFailed ? { tone: "error", text: "We couldn't load your analytics. Use Refresh stats to try again." } : null,
  );
  const [range, setRange] = useState<RangeKey>("30d");
  const [platform, setPlatform] = useState("all");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("posts");
  const [topSort, setTopSort] = useState<SortKey>("views");
  const [query, setQuery] = useState("");
  const [tableSort, setTableSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);

  async function refreshStats() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setNotice(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await apiFetch<AnalyticsOverview>("/api/v1/analytics/refresh", { method: "POST", token });
      if (res.success && res.data) {
        setData(res.data);
        setNotice({ tone: "ok", text: "Stats refreshed from YouTube and Instagram." });
      } else {
        setNotice({
          tone: "error",
          text: /throttl|too many/i.test(res.error?.message ?? "")
            ? "Stats were refreshed recently. Try again in a few minutes."
            : "We couldn't refresh stats right now. Showing the last saved numbers.",
        });
      }
    } finally {
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }

  const { connected_platforms, publications } = data;

  const lastUpdated = useMemo(() => {
    const ts = publications.map((p) => p.metrics_updated_at).filter(Boolean) as string[];
    return ts.length ? new Date(ts.sort().at(-1)!) : null;
  }, [publications]);

  const platformsInData = useMemo(
    () => Array.from(new Set(publications.map((p) => p.platform))),
    [publications],
  );

  // Posts published in the selected range and platform.
  const posts = useMemo(() => {
    const { start, end } = rangeBounds(range);
    return publications.filter((p) => {
      if (platform !== "all" && p.platform !== platform) return false;
      if (!p.posted_at) return range === "all";
      const t = new Date(p.posted_at).getTime();
      return (!start || t >= start.getTime()) && t <= end.getTime();
    });
  }, [publications, range, platform]);

  const tracked = posts.filter((p) => p.metrics_supported);
  const totals = {
    posts: posts.length,
    views: tracked.reduce((s, p) => s + p.view_count, 0),
    likes: tracked.reduce((s, p) => s + p.like_count, 0),
    comments: tracked.reduce((s, p) => s + p.comment_count, 0),
  };
  const eng = engagement(posts);
  const untrackedCount = posts.length - tracked.length;

  // One bar per day in range; values come only from posts published that day.
  const chartData = useMemo(() => {
    const { start, end } = rangeBounds(range);
    const first =
      start ??
      (posts.length
        ? new Date(Math.min(...posts.filter((p) => p.posted_at).map((p) => new Date(p.posted_at!).getTime())))
        : null);
    if (!first) return [];
    const days: { key: string; label: string; posts: number; views: number; likes: number }[] = [];
    const cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    let guard = 0;
    while (cursor <= end && guard++ < 400) {
      days.push({
        key: cursor.toDateString(),
        label: cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        posts: 0,
        views: 0,
        likes: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const p of posts) {
      if (!p.posted_at) continue;
      const d = days.find((x) => x.key === new Date(p.posted_at!).toDateString());
      if (!d) continue;
      d.posts += 1;
      if (p.metrics_supported) {
        d.views += p.view_count;
        d.likes += p.like_count;
      }
    }
    return days;
  }, [posts, range]);

  const scoreOf = (p: Publication, k: SortKey) =>
    k === "views"
      ? p.view_count
      : k === "likes"
        ? p.like_count
        : k === "comments"
          ? p.comment_count
          : k === "engagement"
            ? p.view_count > 0
              ? (p.like_count + p.comment_count) / p.view_count
              : -1
            : new Date(p.posted_at ?? 0).getTime();

  const topPosts = useMemo(
    () => [...tracked].sort((a, b) => scoreOf(b, topSort) - scoreOf(a, topSort)).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, topSort],
  );

  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts
      .filter((p) => !q || p.clip_title.toLowerCase().includes(q))
      .sort((a, b) => scoreOf(b, tableSort) - scoreOf(a, tableSort));
  }, [posts, query, tableSort]);
  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = tableRows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function exportCsv() {
    const header = ["Clip", "Platform", "Published", "Views", "Likes", "Comments", "Metrics updated", "Post URL"];
    const rows = tableRows.map((p) => [
      p.clip_title,
      p.platform_label,
      p.posted_at ?? "",
      p.metrics_supported ? p.view_count : "",
      p.metrics_supported ? p.like_count : "",
      p.metrics_supported ? p.comment_count : "",
      p.metrics_updated_at ?? "",
      p.platform_post_url ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `autoclipr-analytics-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectCls =
    "h-9 rounded-lg border border-[#253244] bg-[#101824] px-3 text-sm text-[#F8FAFC] outline-none focus:border-[#54D045]/60 [color-scheme:dark]";
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">ANALYTICS</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[#F8FAFC]">Your content performance.</h1>
          <p className="mt-1 max-w-xl text-sm text-[#94A3B8]">
            Understand how your videos perform across social platforms and discover what drives engagement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={range} onChange={(e) => { setRange(e.target.value as RangeKey); setPage(1); }} aria-label="Date range" className={selectCls}>
            {RANGES.map((r) => (
              <option key={r.id} value={r.id} className="bg-[#101824]">{r.label}</option>
            ))}
          </select>
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} aria-label="Platform" className={selectCls}>
            <option value="all" className="bg-[#101824]">All platforms</option>
            {platformsInData.map((p) => (
              <option key={p} value={p} className="bg-[#101824]">
                {publications.find((x) => x.platform === p)?.platform_label ?? p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={refreshStats}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#54D045] px-3 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53] disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {refreshing ? "Refreshing…" : "Refresh stats"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
        <span>
          {lastUpdated ? `Stats last synced ${lastUpdated.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Stats not synced yet"} · Showing posts published in {rangeLabel.toLowerCase()}.
        </span>
      </div>

      {notice && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm",
            notice.tone === "ok" ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]" : "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-amber-100",
          )}
        >
          {notice.tone === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {notice.text}
        </p>
      )}

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<Send className="h-4 w-4 text-[#54D045]" />} accent="#54D045" label="Published posts" value={fmt(totals.posts)} hint={`${rangeLabel}`} />
        <Metric
          icon={<Eye className="h-4 w-4 text-[#35D6E8]" />}
          accent="#35D6E8"
          label="Views"
          value={tracked.length ? fmt(totals.views) : "—"}
          hint={tracked.length ? "Lifetime views of these posts" : "No tracked posts in range"}
        />
        <Metric
          icon={<Heart className="h-4 w-4 text-pink-400" />}
          accent="#f472b6"
          label="Likes"
          value={tracked.length ? fmt(totals.likes) : "—"}
          hint={tracked.length ? `${fmt(totals.comments)} comments` : "No tracked posts in range"}
        />
        <Metric
          icon={<Percent className="h-4 w-4 text-[#F59E0B]" />}
          accent="#F59E0B"
          label="Engagement rate"
          value={eng != null ? `${eng.toFixed(1)}%` : "—"}
          hint="(likes + comments) ÷ views"
        />
      </div>
      {untrackedCount > 0 && (
        <p className="text-xs text-[#94A3B8]">
          {untrackedCount} post{untrackedCount === 1 ? "" : "s"} in this range {untrackedCount === 1 ? "is" : "are"} on a platform without view stats and {untrackedCount === 1 ? "isn't" : "aren't"} counted in views, likes or engagement.
        </p>
      )}

      {/* Chart */}
      <section className="rounded-2xl border border-[#253244] bg-[#101824] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">Performance by publish date</h2>
            <p className="mt-0.5 text-sm text-[#94A3B8]">
              {chartMetric === "posts"
                ? "How many posts went live each day."
                : `Current lifetime ${chartMetric} of the posts published each day — not a daily ${chartMetric} history.`}
            </p>
          </div>
          <div className="flex rounded-lg border border-[#253244] bg-[#0A111B] p-0.5" role="tablist" aria-label="Chart metric">
            {(["posts", "views", "likes"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={chartMetric === m}
                onClick={() => setChartMetric(m)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs capitalize",
                  chartMetric === m ? "bg-[#19251F] font-semibold text-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(84,208,69,0.4)]" : "text-[#94A3B8] hover:text-[#F8FAFC]",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {posts.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center text-center">
            <p className="text-sm text-[#F8FAFC]">No posts published in {rangeLabel.toLowerCase()}.</p>
            <Link href="/clips" className="mt-2 text-xs font-medium text-[#8fe383] hover:underline">
              Post a clip →
            </Link>
          </div>
        ) : (
          <div className="mt-5 h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#253244" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(84,208,69,0.06)" }}
                  contentStyle={{ background: "#101824", border: "1px solid #253244", borderRadius: 10, color: "#F8FAFC", fontSize: 12 }}
                  labelStyle={{ color: "#94A3B8" }}
                  formatter={(v) => [Number(v).toLocaleString(), chartMetric === "posts" ? "Posts" : `Lifetime ${chartMetric}`]}
                />
                <Bar dataKey={chartMetric} fill={chartMetric === "posts" ? "#54D045" : chartMetric === "views" ? "#35D6E8" : "#f472b6"} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Platform performance */}
        <section className="rounded-2xl border border-[#253244] bg-[#101824] p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#F8FAFC]">Platform performance</h2>
          <p className="mt-0.5 text-sm text-[#94A3B8]">Publishing connection and stats availability, per platform.</p>
          {connected_platforms.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#94A3B8]">No posting platforms connected.</p>
              <Link href="/setup/platforms?from=dashboard" className="mt-2 inline-block text-xs font-medium text-[#8fe383] hover:underline">
                Connect platforms →
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {connected_platforms.map((p) => {
                const own = posts.filter((x) => x.platform === p.platform);
                const pe = engagement(own);
                return (
                  <li key={p.platform} className="rounded-xl border border-[#253244] bg-[#0B1220] p-3">
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={p.platform} className="h-5 w-5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#F8FAFC]">{p.platform_label}</p>
                        <p className="truncate text-xs text-[#94A3B8]">{p.account_name ?? "Connected"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", p.can_post ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]" : "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-amber-200")}>
                          {p.can_post ? "Publishing ready" : "Setup needed"}
                        </span>
                        <span className="text-[10px] text-[#64748B]">{p.metrics_supported ? "Stats tracked" : "Stats not available"}</span>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <MiniStat label="Posts" value={String(own.length)} />
                      <MiniStat label="Views" value={p.metrics_supported ? fmt(own.reduce((s, x) => s + x.view_count, 0)) : "—"} />
                      <MiniStat label="Likes" value={p.metrics_supported ? fmt(own.reduce((s, x) => s + x.like_count, 0)) : "—"} />
                      <MiniStat label="Eng." value={p.metrics_supported && pe != null ? `${pe.toFixed(1)}%` : "—"} />
                    </dl>
                    {!p.metrics_supported && (
                      <p className="mt-2 text-[11px] text-[#64748B]">View analytics aren&apos;t currently available for this platform connection.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Top posts */}
        <section className="rounded-2xl border border-[#253244] bg-[#101824] p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#F8FAFC]">Top performing posts</h2>
              <p className="mt-0.5 text-sm text-[#94A3B8]">Each platform post is ranked on its own.</p>
            </div>
            <select value={topSort} onChange={(e) => setTopSort(e.target.value as SortKey)} aria-label="Rank by" className={cn(selectCls, "h-8 text-xs")}>
              <option value="views">Most views</option>
              <option value="likes">Most likes</option>
              <option value="comments">Most comments</option>
              <option value="engagement">Highest engagement</option>
            </select>
          </div>
          {topPosts.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#94A3B8]">No posts with stats in this range yet.</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {topPosts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-[#253244] bg-[#0B1220] p-2.5">
                  <span className="w-4 text-center text-xs font-semibold text-[#64748B]">{i + 1}</span>
                  <Thumb src={p.thumbnail_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#F8FAFC]">{p.clip_title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[#94A3B8]">
                      <span className="inline-flex items-center gap-1"><PlatformIcon platform={p.platform} className="h-3 w-3" />{p.platform_label}</span>
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(p.view_count)}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(p.like_count)}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{fmt(p.comment_count)}</span>
                    </p>
                  </div>
                  {p.platform_post_url && (
                    <a href={p.platform_post_url} target="_blank" rel="noopener noreferrer" aria-label="Open post" className="rounded-lg p-2 text-[#94A3B8] hover:bg-white/[0.05] hover:text-white">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Published history */}
      <section className="rounded-2xl border border-[#253244] bg-[#101824]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#253244] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">Published videos</h2>
            <p className="mt-0.5 text-sm text-[#94A3B8]">{tableRows.length} post{tableRows.length === 1 ? "" : "s"} in {rangeLabel.toLowerCase()}</p>
          </div>
          {posts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Search clips"
                  aria-label="Search clips"
                  className="h-9 w-44 rounded-lg border border-[#253244] bg-[#0A111B] pl-8 pr-3 text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B] focus:border-[#54D045]/60"
                />
              </label>
              <select value={tableSort} onChange={(e) => setTableSort(e.target.value as SortKey)} aria-label="Sort" className={selectCls}>
                <option value="recent">Newest</option>
                <option value="views">Most views</option>
                <option value="likes">Most likes</option>
                <option value="comments">Most comments</option>
              </select>
              <button type="button" onClick={exportCsv} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#253244] px-3 text-sm text-[#F8FAFC] hover:bg-white/[0.04]">
                <Download className="h-4 w-4" /> CSV
              </button>
            </div>
          )}
        </div>
        {posts.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-[#F8FAFC]">No published posts in this range</p>
            <p className="mt-1 text-sm text-[#94A3B8]">Post a clip with the Post button, or pick a longer date range.</p>
            <Link href="/clips" className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]">
              Go to My Clips
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs text-[#64748B]">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Clip</th>
                    <th className="px-3 py-2.5 font-medium">Platform</th>
                    <th className="px-3 py-2.5 text-right font-medium">Views</th>
                    <th className="px-3 py-2.5 text-right font-medium">Likes</th>
                    <th className="px-3 py-2.5 text-right font-medium">Comments</th>
                    <th className="px-3 py-2.5 font-medium">Published</th>
                    <th className="px-5 py-2.5 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#253244]/60">
                  {pageRows.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <Thumb src={p.thumbnail_url} />
                          <span className="max-w-[220px] truncate font-medium text-[#F8FAFC]">{p.clip_title}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[#cbd5e1]">
                          <PlatformIcon platform={p.platform} className="h-3.5 w-3.5" />
                          {p.platform_label}
                        </span>
                      </td>
                      {(["view_count", "like_count", "comment_count"] as const).map((k) => (
                        <td key={k} className="px-3 py-2.5 text-right tabular-nums text-[#F8FAFC]">
                          {p.metrics_supported ? fmt(p[k]) : <span className="text-[#64748B]" title="Stats not available for this platform">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-[#94A3B8]">
                        {p.posted_at ? new Date(p.posted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        {p.platform_post_url ? (
                          <a href={p.platform_post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#8fe383] hover:underline">
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-[#64748B]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#253244] px-5 py-3 text-xs text-[#94A3B8]">
                <span>Page {current} of {totalPages}</span>
                <div className="flex gap-1.5">
                  <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#253244] disabled:opacity-35">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Next page" disabled={current === totalPages} onClick={() => setPage(current + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#253244] disabled:opacity-35">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <p className="text-xs text-[#64748B]">
        Views, likes and comments are lifetime totals fetched from YouTube and Instagram when you refresh. Facebook doesn&apos;t report stats yet.
      </p>
    </div>
  );
}

function Metric({ icon, accent, label, value, hint }: { icon: React.ReactNode; accent: string; label: string; value: string; hint: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#253244] bg-[#101824] p-4 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${accent}aa, transparent)` }} aria-hidden />
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#253244] bg-[#0A111B]">{icon}</span>
      <p className="mt-3 text-2xl font-bold tabular-nums text-[#F8FAFC]">{value}</p>
      <p className="text-sm font-medium text-[#cbd5e1]">{label}</p>
      <p className="mt-0.5 truncate text-xs text-[#64748B]">{hint}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#0A111B] px-2 py-1.5">
      <dd className="text-sm font-semibold tabular-nums text-[#F8FAFC]">{value}</dd>
      <dt className="text-[10px] text-[#64748B]">{label}</dt>
    </div>
  );
}

function Thumb({ src }: { src?: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className="h-11 w-7 shrink-0 rounded object-cover" />
  ) : (
    <span className="flex h-11 w-7 shrink-0 items-center justify-center rounded bg-[#0A111B]">
      <Share2 className="h-3.5 w-3.5 text-[#475569]" />
    </span>
  );
}
