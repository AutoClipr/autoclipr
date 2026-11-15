"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ExternalLink, Eye, Info, ThumbsUp } from "lucide-react";
import type { YTVideo } from "@/lib/youtube-api";
import { formatCount } from "@/lib/youtube-api";

type Props = {
  channelName: string;
  subscribers: string;
  totalViews: string;
  topVideos: YTVideo[];
};

/**
 * There's no historical data source yet, so the trend and daily table are
 * modelled from the channel's lifetime totals. They're deterministic (no
 * Math.random — stable across reloads and server/client renders) and are
 * labelled as estimates on the page.
 */
function wave(i: number) {
  return 0.85 + 0.15 * Math.sin(i * 1.3) + 0.08 * Math.cos(i * 0.7);
}

function estimatedMonthlyTrend(baseViews: string, months = 12) {
  const base = parseInt(baseViews, 10) || 1_000_000_000;
  // Assume roughly a tenth of lifetime views landed in the last year.
  const perMonth = base / 120;
  return Array.from({ length: months }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - 1 - i));
    const v = Math.round(perMonth * wave(i));
    return {
      month: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      views: v,
      shorts: Math.round(v * 0.7),
    };
  });
}

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function EstimateNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-xs text-white/40">
      <Info className="mt-px h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}

export function ChannelCharts({ channelName, subscribers, totalViews, topVideos }: Props) {
  const [videoTab, setVideoTab] = useState<"top" | "latest">("top");

  const data = estimatedMonthlyTrend(totalViews);
  const yearTotal = data.reduce((s, d) => s + d.views, 0);
  const shortsTotal = data.reduce((s, d) => s + d.shorts, 0);

  const videos =
    videoTab === "top"
      ? [...topVideos].sort((a, b) => parseInt(b.views, 10) - parseInt(a.views, 10))
      : [...topVideos].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

  const baseSubs = parseInt(subscribers, 10) || 500_000_000;
  const baseViews = parseInt(totalViews, 10) || 130_000_000_000;

  return (
    <div className="space-y-6">
      {/* ── Estimated trend ── */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Estimated views · last 12 months</p>
            <div className="mt-3 flex flex-wrap gap-8">
              <div>
                <p className="text-3xl font-extrabold tracking-tight text-white">~{formatCount(yearTotal)}</p>
                <p className="text-xs text-white/45">All views</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold tracking-tight text-cyan-300">~{formatCount(shortsTotal)}</p>
                <p className="text-xs text-white/45">Shorts</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/50">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> All views</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Shorts</span>
          </div>
        </div>

        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gShorts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#0d0f17", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                itemStyle={{ color: "#6ee7b7" }}
                formatter={(v: unknown) => [`~${formatCount(v as number)}`, ""]}
              />
              <Area type="monotone" dataKey="views" stroke="#34d399" strokeWidth={2.5} fill="url(#gViews)" dot={false} />
              <Area type="monotone" dataKey="shorts" stroke="#22d3ee" strokeWidth={2} fill="url(#gShorts)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <EstimateNote>
          Modelled from the channel&apos;s lifetime view count — an estimate, not reported monthly data.
        </EstimateNote>
      </div>

      {/* ── Videos ── */}
      {topVideos.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-white">{channelName}&apos;s videos</h2>
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
              {(["top", "latest"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setVideoTab(t)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-all ${
                    videoTab === t ? "bg-white text-black shadow" : "text-white/55 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {videos.slice(0, 8).map((v, i) => (
              <a
                key={v.id}
                href={`https://www.youtube.com/watch?v=${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
              >
                <div className="relative aspect-video overflow-hidden bg-black">
                  {v.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur">
                    #{i + 1}
                  </span>
                  <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-white">{v.title}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-white/50">
                    <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {formatCount(v.views)}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {formatCount(v.likes)}</span>
                    <span className="ml-auto">
                      {new Date(v.publishedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Estimated daily growth ── */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
        <h2 className="text-xl font-bold text-white">Estimated daily growth</h2>
        <p className="mt-1 text-sm text-white/45">Subscribers, views and earnings for {channelName} over the last 10 days.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-widest text-white/40">
                <th className="pb-3 pr-6 font-semibold">Date</th>
                <th className="pb-3 pr-6 font-semibold">Subscribers</th>
                <th className="pb-3 pr-6 font-semibold">Views</th>
                <th className="pb-3 pr-6 font-semibold">Views change</th>
                <th className="pb-3 font-semibold">Est. earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {Array.from({ length: 10 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const subOffset = Math.round(i * (baseSubs * 0.001));
                const viewOffset = Math.round(i * (baseViews * 0.0008));
                const daily = Math.round(baseViews * 0.0008 * wave(i));
                const earning = (daily / 1000) * 3;
                return (
                  <tr key={i} className="transition-colors hover:bg-white/[0.03]">
                    <td className="py-3 pr-6 text-white/60">
                      {date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 pr-6 font-medium text-white">~{formatCount(baseSubs - subOffset)}</td>
                    <td className="py-3 pr-6 font-medium text-white">~{formatCount(baseViews - viewOffset)}</td>
                    <td className="py-3 pr-6">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                        +{formatCount(daily)}
                      </span>
                    </td>
                    <td className="py-3 text-amber-200/80">~{formatMoney(earning)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <EstimateNote>
          Estimated from current totals and a ~$3 CPM — not daily figures reported by YouTube.
        </EstimateNote>
      </div>
    </div>
  );
}
