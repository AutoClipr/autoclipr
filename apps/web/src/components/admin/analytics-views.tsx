"use client";

/** Analytics page visuals: activity trend with series toggles, status breakdowns, ranked bars. */

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { CheckCircle2, Scissors, Share2, Sparkles, Users, Video, Zap } from "lucide-react";
import { fmtNum, KpiCard, Panel, SectionLabel } from "./ui";

export type DayPoint = { date: string; value: number };
export type NameValue = { name: string; value: number };

const SERIES = [
  { key: "signups", label: "Sign-ups", color: "#54D045" },
  { key: "videos", label: "Videos", color: "#38BDF8" },
  { key: "clips", label: "Clips", color: "#8B5CF6" },
] as const;
type SeriesKey = (typeof SERIES)[number]["key"];

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function ActivityTrend({ data }: { data: Record<SeriesKey, DayPoint[]> }) {
  const [on, setOn] = useState<Record<SeriesKey, boolean>>({ signups: true, videos: true, clips: true });
  const dates = Array.from(new Set(SERIES.flatMap((s) => data[s.key].map((p) => p.date)))).sort();
  const rows = dates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const s of SERIES) row[s.key] = data[s.key].find((p) => p.date === date)?.value ?? 0;
    return row;
  });
  const total = (k: SeriesKey) => data[k].reduce((a, p) => a + p.value, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Series">
        {SERIES.map((s) => (
          <button key={s.key} type="button" aria-pressed={on[s.key]} onClick={() => setOn((o) => ({ ...o, [s.key]: !o[s.key] }))}
            className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors",
              on[s.key] ? "border-[#35445a] bg-[#1A2739] text-[#F8FAFC]" : "border-[#263449] text-[#64748B] hover:text-[#94A3B8]")}>
            <span className="h-2 w-2 rounded-full" style={{ background: on[s.key] ? s.color : "#475569" }} />
            {s.label}
            <span className="font-semibold tabular-nums">{fmtNum(total(s.key))}</span>
          </button>
        ))}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`an-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="1" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#263449" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              labelFormatter={(d) => shortDate(String(d))}
              contentStyle={{ background: "#1A2739", border: "1px solid #263449", borderRadius: 10, fontSize: 12, color: "#F8FAFC" }}
              cursor={{ stroke: "#35445a" }}
            />
            {SERIES.filter((s) => on[s.key]).map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#an-${s.key})`} dot={false} activeDot={{ r: 3 }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Colour by meaning, not by position: green = done, red = failed, amber = in flight. */
export function statusColor(name: string) {
  const n = name.toLowerCase();
  if (/(complete|ready|published|success|done)/.test(n)) return "#54D045";
  if (/(fail|error|cancel|reject)/.test(n)) return "#F87171";
  if (/(process|upload|running|active|render|publishing)/.test(n)) return "#F59E0B";
  if (/(pending|queue|wait|scheduled|draft)/.test(n)) return "#38BDF8";
  return "#94A3B8";
}

const NAMES: Record<string, string> = { youtube: "YouTube", tiktok: "TikTok", linkedin: "LinkedIn", url_pipeline: "URL pipeline" };
export const prettyLabel = (s: string) => NAMES[s.toLowerCase()] ?? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function StatusBreakdown({ data, emptyText }: { data: NameValue[]; emptyText: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <p className="py-8 text-center text-xs text-[#64748B]">{emptyText}</p>;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[#1A2739]">
        {sorted.map((d) => (
          <div key={d.name} title={`${prettyLabel(d.name)}: ${fmtNum(d.value)}`} style={{ width: `${(d.value / total) * 100}%`, background: statusColor(d.name) }} />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {sorted.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor(d.name) }} />
            <span className="flex-1 text-[#CBD5E1]">{prettyLabel(d.name)}</span>
            <span className="font-semibold tabular-nums text-[#F8FAFC]">{fmtNum(d.value)}</span>
            <span className="w-12 text-right text-xs tabular-nums text-[#64748B]">{((d.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankedBars({ data, emptyText, color = "#54D045", colorBy }: { data: NameValue[]; emptyText: string; color?: string; colorBy?: (name: string) => string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <p className="py-8 text-center text-xs text-[#64748B]">{emptyText}</p>;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = sorted[0].value;
  return (
    <ul className="space-y-3.5">
      {sorted.map((d) => (
        <li key={d.name}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-[#CBD5E1]">{prettyLabel(d.name)}</span>
            <span className="tabular-nums">
              <span className="font-semibold text-[#F8FAFC]">{fmtNum(d.value)}</span>
              <span className="ml-2 text-xs text-[#64748B]">{((d.value / total) * 100).toFixed(1)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#1A2739]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: colorBy ? colorBy(d.name) : color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Page body ---------- */


export type AnalyticsData = {
  days: number;
  signupsByDay: DayPoint[];
  videosByDay: DayPoint[];
  clipsByDay: DayPoint[];
  clipStatus: NameValue[];
  videoStatus: NameValue[];
  jobTypes: NameValue[];
  jobStatus: NameValue[];
  publications: NameValue[];
  pubStatus: NameValue[];
  avgViralScore: number | null;
  totals: { signups: number; videos: number; clips: number; jobs: number; pubs: number };
};

const share = (items: NameValue[], re: RegExp) => {
  const total = items.reduce((a, d) => a + d.value, 0);
  if (!total) return null;
  return Math.round((items.filter((d) => re.test(d.name.toLowerCase())).reduce((a, d) => a + d.value, 0) / total) * 1000) / 10;
};

export function AnalyticsBody({ data }: { data: AnalyticsData }) {
  const t = data.totals;
  const jobSuccess = share(data.jobStatus, /(complete|success|done)/);
  const pubSuccess = share(data.pubStatus, /(published|success|complete)/);
  const clipsPerVideo = t.videos ? (t.clips / t.videos).toFixed(1) : "—";
  const series = (p: DayPoint[]) => p.map((x) => x.value);

  return (
    <div className="space-y-8">
      <section>
        <SectionLabel>Volume · last {data.days} days</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiCard icon={Users} label="New sign-ups" value={fmtNum(t.signups)} series={series(data.signupsByDay)} help="Profiles created in the period (UTC days)." />
          <KpiCard icon={Video} label="Videos" value={fmtNum(t.videos)} series={series(data.videosByDay)} accent="#38BDF8" help="Videos uploaded or imported in the period." />
          <KpiCard icon={Scissors} label="Clips" value={fmtNum(t.clips)} series={series(data.clipsByDay)} accent="#8B5CF6" sub={`${clipsPerVideo} per video`} help="Clips generated in the period." />
          <KpiCard icon={Zap} label="Jobs run" value={fmtNum(t.jobs)} accent="#F59E0B" sub={jobSuccess != null ? `${jobSuccess}% completed` : undefined} help="Processing jobs created in the period, any type and status." />
          <KpiCard icon={Share2} label="Published" value={fmtNum(t.pubs)} accent="#EC4899" sub={pubSuccess != null ? `${pubSuccess}% succeeded` : undefined} help="Publish attempts to social platforms in the period." />
          <KpiCard icon={Sparkles} label="Avg viral score" value={data.avgViralScore != null ? String(data.avgViralScore) : "—"} accent="#FACC15" sub="out of 100" help="Mean AI viral score of clips generated in the period." />
        </div>
      </section>

      <Panel title="Daily activity" subtitle={`Per UTC day, last ${data.days} days · click a series to toggle it`}>
        <ActivityTrend data={{ signups: data.signupsByDay, videos: data.videosByDay, clips: data.clipsByDay }} />
      </Panel>

      <section>
        <SectionLabel>Pipeline health</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Clip status" subtitle="Clips created in this period"><StatusBreakdown data={data.clipStatus} emptyText="No clips in this period" /></Panel>
          <Panel title="Video status" subtitle="Videos created in this period"><StatusBreakdown data={data.videoStatus} emptyText="No videos in this period" /></Panel>
          <Panel title="Processing jobs by type" subtitle="Share of all jobs run"><RankedBars data={data.jobTypes} emptyText="No jobs in this period" color="#F59E0B" /></Panel>
          <Panel title="Job status" subtitle="Outcome of jobs run" action={jobSuccess != null ? <Pill ok={jobSuccess >= 90} text={`${jobSuccess}% completed`} /> : undefined}>
            <StatusBreakdown data={data.jobStatus} emptyText="No jobs in this period" />
          </Panel>
        </div>
      </section>

      <section>
        <SectionLabel>Publishing</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Publications by platform" subtitle="Publish attempts per destination"><RankedBars data={data.publications} emptyText="No publications in this period" color="#EC4899" /></Panel>
          <Panel title="Publication status" subtitle="Outcome of publish attempts" action={pubSuccess != null ? <Pill ok={pubSuccess >= 90} text={`${pubSuccess}% succeeded`} /> : undefined}>
            <StatusBreakdown data={data.pubStatus} emptyText="No publications in this period" />
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Pill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", ok ? "bg-[#54D045]/10 text-[#8fe383]" : "bg-[#F59E0B]/10 text-[#FBBF24]")}>
      <CheckCircle2 className="h-3 w-3" />{text}
    </span>
  );
}
