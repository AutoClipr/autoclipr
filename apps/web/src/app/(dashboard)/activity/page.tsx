import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Gift, Hash, RotateCcw, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type Profile } from "@/lib/api";
import { getCreditUsageRows } from "@/lib/credit-usage";
import { CreditUsageTable } from "@/components/billing/credit-usage-table";

export const metadata = { title: "Credit activity" };

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session!.access_token;

  const [profileRes, rows] = await Promise.all([
    apiFetch<Profile>("/api/v1/users/me", { token }),
    getCreditUsageRows(token),
  ]);

  // Balance comes from the wallet (profile), never from summing history rows.
  const balance = profileRes.success && profileRes.data ? profileRes.data.credits : null;

  const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred).reduce((s, r) => s + Math.abs(r.amount), 0);
  const used = sum((r) => r.kind === "used");
  const refunded = sum((r) => r.kind === "refund");
  const added = sum((r) => r.kind === "added" || r.kind === "bonus");

  // Where credits go: net of refunds per activity, from real ledger rows only.
  const byActivity = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== "used") continue;
    byActivity.set(r.activity, (byActivity.get(r.activity) ?? 0) + Math.abs(r.amount));
  }
  const breakdown = [...byActivity.entries()].sort((a, b) => b[1] - a[1]);
  const breakdownMax = Math.max(1, ...breakdown.map(([, v]) => v));

  return (
    <div className="relative mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">ACCOUNT ACTIVITY</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[#F8FAFC]">Credit activity.</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">Track your credit usage, refunds, bonuses and transaction history.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/activity"
            className="inline-flex h-10 items-center rounded-lg border border-[#253244] bg-[#101824] px-3 text-sm text-[#F8FAFC] hover:border-[#35445a]"
          >
            Refresh
          </Link>
          <Link
            href="/subscription"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]"
          >
            <Zap className="h-4 w-4" /> Add credits
          </Link>
        </div>
      </header>

      {/* Balance + summary */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <section className="relative overflow-hidden rounded-2xl border border-[#54D045]/30 bg-gradient-to-br from-[#14271F] to-[#101824] p-5">
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#54D045]/15 blur-3xl" aria-hidden />
          <p className="relative text-xs font-medium text-[#94A3B8]">Available credits</p>
          {balance != null ? (
            <p className="relative mt-1 flex items-center gap-2 text-4xl font-bold tabular-nums text-[#F8FAFC]">
              <Zap className="h-7 w-7 fill-[#54D045] text-[#54D045]" />
              {balance.toLocaleString()}
            </p>
          ) : (
            <p className="relative mt-2 text-sm text-[#fca5a5]">Couldn&apos;t load your balance. Refresh to try again.</p>
          )}
          <Link href="/subscription" className="relative mt-4 inline-block text-xs font-medium text-[#8fe383] hover:underline">
            Manage credits →
          </Link>
        </section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Summary icon={<ArrowDownRight className="h-4 w-4 text-[#cbd5e1]" />} label="Credits used" value={used} />
          <Summary icon={<RotateCcw className="h-4 w-4 text-[#35D6E8]" />} label="Refunded" value={refunded} tone="text-[#9beef7]" />
          <Summary icon={<ArrowUpRight className="h-4 w-4 text-[#22C55E]" />} label="Added & bonuses" value={added} tone="text-[#86efac]" />
          <Summary icon={<Hash className="h-4 w-4 text-[#94A3B8]" />} label="Transactions" value={rows.length} />
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-[#64748B]">
        Totals cover the transactions listed below. Plan credits added at purchase or renewal set your balance directly and aren&apos;t listed as transactions.
      </p>

      {/* Breakdown */}
      <section className="rounded-2xl border border-[#253244] bg-[#101824] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Where your credits go</h2>
        <p className="mt-0.5 text-sm text-[#94A3B8]">Credits spent per operation, before refunds.</p>
        {breakdown.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#94A3B8]">No credits spent yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {breakdown.map(([name, value]) => (
              <li key={name}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-[#cbd5e1]">{name}</span>
                  <span className="tabular-nums text-[#F8FAFC]">
                    {value.toLocaleString()} <span className="text-xs text-[#64748B]">· {Math.round((value / used) * 100)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#0A111B]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#54D045] to-[#35D6E8]" style={{ width: `${Math.max(2, (value / breakdownMax) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreditUsageTable rows={rows} exportable />

      {refunded > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
          <Gift className="h-3 w-3" /> Refunds are added automatically when a processing job fails.
        </p>
      )}
    </div>
  );
}

function Summary({ icon, label, value, tone = "text-[#F8FAFC]" }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[#253244] bg-[#101824] p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#253244] bg-[#0A111B]">{icon}</span>
      <p className={`mt-3 text-2xl font-semibold tabular-nums ${tone}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-[#94A3B8]">{label}</p>
    </div>
  );
}
