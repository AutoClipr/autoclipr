"use client";

import { useState } from "react";
import { Download, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Transaction } from "@/app/(dashboard)/subscription/page";

const PAGE_SIZE = 10;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const filtered = transactions.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur">
      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <Receipt className="h-8 w-8 opacity-30" />
          <p className="text-sm">No transactions yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Invoice</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Next Billing</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, i) => {
                const date = new Date(tx.payment_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const nextBilling = tx.period_end
                  ? new Date(tx.period_end).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";
                const downloadUrl = `${API_URL}/api/v1/billing/invoice/download?invoiceNumber=${encodeURIComponent(tx.invoice_number)}&plan=${encodeURIComponent(tx.plan_id.charAt(0).toUpperCase() + tx.plan_id.slice(1))}&amount=${encodeURIComponent(tx.amount)}&date=${encodeURIComponent(date)}${tx.transaction_id ? `&txId=${encodeURIComponent(tx.transaction_id)}` : ""}`;

                return (
                  <tr
                    key={tx.id}
                    className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${i === filtered.length - 1 ? "border-0" : ""}`}
                  >
                    <td className="px-6 py-4 font-mono text-xs text-white/70">
                      #{tx.invoice_number}
                    </td>
                    <td className="px-6 py-4 capitalize font-medium">
                      {tx.plan_id}
                      {tx.billing_period && (
                        <span className="ml-1.5 text-[10px] text-white/30 capitalize">
                          · {tx.billing_period}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-400">{tx.amount}</td>
                    <td className="px-6 py-4 text-muted-foreground">{date}</td>
                    <td className="px-6 py-4 text-muted-foreground">{nextBilling}</td>
                    <td className="px-6 py-4">
                      <Badge variant="success" className="text-xs">
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                      >
                        <Download className="h-3 w-3" />
                        PDF
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 sm:px-6">
          <p className="text-xs text-white/45">
            Page {current} of {totalPages}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="Previous page"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={current === totalPages}
              onClick={() => setPage(current + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
