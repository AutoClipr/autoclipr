"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Gift, RotateCcw, Search, X } from "lucide-react";
import type { CreditKind, CreditUsageRow } from "@/lib/credit-usage";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50];

type Filter = "all" | CreditKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "used", label: "Credits used" },
  { value: "added", label: "Credits added" },
  { value: "refund", label: "Refunds" },
  { value: "bonus", label: "Bonuses" },
];

const KIND_META: Record<CreditKind, { label: string; badge: string; icon: typeof Gift }> = {
  used: { label: "Used", badge: "border-[#253244] bg-[#131D2B] text-[#cbd5e1]", icon: ArrowDownRight },
  added: { label: "Added", badge: "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]", icon: ArrowUpRight },
  refund: { label: "Refunded", badge: "border-[#35D6E8]/30 bg-[#35D6E8]/10 text-[#9beef7]", icon: RotateCcw },
  bonus: { label: "Bonus", badge: "border-[#54D045]/30 bg-[#54D045]/10 text-[#a6ec9c]", icon: Gift },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Credit usage history: filters, search, date range, sort, paging and a details view. */
export function CreditUsageTable({ rows, exportable = false }: { rows: CreditUsageRow[]; exportable?: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CreditUsageRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromT = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toT = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const list = rows.filter((r) => {
      if (filter !== "all" && r.kind !== filter) return false;
      const t = new Date(r.created_at).getTime();
      if (fromT != null && t < fromT) return false;
      if (toT != null && t > toT) return false;
      if (q && !`${r.detail} ${r.activity}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return newestFirst ? list : [...list].reverse();
  }, [rows, filter, query, from, to, newestFirst]);

  useEffect(() => setPage(1), [filter, query, from, to, newestFirst, size]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * size, current * size);
  const hasFilters = filter !== "all" || query || from || to;

  /** CSV of the transactions matching the current filters (only this user's rows are loaded). */
  function exportCsv() {
    const header = ["Transaction ID", "Timestamp", "Activity", "Description", "Type", "Credits", "Balance after", "Reference ID"];
    const lines = filtered.map((r) => [
      r.id,
      r.created_at,
      r.activity,
      r.detail,
      KIND_META[r.kind].label,
      r.amount,
      r.balance_after ?? "",
      r.reference_id ?? "",
    ]);
    const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "autoclipr-credit-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = useMemo(() => {
    let used = 0;
    let back = 0;
    for (const r of rows) {
      if (r.amount < 0) used += -r.amount;
      else back += r.amount;
    }
    return { used, back };
  }, [rows]);

  const input =
    "h-9 rounded-lg border border-[#253244] bg-[#0A111B] px-3 text-sm text-[#F8FAFC] outline-none transition-colors placeholder:text-[#64748B] focus:border-[#54D045]/60";
  const navBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-[#253244] text-[#cbd5e1] transition-colors hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-35";

  return (
    <section className="rounded-2xl border border-[#253244] bg-[#101824]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#253244] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC]">Credit usage history</h2>
          <p className="mt-0.5 text-sm text-[#94A3B8]">Track how your credits are used, earned, and refunded.</p>
        </div>
        {rows.length > 0 && (
          <p className="text-xs text-[#94A3B8]">
            <span className="text-[#F8FAFC]">{totals.used.toLocaleString()}</span> used ·{" "}
            <span className="text-[#86efac]">{totals.back.toLocaleString()}</span> added back
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="font-medium text-[#F8FAFC]">No credit activity yet</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Credits you use on clips will show up here.</p>
          <Link
            href="/create"
            className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]"
          >
            Create clips
          </Link>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="space-y-3 border-b border-[#253244] px-5 py-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Transaction type">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
                    filter === f.value
                      ? "bg-[#19251F] text-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(84,208,69,0.4)]"
                      : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#F8FAFC]",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by video or activity"
                  aria-label="Search transactions"
                  className={cn(input, "w-full pl-8")}
                />
              </label>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className={cn(input, "[color-scheme:dark]")} />
              <span className="text-xs text-[#64748B]">to</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" className={cn(input, "[color-scheme:dark]")} />
              <button
                type="button"
                onClick={() => setNewestFirst((v) => !v)}
                className="h-9 rounded-lg border border-[#253244] px-3 text-xs font-medium text-[#cbd5e1] hover:bg-white/[0.04]"
              >
                {newestFirst ? "Newest first" : "Oldest first"}
              </button>
              {exportable && filtered.length > 0 && (
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#253244] px-3 text-xs font-medium text-[#cbd5e1] hover:bg-white/[0.04]"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              )}
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                    setFrom("");
                    setTo("");
                  }}
                  className="h-9 px-2 text-xs font-medium text-[#8fe383] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {visible.length === 0 ? (
              <p className="px-5 py-14 text-center text-sm text-[#94A3B8]">No transactions match these filters.</p>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#64748B]">
                    <th className="px-5 py-2.5 font-medium">Date &amp; time</th>
                    <th className="px-3 py-2.5 font-medium">Activity</th>
                    <th className="w-full px-3 py-2.5 font-medium">Description</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 text-right font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#253244]/60">
                  {visible.map((r) => {
                    const meta = KIND_META[r.kind];
                    return (
                      <tr
                        key={r.id}
                        tabIndex={0}
                        onClick={() => setSelected(r)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(r))}
                        className="cursor-pointer transition-colors hover:bg-white/[0.02] focus:bg-white/[0.03] focus:outline-none"
                      >
                        <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-[#94A3B8]">{fmtDate(r.created_at)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-[#cbd5e1]">{r.activity}</td>
                        <td className="max-w-0 px-3 py-3">
                          <p className="truncate text-[#F8FAFC]">{r.detail}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium", meta.badge)}>
                            {meta.label}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums",
                            r.amount < 0 ? "text-[#F8FAFC]" : "text-[#86efac]",
                          )}
                        >
                          {r.amount > 0 ? `+${r.amount}` : r.amount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Paging */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#253244] px-5 py-3">
            <label className="relative flex items-center rounded-lg border border-[#253244] text-xs text-[#94A3B8]">
              <span className="pl-2.5">Show</span>
              <select
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                aria-label="Rows per page"
                className="cursor-pointer appearance-none bg-transparent py-1.5 pl-1.5 pr-7 font-semibold text-[#F8FAFC] outline-none"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n} className="bg-[#101824]">
                    {n}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5" />
            </label>
            <p className="text-xs text-[#94A3B8]">
              {filtered.length} transaction{filtered.length === 1 ? "" : "s"} · page {current} of {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)} className={navBtn}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Next page" disabled={current === totalPages} onClick={() => setPage(current + 1)} className={navBtn}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {selected && <TransactionDetails row={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function TransactionDetails({ row, onClose }: { row: CreditUsageRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const meta = KIND_META[row.kind];
  const Icon = meta.icon;
  const items: [string, React.ReactNode][] = [
    ["Date & time", fmtDate(row.created_at)],
    ["Activity", row.activity],
    ["Description", row.detail],
    ["Status", meta.label],
    ["Credits", <span key="c" className={row.amount < 0 ? "" : "text-[#86efac]"}>{row.amount > 0 ? `+${row.amount}` : row.amount}</span>],
  ];
  if (row.balance_after != null) items.push(["Balance after", row.balance_after.toLocaleString()]);
  items.push(["Transaction ID", <CopyId key="id" id={row.id} />]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070B12]/80 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#253244] bg-[#101824] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]"
      >
        <div className="flex items-center justify-between border-b border-[#253244] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", meta.badge)}>
              <Icon className="h-4 w-4" />
            </span>
            <h3 id="tx-title" className="font-semibold text-[#F8FAFC]">
              Transaction details
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="space-y-3 px-5 py-4 text-sm">
          {items.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="shrink-0 text-[#94A3B8]">{k}</dt>
              <dd className="min-w-0 text-right text-[#F8FAFC]">{v}</dd>
            </div>
          ))}
        </dl>
        {row.kind === "refund" && (
          <p className="mx-5 mb-4 rounded-lg border border-[#35D6E8]/25 bg-[#35D6E8]/[0.06] px-3 py-2 text-xs text-[#9beef7]">
            These credits were returned automatically because the job couldn&apos;t finish.
          </p>
        )}
        {row.reference_id && (
          <div className="border-t border-[#253244] px-5 py-3">
            <Link href={`/clips?video=${row.reference_id}`} className="text-xs font-medium text-[#8fe383] hover:underline">
              View this video&apos;s clips →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="break-all font-mono text-xs">{id}</span>
      <button
        type="button"
        aria-label="Copy transaction ID"
        onClick={() =>
          navigator.clipboard.writeText(id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
        className="shrink-0 rounded p-1 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-[#86efac]" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
