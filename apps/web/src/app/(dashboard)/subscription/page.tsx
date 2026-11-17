import { Zap } from "lucide-react";
import { UpgradeButton } from "@/components/billing/pricing-modal";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { CreditUsageTable } from "@/components/billing/credit-usage-table";
import { CancelSubscriptionButton, CancellationScheduled } from "@/components/billing/cancel-subscription";
import { getCreditUsageRows } from "@/lib/credit-usage";

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

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const [billingRes, txRes, creditRows] = await Promise.all([
    apiFetch<BillingData>("/api/v1/billing/subscription", { token: session!.access_token }),
    apiFetch<Transaction[]>("/api/v1/billing/transactions", { token: session!.access_token }),
    getCreditUsageRows(session!.access_token),
  ]);

  const billing = billingRes.data;
  const tier = billing?.profile?.subscription_tier ?? "free";
  const credits = billing?.credits ?? 10;
  const planId = billing?.subscription?.plan_id ?? "free";
  const maxCredits = planId === "business" ? 1200 : planId === "creator" ? 500 : 30;
  const transactions = txRes.data ?? [];

  const email = session?.user?.email ?? "";
  const planName = `${planId.charAt(0).toUpperCase()}${planId.slice(1)} plan`;
  const periodEnd = billing?.subscription?.current_period_end;
  const lastPayment = transactions[0];
  const status = billing?.subscription?.status ?? "active";
  const isPaid = planId === "creator" || planId === "business";
  const scheduled = !!billing?.subscription?.cancel_at_period_end;
  const accessUntil = billing?.subscription?.cancellation_effective_at ?? periodEnd ?? null;
  // Dodo's statuses, shown with our own labels.
  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-lime-400/15 text-lime-300" },
    pending: { label: "Pending", cls: "bg-white/10 text-white/70" },
    on_hold: { label: "Payment failed", cls: "bg-rose-500/15 text-rose-300" },
    failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-300" },
    paused: { label: "Paused", cls: "bg-white/10 text-white/70" },
    cancelled: { label: "Cancelled", cls: "bg-white/10 text-white/60" },
    expired: { label: "Expired", cls: "bg-white/10 text-white/60" },
  };
  const badge = scheduled
    ? { label: "Cancellation pending", cls: "bg-amber-400/15 text-amber-300" }
    : (STATUS_BADGE[status] ?? STATUS_BADGE.active);
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="relative mx-auto max-w-4xl space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Subscription</h1>
        <p className="mt-1 text-sm text-white/50">Manage your subscription plan and credit balance.</p>
      </div>

      {/* Plan + details */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur">
        <div className="flex items-center justify-between gap-4 rounded-[1.25rem] px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-white">{planName}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
            </div>
            <p className="truncate text-xs text-white/45">{email}</p>
          </div>
          <UpgradeButton
            credits={credits}
            className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-[0_0_20px_-4px_rgba(255,255,255,0.55)] transition-transform hover:scale-[1.02]"
          >
            {tier === "business" ? "Change plan" : "Upgrade"}
          </UpgradeButton>
        </div>

        {scheduled && <CancellationScheduled accessUntilLabel={accessUntil ? fmt(accessUntil) : null} />}

        <div className="grid gap-1.5 md:grid-cols-2">
          {/* Credits & features */}
          <div className="rounded-[1.25rem] border border-white/[0.06] bg-white/[0.03]">
            <p className="border-b border-white/[0.06] px-4 py-3.5 font-semibold text-white">Credits &amp; features</p>
            <div className="space-y-2.5 px-4 py-4 text-sm">
              <Row label="Current balance" strong>
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                  <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {credits}
                </span>
              </Row>
              <Row label="Plan credits">{maxCredits}</Row>
              <div className="pt-1">
                <Progress value={Math.min(100, (credits / maxCredits) * 100)} />
              </div>
            </div>
            <div className="mx-3 mb-3 flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2.5 text-sm">
              <span className="text-white/50">Credits expiration date</span>
              <span className="text-white/80">{periodEnd ? fmt(periodEnd) : "Never"}</span>
            </div>
          </div>

          {/* Billing & payment */}
          <div className="flex flex-col rounded-[1.25rem] border border-white/[0.06] bg-white/[0.03]">
            <p className="border-b border-white/[0.06] px-4 py-3.5 font-semibold text-white">Billing &amp; payment</p>
            <div className="space-y-2.5 px-4 py-4 text-sm">
              <Row label="Next cycle credits">{scheduled ? "None" : `${maxCredits} per month`}</Row>
              <Row label={scheduled ? "Access until" : "Renew date"}>
                {(scheduled ? accessUntil : periodEnd) ? fmt((scheduled ? accessUntil : periodEnd)!) : "—"}
              </Row>
              {lastPayment && (
                <Row label="Last payment">
                  {lastPayment.amount} · {fmt(lastPayment.payment_date)}
                </Row>
              )}
            </div>
            {!lastPayment && (
              <p className="mt-auto pb-5 text-center text-xs text-white/35">No billing information</p>
            )}
            {isPaid && status === "active" && !scheduled && (
              <div className="mt-auto border-t border-white/[0.06] px-4 py-3 text-right">
                <CancelSubscriptionButton planName={planName} accessUntilLabel={periodEnd ? fmt(periodEnd) : null} />
              </div>
            )}
          </div>
        </div>
      </div>

      <CreditUsageTable rows={creditRows} />

    </div>
  );
}

function Row({ label, strong, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-medium text-white/85" : "text-white/50"}>{label}</span>
      <span className="text-white/70">{children}</span>
    </div>
  );
}
