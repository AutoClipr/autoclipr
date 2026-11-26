"use client";

/**
 * Executive dashboard. All numbers come from GET /admin/stats (real rows
 * only; anything not tracked is shown as such). Period, auto-refresh and
 * CSV export are client-side controls over that one endpoint.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowRight, Bot, CreditCard, Database, DollarSign, Download, Flame, Gauge, Loader2,
  Receipt, RefreshCw, Scissors, Search, TrendingDown, TrendingUp, UserCheck, UserPlus, Users, Video, Wifi, Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { cn } from "@/lib/utils";
import { Delta, EmptyState, InfoTip, KpiCard, Panel, SectionLabel, Skeleton, downloadCsv, fmtDuration, fmtInr, fmtNum } from "./ui";

export type Trend = { current: number; previous: number; changePct: number | null; series: { date: string; value: number }[] };
export type Stats = {
  period: { days: number; from: string; to: string; timezone: string };
  definitions: Record<string, string>;
  trends: { newUsers: Trend; videos: Trend; clips: Trend; creditsUsed: Trend; revenueRupees: Trend };
  users: { total: number; paid: number; free: number; conversionRate: string; newToday: number; online: number; recent: { id: string; email: string; full_name: string | null; subscription_tier: string; credits: number; created_at: string }[] };
  revenue: { mrrRupees: number; arrRupees: number; totalRupees: number; transactionCount: number; arpuRupees: number; byMonth: { month: string; revenue: number }[]; byPlan: Record<string, number>; recent: { id: string; invoice_number: string; plan_id: string; amount: string; billing_period: string; payment_date: string }[] };
  subscriptions: { active: number; cancelled: number; byPlan: Record<string, number>; churnRate: number | null; refundRate: number | null; failedPayments: number };
  videos: { storageFormatted: string; total: number };
  clips: { total: number };
  ai: { hooksGenerated: number | null; captionsGenerated: number; enhancementJobs: Record<string, number>; creditsConsumed: number };
  funnel: { stage: string; value: number }[];
  system: { cpuPercent: number; memoryPercent: number; uptimeSecs: number; queueSize: number; processingJobs: number; failedJobs: number; completedJobs24h: number; avgProcessingSecs: number | null };
};

const RANGES = [7, 30, 90] as const;
const REFRESH = [
  { id: 0, label: "Off" },
  { id: 60, label: "1 min" },
  { id: 300, label: "5 min" },
];
export const PLAN_COLOR: Record<string, string> = { creator: "#8B5CF6", pro: "#54D045", business: "#F59E0B" };
const FX_LABEL: Record<string, string> = {
  motion_graphics: "Motion graphics", ai_emojis: "AI emojis", speech_cleanup: "Speech cleanup", enhance_audio: "Enhance audio",
  auto_sfx: "Auto SFX", auto_zoom: "Auto zoom", transitions: "Transitions", color_correction: "Colour correction",
  voice_dubbing: "Voice dubbing", caption_translation: "Caption translation",
};
const TREND_TABS = [
  { id: "newUsers", label: "Sign-ups", money: false },
  { id: "revenueRupees", label: "Revenue", money: true },
  { id: "videos", label: "Videos", money: false },
  { id: "clips", label: "Clips", money: false },
  { id: "creditsUsed", label: "Credits used", money: false },
] as const;

export function ExecutiveDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const days = RANGES.includes(Number(params.get("days")) as 7) ? Number(params.get("days")) : 30;
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshSecs, setRefreshSecs] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const res = await apiFetch<Stats>(`/api/v1/admin/stats?days=${days}`, { token, skipGlobalLoader: true });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? "Couldn't load admin stats.");
      setData(res.data);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load admin stats.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!refreshSecs) return;
    const t = setInterval(() => document.visibilityState === "visible" && void load(), refreshSecs * 1000);
    return () => clearInterval(t);
  }, [refreshSecs, load]);

  const setDays = (d: number) => router.replace(d === 30 ? "/admin" : `/admin?days=${d}`, { scroll: false });

  function exportCsv() {
    if (!data) return;
    const t = data.trends;
    const rows: (string | number | null)[][] = [
      ["AutoClipr executive report", `Last ${data.period.days} days (UTC)`, data.period.from.slice(0, 10), data.period.to.slice(0, 10)],
      [],
      ["Metric", "Value", "Previous period", "Change %", "Definition"],
      ["Total users", data.users.total, "", "", data.definitions.totalUsers],
      ["Paid users", data.users.paid, "", "", data.definitions.paidUsers],
      ["Conversion rate %", data.users.conversionRate, "", "", data.definitions.conversionRate],
      ["Active paid subscriptions", data.subscriptions.active, "", "", data.definitions.activeSubscriptions],
      ["MRR (INR)", data.revenue.mrrRupees, "", "", data.definitions.mrr],
      ["ARR (INR)", data.revenue.arrRupees, "", "", data.definitions.arr],
      ["ARPU (INR)", data.revenue.arpuRupees, "", "", data.definitions.arpu],
      ["Churn rate %", data.subscriptions.churnRate, "", "", data.definitions.churnRate],
      ["New users", t.newUsers.current, t.newUsers.previous, t.newUsers.changePct, data.definitions.newUsers],
      ["Revenue (INR)", t.revenueRupees.current, t.revenueRupees.previous, t.revenueRupees.changePct, data.definitions.revenue],
      ["Videos", t.videos.current, t.videos.previous, t.videos.changePct, data.definitions.videos],
      ["Clips", t.clips.current, t.clips.previous, t.clips.changePct, data.definitions.clips],
      ["Credits used", t.creditsUsed.current, t.creditsUsed.previous, t.creditsUsed.changePct, data.definitions.creditsUsed],
      [],
      ["Date", "Sign-ups", "Revenue (INR)", "Videos", "Clips", "Credits used"],
      ...t.newUsers.series.map((d, i) => [d.date, d.value, t.revenueRupees.series[i]?.value ?? 0, t.videos.series[i]?.value ?? 0, t.clips.series[i]?.value ?? 0, t.creditsUsed.series[i]?.value ?? 0]),
    ];
    downloadCsv(`autoclipr-executive-${data.period.days}d-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC]">Executive dashboard</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Last {days} days vs the {days} days before · UTC
            {updatedAt && <span className="text-[#64748B]"> · updated {updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#263449] bg-[#141F30] p-0.5" role="radiogroup" aria-label="Period">
            {RANGES.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)}
                className={cn("h-8 rounded-md px-3 text-xs font-medium", days === d ? "bg-[#54D045] text-[#0B1120]" : "text-[#94A3B8] hover:text-[#F8FAFC]")}>
                {d}d
              </button>
            ))}
          </div>
          <label className="flex h-9 items-center gap-1.5 rounded-lg border border-[#263449] bg-[#141F30] px-2.5 text-xs text-[#94A3B8]">
            Auto-refresh
            <select value={refreshSecs} onChange={(e) => setRefreshSecs(Number(e.target.value))} className="bg-transparent text-[#F8FAFC] focus:outline-none" aria-label="Auto-refresh interval">
              {REFRESH.map((r) => <option key={r.id} value={r.id} className="bg-[#141F30]">{r.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh now"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#263449] bg-[#141F30] text-[#94A3B8] hover:text-[#F8FAFC] disabled:opacity-50">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button type="button" onClick={exportCsv} disabled={!data}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#263449] bg-[#141F30] px-3 text-xs font-medium text-[#F8FAFC] hover:border-[#35445a] disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {error && !data && (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-[#F87171]" />
            <p className="text-sm text-[#CBD5E1]">{error}</p>
            <button type="button" onClick={() => void load()} className="h-9 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#0B1120]">Try again</button>
          </div>
        </Panel>
      )}
      {error && data && <p className="rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-xs text-[#FCA5A5]" role="alert">Refresh failed: {error}. Showing the last loaded data.</p>}

      {!data && !error && <DashboardSkeleton />}
      {data && <DashboardBody data={data} />}
    </div>
  );
}

export function DashboardBody({ data }: { data: Stats }) {
  const d = data.definitions;
  const t = data.trends;
  const s = data.system;
  return (
    <>
      <div>
        <SectionLabel>Users</SectionLabel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard icon={Users} label="Total users" value={fmtNum(data.users.total)} help={d.totalUsers} sub={`+${data.users.newToday} today`} />
          <KpiCard icon={UserPlus} label="New users" value={fmtNum(t.newUsers.current)} help={d.newUsers} delta={t.newUsers.changePct} series={t.newUsers.series.map((x) => x.value)} />
          <KpiCard icon={CreditCard} label="Paid users" value={fmtNum(data.users.paid)} help={d.paidUsers} sub={`${fmtNum(data.users.free)} free`} accent="#8B5CF6" />
          <KpiCard icon={TrendingUp} label="Conversion" value={`${data.users.conversionRate}%`} help={d.conversionRate} sub="paid ÷ total" accent="#8B5CF6" />
          <KpiCard icon={UserCheck} label="Active subscriptions" value={fmtNum(data.subscriptions.active)} help={d.activeSubscriptions} sub="paid plans only" accent="#F59E0B" />
          <KpiCard icon={Wifi} label="Online now" value={fmtNum(data.users.online)} help={d.onlineUsers} sub="last 5 min" accent="#38BDF8" />
        </div>
      </div>

      <div>
        <SectionLabel>Revenue</SectionLabel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="MRR" value={fmtInr(data.revenue.mrrRupees)} help={d.mrr} sub={`${data.subscriptions.active} active`} />
          <KpiCard icon={DollarSign} label="ARR" value={fmtInr(data.revenue.arrRupees)} help={d.arr} sub="MRR × 12" />
          <KpiCard icon={Receipt} label={`Revenue · ${data.period.days}d`} value={fmtInr(t.revenueRupees.current)} help={d.revenue} delta={t.revenueRupees.changePct} series={t.revenueRupees.series.map((x) => x.value)} />
          <KpiCard icon={Gauge} label="ARPU" value={fmtInr(data.revenue.arpuRupees)} help={d.arpu} sub="per active sub / month" accent="#8B5CF6" />
          <KpiCard icon={TrendingDown} label="Churn · 30d" value={data.subscriptions.churnRate == null ? "—" : `${data.subscriptions.churnRate}%`} help={d.churnRate}
            sub={data.subscriptions.churnRate == null ? "no paid subscriptions yet" : `${data.subscriptions.cancelled} ended all time`} accent="#F87171" />
        </div>
      </div>

      <div>
        <SectionLabel>Content & AI</SectionLabel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard icon={Video} label={`Videos · ${data.period.days}d`} value={fmtNum(t.videos.current)} help={d.videos} delta={t.videos.changePct} series={t.videos.series.map((x) => x.value)} sub={`${fmtNum(data.videos.total)} total`} accent="#38BDF8" />
          <KpiCard icon={Scissors} label={`Clips · ${data.period.days}d`} value={fmtNum(t.clips.current)} help={d.clips} delta={t.clips.changePct} series={t.clips.series.map((x) => x.value)} sub={`${fmtNum(data.clips.total)} total`} accent="#8B5CF6" />
          <KpiCard icon={Zap} label={`Credits used · ${data.period.days}d`} value={fmtNum(t.creditsUsed.current)} help={d.creditsUsed} delta={t.creditsUsed.changePct} series={t.creditsUsed.series.map((x) => x.value)} accent="#F59E0B" />
          <KpiCard icon={Bot} label="Hooks rendered" value={data.ai.hooksGenerated == null ? "Not tracked" : fmtNum(data.ai.hooksGenerated)} help={d.hooks} sub="all time" accent="#54D045" />
          <KpiCard icon={Database} label="Storage" value={data.videos.storageFormatted} help={d.storage} sub="source videos" accent="#94A3B8" />
          <KpiCard icon={Flame} label="Failed jobs · 24h" value={fmtNum(s.failedJobs)} help={d.failedJobs} sub={`${fmtNum(s.completedJobs24h)} completed`} accent={s.failedJobs ? "#F87171" : "#54D045"} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <TrendPanel data={data} />
        <Panel title="Paid plans" subtitle="Active paid subscriptions by plan">
          <PlanSplit data={data} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Activation funnel" subtitle="Users reaching each step (all time)">
          <div className="space-y-3">
            {data.funnel.map((f, i) => {
              const top = data.funnel[0]?.value || 1;
              const prev = i ? data.funnel[i - 1].value : null;
              return (
                <div key={f.stage}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-[#CBD5E1]">{f.stage}</span>
                    <span className="tabular-nums text-[#F8FAFC]">{fmtNum(f.value)} {prev ? <span className="text-[#64748B]">· {prev ? Math.round((f.value / prev) * 1000) / 10 : 0}%</span> : null}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#1A2739]"><div className="h-full rounded-full bg-[#54D045]" style={{ width: `${(f.value / top) * 100}%`, opacity: 1 - i * 0.15 }} /></div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="AI feature usage" subtitle={`Generation jobs using each enhancement · last ${data.period.days * 2} days`} action={<Link href="/admin/ai-usage" className="text-xs text-[#8fe383] hover:underline">Details</Link>}>
          <AiUsage data={data} />
        </Panel>

        <Panel title="System health" subtitle="Live job queue · API server host" action={<Link href="/admin/system" className="text-xs text-[#8fe383] hover:underline">Details</Link>}>
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Queued" value={fmtNum(s.queueSize)} help={d.queue} />
            <Mini label="Processing" value={fmtNum(s.processingJobs)} help={d.processing} />
            <Mini label="Failed 24h" value={fmtNum(s.failedJobs)} help={d.failedJobs} tone={s.failedJobs ? "bad" : undefined} />
          </div>
          <div className="mt-4 space-y-3">
            <Bar label="API CPU" value={s.cpuPercent} help={d.apiCpu} />
            <Bar label="API memory" value={s.memoryPercent} help={d.apiMemory} />
          </div>
          <p className="mt-4 flex items-center justify-between text-xs text-[#64748B]">
            <span className="flex items-center gap-1">Avg processing <InfoTip text={d.avgProcessing} /></span>
            <span className="tabular-nums text-[#CBD5E1]">{fmtDuration(s.avgProcessingSecs)}</span>
          </p>
          <p className="mt-1 text-[11px] text-[#64748B]">Worker CPU and memory aren&apos;t reported yet.</p>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title="Recent sign-ups" className="xl:col-span-2" action={<Link href="/admin/users" className="inline-flex items-center gap-1 text-xs text-[#8fe383] hover:underline">All users <ArrowRight className="h-3 w-3" /></Link>}>
          {data.users.recent.length ? (
            <ul className="divide-y divide-[#1c2a3f]">
              {data.users.recent.map((u) => {
                const paid = !["free", "starter"].includes(u.subscription_tier);
                return (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A2739] text-[11px] font-semibold text-[#94A3B8]">{(cleanName(u.full_name) || u.email).slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#F8FAFC]">{cleanName(u.full_name) || u.email}</p>
                      <p className="truncate text-[11px] text-[#64748B]">{u.email} · {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", paid ? "bg-[#54D045]/15 text-[#8fe383]" : "bg-[#1A2739] text-[#94A3B8]")}>{u.subscription_tier}</span>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState icon={Users} title="No sign-ups yet" />}
        </Panel>
        <Panel title="Recent transactions" className="xl:col-span-3">
          <Transactions rows={data.revenue.recent} />
        </Panel>
      </div>
    </>
  );
}

/** Names sometimes arrive mis-encoded (e.g. "â€”"); show the email instead. */
const cleanName = (n: string | null) => (n && !/â€|Ã/.test(n) ? n : null);

export function Mini({ label, value, help, tone }: { label: string; value: string; help?: string; tone?: "bad" }) {
  return (
    <div className="rounded-lg border border-[#263449] bg-[#0F192A] px-3 py-2.5">
      <p className="flex items-center gap-1 text-[11px] text-[#64748B]">{label} <InfoTip text={help} /></p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", tone === "bad" ? "text-[#F87171]" : "text-[#F8FAFC]")}>{value}</p>
    </div>
  );
}

function Bar({ label, value, help }: { label: string; value: number; help?: string }) {
  const color = value >= 85 ? "#F87171" : value >= 65 ? "#F59E0B" : "#54D045";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="flex items-center gap-1 text-[#94A3B8]">{label} <InfoTip text={help} /></span>
        <span className="tabular-nums text-[#F8FAFC]">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1A2739]"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color }} /></div>
    </div>
  );
}

function TrendPanel({ data }: { data: Stats }) {
  const [tab, setTab] = useState<(typeof TREND_TABS)[number]["id"]>("newUsers");
  const meta = TREND_TABS.find((x) => x.id === tab)!;
  const tr = data.trends[tab];
  const fmt = (v: number) => (meta.money ? fmtInr(v) : fmtNum(v));
  const series = useMemo(() => tr.series.map((p) => ({ ...p, label: new Date(`${p.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) })), [tr]);
  return (
    <Panel className="xl:col-span-2" title="Trends" subtitle={`Daily, last ${data.period.days} days (UTC)`}
      action={
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Trend metric">
          {TREND_TABS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
              className={cn("h-7 rounded-md px-2.5 text-xs font-medium", tab === x.id ? "bg-[#1A2739] text-[#F8FAFC]" : "text-[#94A3B8] hover:text-[#F8FAFC]")}>
              {x.label}
            </button>
          ))}
        </div>
      }>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums text-[#F8FAFC]">{fmt(tr.current)}</span>
        <Delta pct={tr.changePct} />
        <span className="text-xs text-[#64748B]">previous {data.period.days} days: {fmt(tr.previous)}</span>
      </div>
      {tr.current === 0 && tr.previous === 0 ? (
        <EmptyState icon={Activity} title="No activity in this period" />
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#54D045" stopOpacity={0.3} />
                  <stop offset="1" stopColor="#54D045" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1c2a3f" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v: number) => (meta.money ? fmtInr(v) : fmtNum(v))} width={56} />
              <Tooltip cursor={{ stroke: "#263449" }} contentStyle={{ background: "#1A2739", border: "1px solid #263449", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#94A3B8" }}
                formatter={(v) => [fmt(Number(v)), meta.label]} />
              <Area type="monotone" dataKey="value" stroke="#54D045" strokeWidth={2} fill="url(#trendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function PlanSplit({ data }: { data: Stats }) {
  const entries = Object.entries(data.subscriptions.byPlan).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <div className="relative mx-auto h-40 w-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={[{ name: "Free", value: data.users.free }, { name: "Paid", value: data.users.paid }]} dataKey="value" innerRadius={52} outerRadius={70} startAngle={90} endAngle={-270} stroke="none">
              <Cell fill="#263449" />
              <Cell fill="#54D045" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums text-[#F8FAFC]">{data.users.conversionRate}%</span>
          <span className="text-[11px] text-[#64748B]">paid</span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-[#64748B]">{fmtNum(data.users.paid)} paid · {fmtNum(data.users.free)} free</p>
      <div className="mt-4 space-y-2.5 border-t border-[#263449] pt-4">
        {entries.length ? entries.map(([plan, n]) => (
          <div key={plan}>
            <div className="mb-1 flex justify-between text-xs"><span className="capitalize text-[#CBD5E1]">{plan}</span><span className="tabular-nums text-[#F8FAFC]">{n}</span></div>
            <div className="h-1.5 rounded-full bg-[#1A2739]"><div className="h-full rounded-full" style={{ width: `${(n / total) * 100}%`, background: PLAN_COLOR[plan] ?? "#94A3B8" }} /></div>
          </div>
        )) : <p className="text-center text-xs text-[#64748B]">No active paid subscriptions.</p>}
        {data.subscriptions.refundRate != null && (
          <p className="flex justify-between pt-1 text-xs text-[#64748B]"><span className="flex items-center gap-1">Refund rate <InfoTip text={data.definitions.refundRate} /></span><span className="text-[#CBD5E1]">{data.subscriptions.refundRate}%</span></p>
        )}
        <p className="flex justify-between text-xs text-[#64748B]"><span>Failed payments</span><span className="text-[#CBD5E1]">{data.subscriptions.failedPayments}</span></p>
      </div>
    </div>
  );
}

function AiUsage({ data }: { data: Stats }) {
  const rows = [
    ...(data.ai.hooksGenerated != null ? [{ label: "Hooks & headlines (clips)", value: data.ai.hooksGenerated }] : []),
    ...Object.entries(data.ai.enhancementJobs).map(([k, v]) => ({ label: FX_LABEL[k] ?? k, value: v })),
  ].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <EmptyState icon={Bot} title="No AI feature usage yet" text="Hooks and enhancements appear here once clips are generated with them." />;
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs"><span className="text-[#CBD5E1]"><span className="mr-1.5 text-[#64748B]">{i + 1}</span>{r.label}</span><span className="tabular-nums text-[#F8FAFC]">{fmtNum(r.value)}</span></div>
          <div className="h-1.5 rounded-full bg-[#1A2739]"><div className="h-full rounded-full bg-[#54D045]" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-[#64748B]">Provider costs per feature aren&apos;t recorded yet.</p>
    </div>
  );
}

type SortKey = "payment_date" | "amount" | "plan_id";
const amountNum = (a: string) => parseFloat(a.replace(/[^\d.]/g, "")) || 0;

export function Transactions({ rows }: { rows: Stats["revenue"]["recent"] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "payment_date", dir: -1 });
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = s ? rows.filter((r) => `${r.invoice_number} ${r.plan_id} ${r.billing_period}`.toLowerCase().includes(s)) : rows;
    return [...f].sort((a, b) => {
      const av = sort.key === "amount" ? amountNum(a.amount) : sort.key === "payment_date" ? new Date(a.payment_date).getTime() : a.plan_id;
      const bv = sort.key === "amount" ? amountNum(b.amount) : sort.key === "payment_date" ? new Date(b.payment_date).getTime() : b.plan_id;
      return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
    });
  }, [rows, q, sort]);
  const th = (key: SortKey, label: string, cls = "") => (
    <th className={cn("pb-2 font-medium", cls)} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((p) => ({ key, dir: p.key === key ? (p.dir === 1 ? -1 : 1) : -1 }))} className="inline-flex items-center gap-1 hover:text-[#F8FAFC]">
        {label}{sort.key === key && <span aria-hidden>{sort.dir === 1 ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice, plan or period" aria-label="Search transactions"
            className="h-8 w-full rounded-lg border border-[#263449] bg-[#0F192A] pl-8 pr-3 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#54D045]/50 focus:outline-none" />
        </label>
        <button type="button" disabled={!list.length}
          onClick={() => downloadCsv("autoclipr-transactions.csv", [["Invoice", "Plan", "Amount", "Period", "Date"], ...list.map((r) => [r.invoice_number, r.plan_id, r.amount, r.billing_period, r.payment_date])])}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#263449] px-2.5 text-xs text-[#CBD5E1] hover:text-[#F8FAFC] disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>
      {list.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[#64748B]">
              <tr>
                <th className="pb-2 font-medium">Invoice</th>
                {th("plan_id", "Plan")}
                {th("amount", "Amount")}
                <th className="pb-2 font-medium">Period</th>
                {th("payment_date", "Date", "text-right")}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2a3f]">
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 font-mono text-[11px] text-[#94A3B8]">{r.invoice_number}</td>
                  <td className="py-2.5 capitalize text-[#CBD5E1]">{r.plan_id}</td>
                  <td className="py-2.5 font-medium tabular-nums text-[#F8FAFC]">{r.amount}</td>
                  <td className="py-2.5 capitalize text-[#94A3B8]">{r.billing_period}</td>
                  <td className="py-2.5 text-right tabular-nums text-[#94A3B8]">{new Date(r.payment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Receipt} title={q ? "No matching transactions" : "No transactions yet"} />
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7" aria-busy="true" aria-label="Loading dashboard">
      {[6, 5, 6].map((n, i) => (
        <div key={i}>
          <Skeleton className="mb-3 h-3 w-20" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: n }, (_, j) => <Skeleton key={j} className="h-[128px]" />)}</div>
        </div>
      ))}
      <div className="grid gap-4 xl:grid-cols-3"><Skeleton className="h-80 xl:col-span-2" /><Skeleton className="h-80" /></div>
      <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#64748B]" /></div>
    </div>
  );
}
