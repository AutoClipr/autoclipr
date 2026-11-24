"use client";

/** Reusable admin building blocks (KPI card, panel, skeletons, states). */

import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({ title, action, children, className, subtitle }: { title?: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-[#263449] bg-[#141F30] p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-[#F8FAFC]">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-[#64748B]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">{children}</h2>;
}

/** Hover/focus tooltip explaining a metric. */
export function InfoTip({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span className="group/tip relative inline-flex">
      <button type="button" aria-label={text} className="text-[#64748B] hover:text-[#94A3B8] focus:outline-none focus-visible:text-[#F8FAFC]">
        <Info className="h-3.5 w-3.5" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-60 -translate-x-1/2 rounded-lg border border-[#263449] bg-[#1A2739] px-3 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-[#CBD5E1] shadow-xl group-hover/tip:block group-focus-within/tip:block">
        {text}
      </span>
    </span>
  );
}

/** Tiny trend line for KPI cards. */
export function Sparkline({ values, color = "#54D045" }: { values: number[]; color?: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) return <div className="h-8" aria-hidden />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / span) * 26 - 2}`).join(" ");
  const id = `sl-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,30 ${pts} 100,30`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** % change badge. `goodWhenUp=false` flips the colours (e.g. churn). */
export function Delta({ pct, goodWhenUp = true, label }: { pct: number | null | undefined; goodWhenUp?: boolean; label?: string }) {
  if (pct == null) return <span className="text-[11px] text-[#64748B]" title="No data in the previous period to compare with">— vs prev.</span>;
  const up = pct > 0;
  const flat = pct === 0;
  const good = flat ? null : up === goodWhenUp;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold", good == null ? "text-[#94A3B8]" : good ? "text-[#54D045]" : "text-[#F87171]")}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}% <span className="font-normal text-[#64748B]">{label ?? "vs prev."}</span>
    </span>
  );
}

export function KpiCard({
  icon: Icon, label, value, sub, delta, goodWhenUp = true, series, help, accent = "#54D045",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: React.ReactNode;
  delta?: number | null;
  goodWhenUp?: boolean;
  series?: number[];
  help?: string;
  accent?: string;
}) {
  return (
    <div className="group rounded-xl border border-[#263449] bg-[#141F30] p-4 transition-colors hover:border-[#35445a] hover:bg-[#16233A]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[#94A3B8]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${accent}1f`, color: accent }}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          {label}
        </span>
        <InfoTip text={help} />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-[#F8FAFC]">{value}</p>
      <div className="mt-1 flex min-h-[16px] flex-wrap items-center gap-x-2 text-[11px] text-[#64748B]">
        {delta !== undefined && <Delta pct={delta} goodWhenUp={goodWhenUp} />}
        {sub}
      </div>
      {series && <div className="mt-2"><Sparkline values={series} color={accent} /></div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[#1A2739]", className)} aria-hidden />;
}

export function EmptyState({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1A2739] text-[#64748B]"><Icon className="h-5 w-5" /></span>
      <p className="text-sm font-medium text-[#CBD5E1]">{title}</p>
      {text && <p className="max-w-xs text-xs text-[#64748B]">{text}</p>}
    </div>
  );
}

/** Formatting helpers. */
export function fmtInr(rupees: number) {
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(2)}Cr`;
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(1)}L`;
  if (rupees >= 1e4) return `₹${(rupees / 1e3).toFixed(1)}K`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}
export const fmtNum = (n: number) => n.toLocaleString("en-IN");
export function fmtDuration(secs: number | null | undefined) {
  if (secs == null) return "—";
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, "0")}s`;
}

/** Download rows as a CSV file. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
