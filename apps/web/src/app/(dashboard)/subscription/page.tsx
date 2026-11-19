import Link from "next/link";
import { ArrowUpRight, CalendarDays, CreditCard, Download, Mail, Receipt, Zap } from "lucide-react";
import { UpgradeButton } from "@/components/billing/pricing-modal";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { CreditUsageTable } from "@/components/billing/credit-usage-table";
import { CancelSubscriptionButton, CancellationScheduled } from "@/components/billing/cancel-subscription";
import { getCreditUsageRows } from "@/lib/credit-usage";
import { cn } from "@/lib/utils";

export const metadata = { title: "Subscription" };

type BillingData = {
  profile: { credits: number; subscription_tier: string };
  subscription: {
    plan_id: string;
    status: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    cancellation_effective_at?: string | null;
  } | null;
  credits: number;
};

export type Transaction = {
  id: string;
  invoice_number: string;
  plan_id: string;
  amount: string;
  status: string;
  transaction_id: string | null;
  payment_date: string;
  period_end: string | null;
  billing_period: string | null;
};

type Plan = { id: string; name: string; price_cents: number; credits_per_month: number };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Subscription status from the payment provider, with our labels and colours. */
const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "border-[#22C55E]/35 bg-[#22C55E]/10 text-[#86efac]" },
  trialing: { label: "Trial", cls: "border-[#35D6E8]/35 bg-[#35D6E8]/10 text-[#9beef7]" },
  pending: { label: "Pending", cls: "border-[#253244] bg-[#131D2B] text-[#cbd5e1]" },
  on_hold: { label: "Payment failed", cls: "border-[#EF4444]/35 bg-[#EF4444]/10 text-[#fca5a5]" },
  failed: { label: "Payment failed", cls: "border-[#EF4444]/35 bg-[#EF4444]/10 text-[#fca5a5]" },
  paused: { label: "Paused", cls: "border-[#253244] bg-[#131D2B] text-[#cbd5e1]" },
  cancelled: { label: "Cancelled", cls: "border-[#253244] bg-[#131D2B] text-[#94A3B8]" },
  expired: { label: "Expired", cls: "border-[#253244] bg-[#131D2B] text-[#94A3B8]" },
};
const CANCEL_PENDING = { label: "Cancellation pending", cls: "border-[#F59E0B]/35 bg-[#F59E0B]/10 text-amber-200" };

const PAYMENT_STATUS: Record<string, string> = {
  paid: "text-[#86efac]",
  succeeded: "text-[#86efac]",
  pending: "text-amber-200",
  failed: "text-[#fca5a5]",
  refunded: "text-[#9beef7]",
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session!.access_token;

  const [billingRes, txRes, plansRes, creditRows] = await Promise.all([
    apiFetch<BillingData>("/api/v1/billing/subscription", { token }),
    apiFetch<Transaction[]>("/api/v1/billing/transactions", { token }),
    apiFetch<Plan[]>("/api/v1/plans", { token }),
    getCreditUsageRows(token),
  ]);

  const header = (
    <header className="mb-6">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">ACCOUNT &amp; BILLING</p>
      <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[#F8FAFC]">Subscription &amp; Billing</h1>
      <p className="mt-1 text-sm text-[#94A3B8]">Manage your plan, credits, payments, and subscription.</p>
    </header>
  );

  if (!billingRes.success || !billingRes.data) {
    return (
      <div className="mx-auto max-w-5xl">
        {header}
        <div className="rounded-2xl border border-[#EF4444]/25 bg-[#EF4444]/[0.05] px-6 py-12 text-center">
          <p className="font-medium text-[#F8FAFC]">We couldn&apos;t load your billing details</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Please refresh the page. If this keeps happening, contact support.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/subscription" className="inline-flex h-9 items-center rounded-lg bg-[#F8FAFC] px-4 text-sm font-semibold text-[#070B12]">
              Retry
            </Link>
            <Link href="/contact" className="inline-flex h-9 items-center rounded-lg border border-[#253244] px-4 text-sm text-[#F8FAFC]">
              Contact support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const billing = billingRes.data;
  const plans = plansRes.data ?? [];
  const sub = billing.subscription;
  const credits = billing.credits;
  const tier = billing.profile?.subscription_tier ?? "free";
  const planId = sub?.plan_id ?? (tier === "free" ? "starter" : tier);
  const plan = plans.find((p) => p.id === planId) ?? plans.find((p) => p.id === "starter");
  const planCredits = plan?.credits_per_month ?? null;
  const planName = plan?.name ?? `${planId.charAt(0).toUpperCase()}${planId.slice(1)}`;
  const isPaid = !!plan && plan.price_cents > 0;

  const transactions = txRes.data ?? [];
  const lastPayment = transactions[0];
  const email = session?.user?.email ?? "";
  const status = sub?.status ?? (isPaid ? "active" : null);
  const scheduled = !!sub?.cancel_at_period_end;
  const periodEnd = sub?.current_period_end ?? null;
  const accessUntil = sub?.cancellation_effective_at ?? periodEnd;
  const badge = scheduled ? CANCEL_PENDING : status ? (STATUS[status] ?? STATUS.active) : null;
  const billingCycle = lastPayment?.billing_period
    ? lastPayment.billing_period.charAt(0).toUpperCase() + lastPayment.billing_period.slice(1)
    : isPaid
      ? "Monthly"
      : null;
  // Only draw a usage bar when the balance fits inside the plan allowance; bonus or
  // carried-over credits would make a percentage misleading.
  const showBar = planCredits != null && planCredits > 0 && credits <= planCredits;

  return (
    <div className="relative mx-auto max-w-5xl space-y-5">
      {header}

      {/* Overview */}
      <section className="relative overflow-hidden rounded-2xl border border-[#253244] bg-gradient-to-br from-[#101824] to-[#0B1220]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#54D045]/[0.10] blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#94A3B8]">Current plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold text-[#F8FAFC]">{planName}</h2>
              {badge && (
                <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", badge.cls)}>{badge.label}</span>
              )}
            </div>
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Meta icon={Mail} label="Billing email" value={email || "—"} />
              {billingCycle && <Meta icon={CalendarDays} label="Billing cycle" value={billingCycle} />}
              {isPaid && !scheduled && periodEnd && <Meta icon={CreditCard} label="Next billing" value={fmt(periodEnd)} />}
              {scheduled && accessUntil && <Meta icon={CalendarDays} label="Access until" value={fmt(accessUntil)} />}
            </dl>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <UpgradeButton
              credits={credits}
              className="inline-flex h-10 items-center rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] shadow-[0_10px_30px_-12px_rgba(84,208,69,0.7)] hover:bg-[#62dc53]"
            >
              {tier === "business" ? "Change plan" : "Upgrade plan"}
            </UpgradeButton>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-[#253244] px-3 text-sm font-medium text-[#F8FAFC] hover:bg-white/[0.04]"
            >
              View pricing <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        {scheduled && (
          <div className="relative px-1.5 pb-1.5">
            <CancellationScheduled accessUntilLabel={accessUntil ? fmt(accessUntil) : null} />
          </div>
        )}
        {(status === "on_hold" || status === "failed") && !scheduled && (
          <div className="relative mx-5 mb-5 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/[0.08] px-4 py-3 text-sm text-[#fca5a5] sm:mx-6">
            Your last payment didn&apos;t go through. Update your payment method with the payment provider to keep your plan active.
          </div>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Credits */}
        <section className="flex flex-col rounded-2xl border border-[#253244] bg-[#101824] p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#F8FAFC]">Credits</h2>
          <div className="mt-4 flex items-end gap-2">
            <Zap className="mb-1.5 h-6 w-6 fill-[#54D045] text-[#54D045]" />
            <span className="text-4xl font-bold tabular-nums text-[#F8FAFC]">{credits.toLocaleString()}</span>
            <span className="mb-1.5 text-sm text-[#94A3B8]">available</span>
          </div>
          {showBar && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-[#0A111B]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#54D045] to-[#35D6E8]"
                  style={{ width: `${Math.max(2, Math.round((credits / planCredits!) * 100))}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-[#94A3B8]">
                {credits.toLocaleString()} of {planCredits!.toLocaleString()} plan credits left
              </p>
            </div>
          )}
          <dl className="mt-5 space-y-2.5 text-sm">
            <Row label="Plan includes">{planCredits != null ? `${planCredits.toLocaleString()} credits / month` : "—"}</Row>
            <Row label="Next cycle credits">
              {!isPaid ? "—" : scheduled ? "None — plan ends" : planCredits != null ? planCredits.toLocaleString() : "—"}
            </Row>
            <Row label="Credits expire">{isPaid && periodEnd ? fmt(periodEnd) : "Never"}</Row>
          </dl>
          <div className="mt-auto pt-5">
            <UpgradeButton
              credits={credits}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-[#54D045]/40 bg-[#54D045]/10 text-sm font-semibold text-[#a6ec9c] hover:bg-[#54D045]/20"
            >
              <Zap className="h-4 w-4" /> Get more credits
            </UpgradeButton>
          </div>
        </section>

        {/* Billing */}
        <section className="flex flex-col rounded-2xl border border-[#253244] bg-[#101824] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#F8FAFC]">Billing &amp; payment</h2>
            {transactions.length > 0 && (
              <Link href="/transactions" className="text-xs font-medium text-[#8fe383] hover:underline">
                All payments →
              </Link>
            )}
          </div>
          {lastPayment ? (
            <>
              <div className="mt-4 rounded-xl border border-[#253244] bg-[#0A111B] p-4">
                <p className="text-xs text-[#94A3B8]">Last payment</p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="text-2xl font-semibold tabular-nums text-[#F8FAFC]">{lastPayment.amount}</span>
                  <span className={cn("text-xs font-semibold capitalize", PAYMENT_STATUS[lastPayment.status] ?? "text-[#cbd5e1]")}>
                    {lastPayment.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#94A3B8]">
                  {fmt(lastPayment.payment_date)} · Invoice {lastPayment.invoice_number}
                </p>
              </div>
              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label={scheduled ? "Access until" : "Next billing date"}>
                  {(scheduled ? accessUntil : periodEnd) ? fmt((scheduled ? accessUntil : periodEnd)!) : "—"}
                </Row>
                <Row label="Plan">{planName}</Row>
              </dl>
              <a
                href={invoiceUrl(lastPayment)}
                className="mt-4 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-[#8fe383] hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Download receipt
              </a>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <Receipt className="h-7 w-7 text-[#253244]" />
              <p className="mt-2 text-sm text-[#94A3B8]">No payments yet</p>
              <p className="text-xs text-[#64748B]">Payments for paid plans will appear here.</p>
            </div>
          )}
          {isPaid && (status === "active" || status === "trialing") && !scheduled && (
            <div className="mt-auto border-t border-[#253244] pt-4 text-right">
              <CancelSubscriptionButton planName={planName} accessUntilLabel={periodEnd ? fmt(periodEnd) : null} />
            </div>
          )}
        </section>
      </div>

      <CreditUsageTable rows={creditRows} />
    </div>
  );
}

function invoiceUrl(tx: Transaction) {
  const plan = tx.plan_id.charAt(0).toUpperCase() + tx.plan_id.slice(1);
  const q = new URLSearchParams({
    invoiceNumber: tx.invoice_number,
    plan,
    amount: tx.amount,
    date: new Date(tx.payment_date).toLocaleDateString("en-IN"),
  });
  if (tx.transaction_id) q.set("txId", tx.transaction_id);
  return `${API_URL}/api/v1/billing/invoice/download?${q}`;
}

function Meta({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-[#64748B]" />
      <dt className="text-[#94A3B8]">{label}:</dt>
      <dd className="truncate text-[#F8FAFC]">{value}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#94A3B8]">{label}</dt>
      <dd className="text-right font-medium text-[#F8FAFC]">{children}</dd>
    </div>
  );
}
