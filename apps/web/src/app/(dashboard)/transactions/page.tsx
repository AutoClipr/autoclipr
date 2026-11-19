import Link from "next/link";
import { CalendarClock, CheckCircle2, FileText, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { TransactionHistory } from "@/components/billing/transaction-history";
import type { Transaction } from "@/app/(dashboard)/subscription/page";

export const metadata = { title: "Billing & payments" };

type BillingData = {
  profile: { subscription_tier: string };
  subscription: {
    plan_id: string;
    status: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    cancellation_effective_at?: string | null;
  } | null;
};
type Plan = { id: string; name: string; price_cents: number };

const PAID = new Set(["paid", "succeeded"]);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** "₹4,188.00" → 4188. Returns null for anything that isn't a rupee amount. */
function inr(amount: string): number | null {
  const m = amount.trim().match(/^₹\s?([\d,]+(?:\.\d+)?)$/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export default async function TransactionsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session!.access_token;

  const [txRes, billingRes, plansRes] = await Promise.all([
    apiFetch<Transaction[]>("/api/v1/billing/transactions", { token }),
    apiFetch<BillingData>("/api/v1/billing/subscription", { token }),
    apiFetch<Plan[]>("/api/v1/plans", { token }),
  ]);

  const txs = txRes.data ?? [];
  const paid = txs.filter((t) => PAID.has(t.status));
  // Only total when every paid amount is in rupees — never add up different currencies.
  const paidValues = paid.map((t) => inr(t.amount));
  const totalPaid = paidValues.length && paidValues.every((v) => v != null)
    ? `₹${paidValues.reduce((s, v) => s + (v ?? 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
    : paid.length
      ? "Mixed currencies"
      : "₹0";

  const sub = billingRes.data?.subscription ?? null;
  const tier = billingRes.data?.profile?.subscription_tier ?? "free";
  const planId = sub?.plan_id ?? (tier === "free" ? "starter" : tier);
  const plan = (plansRes.data ?? []).find((p) => p.id === planId);
  const planName = plan?.name ?? planId.charAt(0).toUpperCase() + planId.slice(1);
  const isPaid = !!plan && plan.price_cents > 0;
  const scheduled = !!sub?.cancel_at_period_end;
  const renews = isPaid && sub?.status === "active" && !scheduled ? sub.current_period_end ?? null : null;
  const lastPayment = paid[0];

  return (
    <div className="relative mx-auto max-w-5xl space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">BILLING CENTER</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[#F8FAFC]">Billing &amp; payments.</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">Manage your subscription payments, invoices, and billing history.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/transactions" className="inline-flex h-10 items-center rounded-lg border border-[#253244] bg-[#101824] px-3 text-sm text-[#F8FAFC] hover:border-[#35445a]">
            Refresh
          </Link>
          <Link href="/subscription" className="inline-flex h-10 items-center rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]">
            Manage subscription
          </Link>
        </div>
      </header>

      {!txRes.success && (
        <p className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-2.5 text-sm text-amber-100" role="alert">
          We couldn&apos;t load your payments. Refresh to try again.
        </p>
      )}

      {/* Current plan */}
      <section className="relative overflow-hidden rounded-2xl border border-[#253244] bg-gradient-to-br from-[#101824] to-[#0B1220] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#54D045]/[0.10] blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-[#94A3B8]">Current plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-[#F8FAFC]">{planName}</h2>
              {scheduled ? (
                <span className="rounded-md border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">Cancellation pending</span>
              ) : sub?.status ? (
                <span className="rounded-md border border-[#22C55E]/35 bg-[#22C55E]/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-[#86efac]">{sub.status.replace(/_/g, " ")}</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {lastPayment
                ? `${lastPayment.amount}${lastPayment.billing_period ? ` / ${lastPayment.billing_period === "yearly" ? "year" : "month"}` : ""} · last paid ${fmtDate(lastPayment.payment_date)}`
                : isPaid
                  ? "No payment recorded yet"
                  : "Free plan — no billing"}
            </p>
            {scheduled && (sub?.cancellation_effective_at || sub?.current_period_end) && (
              <p className="mt-1 text-xs text-amber-200">Access until {fmtDate((sub.cancellation_effective_at ?? sub.current_period_end)!)}</p>
            )}
          </div>
          <Link href="/subscription" className="inline-flex h-10 w-fit items-center rounded-lg border border-[#253244] px-4 text-sm font-medium text-[#F8FAFC] hover:bg-white/[0.04]">
            {scheduled ? "Resume or change plan" : isPaid ? "Change plan" : "Upgrade"}
          </Link>
        </div>
      </section>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={<Wallet className="h-4 w-4 text-[#54D045]" />} label="Total paid" value={totalPaid} hint="Successful payments only" />
        <Card icon={<FileText className="h-4 w-4 text-[#35D6E8]" />} label="Invoices" value={String(txs.length)} hint="All payment records" />
        <Card
          icon={<CalendarClock className="h-4 w-4 text-[#F59E0B]" />}
          label="Next billing"
          value={renews ? fmtDate(renews) : "—"}
          hint={renews ? "Upcoming renewal, not yet charged" : scheduled ? "Won't renew" : "No renewal scheduled"}
        />
        <Card icon={<CheckCircle2 className="h-4 w-4 text-[#22C55E]" />} label="Successful payments" value={String(paid.length)} hint={`${txs.length - paid.length} not completed`} />
      </div>

      <TransactionHistory transactions={txs} />
    </div>
  );
}

function Card({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[#253244] bg-[#101824] p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#253244] bg-[#0A111B]">{icon}</span>
      <p className="mt-3 truncate text-xl font-semibold tabular-nums text-[#F8FAFC]">{value}</p>
      <p className="text-xs text-[#cbd5e1]">{label}</p>
      <p className="mt-0.5 truncate text-[11px] text-[#64748B]">{hint}</p>
    </div>
  );
}
