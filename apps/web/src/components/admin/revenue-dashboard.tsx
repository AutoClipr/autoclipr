"use client";

/** Revenue page. Same endpoint as the executive dashboard (GET /admin/stats), revenue-focused view. */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CreditCard, DollarSign, Download, Gauge, Loader2, Receipt, RefreshCw, TrendingDown, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { cn } from "@/lib/utils";
import { type Stats, Mini, PLAN_COLOR, Transactions } from "./executive-dashboard";
import { Delta, EmptyState, KpiCard, Panel, SectionLabel, Skeleton, downloadCsv, fmtInr, fmtNum } from "./ui";

const RANGES = [7, 30, 90] as const;
const TIP = { background: "#1A2739", border: "1px solid #263449", borderRadius: 10, fontSize: 12, color: "#F8FAFC" };
const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

export function RevenueDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const days = RANGES.includes(Number(params.get("days")) as 7) ? Number(params.get("days")) : 30;
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const res = await apiFetch<Stats>(`/api/v1/admin/stats?days=${days}`, { token, skipGlobalLoader: true });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? "Couldn't load revenue.");
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load revenue.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const setDays = (d: number) => router.replace(d === 30 ? "/admin/revenue" : `/admin/revenue?days=${d}`, { scroll: false });

  function exportCsv() {
    if (!data) return;
    const r = data.revenue;
    downloadCsv(`autoclipr-revenue-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Metric", "Value (INR)", "Definition"],
      ["MRR", r.mrrRupees, data.definitions.mrr],
      ["ARR", r.arrRupees, data.definitions.arr],
      ["ARPU", r.arpuRupees, data.definitions.arpu],
      [`Revenue last ${days}d`, data.trends.revenueRupees.current, data.definitions.revenue],
      ["Lifetime revenue", r.totalRupees, ""],
      [],
      ["Month", "Revenue (INR)"],
      ...r.byMonth.map((m) => [m.month, m.revenue]),
      [],
      ["Plan", "Lifetime revenue (INR)"],
      ...Object.entries(r.byPlan).map(([p, paise]) => [p, Math.round(paise / 100)]),
    ]);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC]">Revenue</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">Paid transactions from DodoPayments · last {days} days vs the {days} before · UTC</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Date range" className="flex rounded-lg border border-[#263449] bg-[#141F30] p-1">
            {RANGES.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)}
                className={cn("h-8 rounded-md px-3 text-xs font-medium", days === d ? "bg-[#54D045] text-[#0B1120]" : "text-[#94A3B8] hover:text-[#F8FAFC]")}>
                {d}d
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load()} aria-label="Refresh" title="Refresh"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#263449] bg-[#141F30] text-[#94A3B8] hover:text-[#F8FAFC]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button type="button" onClick={exportCsv} disabled={!data}
            className="flex h-10 items-center gap-2 rounded-lg border border-[#263449] bg-[#141F30] px-3 text-xs font-medium text-[#F8FAFC] hover:border-[#35445a] disabled:opacity-50">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {error && !data ? (
        <div className="rounded-xl border border-[#263449] bg-[#141F30]">
          <EmptyState icon={AlertTriangle} title="Couldn't load revenue" text={error} />
          <div className="pb-8 text-center"><button type="button" onClick={() => void load()} className="text-sm font-medium text-[#8fe383] hover:underline">Try again</button></div>
        </div>
      ) : !data ? (
        <RevenueSkeleton />
      ) : (
        <RevenueBody data={data} />
      )}
    </div>
  );
}

export function RevenueBody({ data }: { data: Stats }) {
  const r = data.revenue;
  const s = data.subscriptions;
  const d = data.definitions;
  const t = data.trends.revenueRupees;
  const days = data.period.days;

  return (
    <div className="space-y-8">
      <section>
        <SectionLabel>Recurring revenue</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiCard icon={DollarSign} label="MRR" value={fmtInr(r.mrrRupees)} help={d.mrr} sub={`${fmtNum(s.active)} active subs`} />
          <KpiCard icon={DollarSign} label="ARR" value={fmtInr(r.arrRupees)} help={d.arr} sub="MRR × 12" />
          <KpiCard icon={Receipt} label={`Revenue · ${days}d`} value={fmtInr(t.current)} help={d.revenue} delta={t.changePct} series={t.series.map((x) => x.value)} accent="#38BDF8" />
          <KpiCard icon={Wallet} label="Lifetime revenue" value={fmtInr(r.totalRupees)} sub={`${fmtNum(r.transactionCount)} payments`} accent="#8B5CF6" help={d.totalRevenue} />
          <KpiCard icon={Gauge} label="ARPU" value={fmtInr(r.arpuRupees)} help={d.arpu} sub="per active sub / month" accent="#F59E0B" />
          <KpiCard icon={TrendingDown} label="Churn · 30d" value={s.churnRate == null ? "—" : `${s.churnRate}%`} help={d.churnRate} accent="#F87171" sub="of paid subscriptions" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Daily revenue" subtitle={`Paid transactions per UTC day, last ${days} days`}
          action={<span className="text-right text-xs text-[#64748B]"><span className="block text-lg font-semibold tabular-nums text-[#F8FAFC]">{inr(t.current)}</span><Delta pct={t.changePct} /> · prev. {inr(t.previous)}</span>}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={t.series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#54D045" stopOpacity={0.25} />
                    <stop offset="1" stopColor="#54D045" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#263449" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v) => fmtInr(Number(v))} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip contentStyle={TIP} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [inr(Number(v)), "Revenue"]} cursor={{ stroke: "#35445a" }} />
                <Area type="linear" dataKey="value" stroke="#54D045" strokeWidth={2} fill="url(#rev-fill)" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Revenue by plan" subtitle="Lifetime paid revenue, with active subscriptions">
          <PlanRevenue data={data} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Monthly revenue" subtitle="Paid transactions per calendar month (UTC)">
          <Monthly rows={r.byMonth} />
        </Panel>
        <Panel title="Payment health" subtitle="Collection and retention signals">
          <div className="grid grid-cols-2 gap-3">
            <Mini label="Active subs" value={fmtNum(s.active)} help="Paid subscriptions currently active." />
            <Mini label="Ended subs" value={fmtNum(s.cancelled)} help="Paid subscriptions no longer active, all time." />
            <Mini label="Failed payments" value={fmtNum(s.failedPayments)} tone={s.failedPayments > 0 ? "bad" : undefined} help="Billing transactions with status failed." />
            <Mini label="Refund rate" value={s.refundRate == null ? "—" : `${s.refundRate}%`} help={d.refundRate} tone={(s.refundRate ?? 0) > 5 ? "bad" : undefined} />
          </div>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-[#0F192A] p-3 text-[11px] leading-relaxed text-[#64748B]">
            <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Renewal rate isn&apos;t tracked yet; it needs renewal events from the payment provider.
          </p>
        </Panel>
      </div>

      <Panel title="Transactions" subtitle="Most recent paid transactions">
        <Transactions rows={r.recent} />
      </Panel>
    </div>
  );
}

function Monthly({ rows }: { rows: { month: string; revenue: number }[] }) {
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  if (!sorted.length) return <EmptyState icon={Receipt} title="No revenue yet" text="Months appear here after the first paid transaction." />;
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const mom = prev?.revenue ? Math.round(((last.revenue - prev.revenue) / prev.revenue) * 1000) / 10 : null;
  const best = sorted.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-xs text-[#64748B]">
        <span>This month <span className="ml-1 font-semibold text-[#F8FAFC]">{inr(last.revenue)}</span> <Delta pct={mom} label="MoM" /></span>
        <span>Best month <span className="ml-1 font-semibold text-[#F8FAFC]">{monthLabel(best.month)} · {inr(best.revenue)}</span></span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#263449" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmtInr(Number(v))} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip contentStyle={TIP} labelFormatter={(l) => monthLabel(String(l))} formatter={(v) => [inr(Number(v)), "Revenue"]} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={44}>
              {sorted.map((m) => <Cell key={m.month} fill={m.month === last.month ? "#54D045" : "#2F6B2A"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PlanRevenue({ data }: { data: Stats }) {
  const rows = Object.entries(data.revenue.byPlan).map(([plan, paise]) => ({ plan, rupees: Math.round(paise / 100), subs: data.subscriptions.byPlan[plan] ?? 0 })).sort((a, b) => b.rupees - a.rupees);
  const total = rows.reduce((a, r) => a + r.rupees, 0);
  if (!total) return <EmptyState icon={Wallet} title="No paid revenue yet" />;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[#1A2739]">
        {rows.map((r) => <div key={r.plan} style={{ width: `${(r.rupees / total) * 100}%`, background: PLAN_COLOR[r.plan] ?? "#94A3B8" }} title={r.plan} />)}
      </div>
      <ul className="mt-5 space-y-4">
        {rows.map((r) => (
          <li key={r.plan} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLAN_COLOR[r.plan] ?? "#94A3B8" }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm capitalize text-[#F8FAFC]">{r.plan}</p>
              <p className="text-[11px] text-[#64748B]">{fmtNum(r.subs)} active · {((r.rupees / total) * 100).toFixed(1)}% of revenue</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-[#F8FAFC]">{fmtInr(r.rupees)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RevenueSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div>
      <div className="grid gap-4 xl:grid-cols-3"><Skeleton className="h-96 xl:col-span-2" /><Skeleton className="h-96" /></div>
      <Skeleton className="h-80" />
    </div>
  );
}
