"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Download, Loader2, Receipt, Search, X } from "lucide-react";
import { getAccessToken } from "@/lib/auth-token";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/app/(dashboard)/subscription/page";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const PAGE_SIZE = 10;

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]" },
  succeeded: { label: "Paid", cls: "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]" },
  pending: { label: "Pending", cls: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-amber-200" },
  failed: { label: "Failed", cls: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#fca5a5]" },
  refunded: { label: "Refunded", cls: "border-[#35D6E8]/30 bg-[#35D6E8]/10 text-[#9beef7]" },
  cancelled: { label: "Cancelled", cls: "border-[#253244] bg-[#131D2B] text-[#94A3B8]" },
};

export function statusOf(s: string) {
  return STATUS[s] ?? { label: s, cls: "border-[#253244] bg-[#131D2B] text-[#94A3B8]" };
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Downloads the receipt through the signed-in endpoint, which builds it from the stored payment. */
async function downloadReceipt(tx: Transaction) {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch(`${API_URL}/api/v1/billing/transactions/${encodeURIComponent(tx.id)}/receipt`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(res.status === 404 ? "This receipt isn't available." : "Couldn't download the receipt. Try again.");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `autoclipr-invoice-${tx.invoice_number}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReceiptButton({ tx, compact }: { tx: Transaction; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [err, setErr] = useState("");
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={state === "busy"}
        onClick={async (e) => {
          e.stopPropagation();
          setState("busy");
          try {
            await downloadReceipt(tx);
            setState("idle");
          } catch (x) {
            setErr((x as Error).message);
            setState("error");
          }
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-[#253244] text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.04] disabled:opacity-60",
          compact ? "h-8 px-2.5" : "h-9 px-3",
        )}
      >
        {state === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        PDF
      </button>
      {state === "error" && <span className="mt-1 text-[10px] text-[#fca5a5]">{err}</span>}
    </span>
  );
}

export function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const plans = useMemo(() => Array.from(new Set(transactions.map((t) => t.plan_id))), [transactions]);
  const statuses = useMemo(() => Array.from(new Set(transactions.map((t) => t.status))), [transactions]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions
      .filter(
        (t) =>
          (status === "all" || t.status === status) &&
          (plan === "all" || t.plan_id === plan) &&
          (!q || t.invoice_number.toLowerCase().includes(q) || (t.transaction_id ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  }, [transactions, query, status, plan]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const selectCls =
    "h-9 rounded-lg border border-[#253244] bg-[#0A111B] px-3 text-sm text-[#F8FAFC] outline-none focus:border-[#54D045]/60 [color-scheme:dark]";

  return (
    <section className="rounded-2xl border border-[#253244] bg-[#101824]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#253244] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC]">Payment history</h2>
          <p className="mt-0.5 text-sm text-[#94A3B8]">Every payment for your subscription, newest first.</p>
        </div>
        {transactions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Invoice or payment ID"
                aria-label="Search by invoice or payment ID"
                className="h-9 w-48 rounded-lg border border-[#253244] bg-[#0A111B] pl-8 pr-3 text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B] focus:border-[#54D045]/60"
              />
            </label>
            {plans.length > 1 && (
              <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} aria-label="Plan" className={selectCls}>
                <option value="all">All plans</option>
                {plans.map((p) => <option key={p} value={p}>{cap(p)}</option>)}
              </select>
            )}
            {statuses.length > 1 && (
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className={selectCls}>
                <option value="all">All statuses</option>
                {statuses.map((s) => <option key={s} value={s}>{statusOf(s).label}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
          <Receipt className="h-8 w-8 text-[#253244]" />
          <p className="font-medium text-[#F8FAFC]">No payments yet</p>
          <p className="text-sm text-[#94A3B8]">Payments and receipts appear here once you subscribe to a paid plan.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-[#94A3B8]">No payments match these filters.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-[#64748B]">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Invoice</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Paid on</th>
                  <th className="px-3 py-2.5 font-medium">Period ends</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#253244]/60">
                {visible.map((t) => (
                  <tr key={t.id} onClick={() => setSelected(t)} className="cursor-pointer hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-xs text-[#cbd5e1]">#{t.invoice_number}</td>
                    <td className="px-3 py-3 text-[#F8FAFC]">
                      {cap(t.plan_id)}
                      {t.billing_period && <span className="ml-1.5 text-xs text-[#64748B]">· {cap(t.billing_period)}</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#F8FAFC]">{t.amount}</td>
                    <td className="px-3 py-3 text-[#94A3B8]">{fmtDate(t.payment_date)}</td>
                    <td className="px-3 py-3 text-[#94A3B8]">{t.period_end ? fmtDate(t.period_end) : "—"}</td>
                    <td className="px-3 py-3">
                      <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-medium", statusOf(t.status).cls)}>{statusOf(t.status).label}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ReceiptButton tx={t} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="divide-y divide-[#253244]/60 md:hidden">
            {visible.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelected(t)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left">
                  <div className="min-w-0">
                    <p className="font-medium text-[#F8FAFC]">{cap(t.plan_id)} · {t.amount}</p>
                    <p className="text-xs text-[#94A3B8]">#{t.invoice_number} · {fmtDate(t.payment_date)}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", statusOf(t.status).cls)}>{statusOf(t.status).label}</span>
                </button>
              </li>
            ))}
          </ul>
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

      {selected && <InvoiceDrawer tx={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function InvoiceDrawer({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const st = statusOf(tx.status);
  const rows: [string, React.ReactNode][] = [
    ["Invoice number", <CopyText key="inv" text={tx.invoice_number} />],
    ["Payment reference", tx.transaction_id ? <CopyText key="tx" text={tx.transaction_id} /> : "—"],
    ["Plan", cap(tx.plan_id)],
    ["Billing period", tx.billing_period ? cap(tx.billing_period) : "—"],
    ["Paid on", fmtDate(tx.payment_date)],
    ["Period ends", tx.period_end ? fmtDate(tx.period_end) : "—"],
    ["Amount", <span key="amt" className="font-semibold">{tx.amount}</span>],
    ["Status", <span key="st" className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>],
    ["Provider", "Dodo Payments"],
  ];
  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-[#070B12]/70 backdrop-blur-sm" onClick={onClose} role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-title"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l border-[#253244] bg-[#101824] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#253244] px-5 py-4">
          <h3 id="inv-title" className="font-semibold text-[#F8FAFC]">Invoice #{tx.invoice_number}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="flex-1 space-y-3 overflow-y-auto px-5 py-5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="shrink-0 text-[#94A3B8]">{k}</dt>
              <dd className="min-w-0 text-right text-[#F8FAFC]">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-[#253244] px-5 py-4">
          <ReceiptButton tx={tx} />
        </div>
      </aside>
    </div>
  );
}

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="break-all font-mono text-xs">{text}</span>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        className="shrink-0 rounded p-1 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-[#86efac]" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
