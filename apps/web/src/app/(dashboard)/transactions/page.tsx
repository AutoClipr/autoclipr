import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { TransactionHistory } from "@/components/billing/transaction-history";
import type { Transaction } from "@/app/(dashboard)/subscription/page";

export const metadata = { title: "Transaction history" };

export default async function TransactionsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await apiFetch<Transaction[]>("/api/v1/billing/transactions", {
    token: session!.access_token,
  });

  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Transaction history</h1>
        <p className="mt-1 text-sm text-white/50">Your payments and invoices.</p>
      </div>
      <TransactionHistory transactions={res.data ?? []} />
    </div>
  );
}
