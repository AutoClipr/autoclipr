"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CreditUsageRow } from "@/lib/credit-usage";

const PAGE_SIZES = [10, 25, 50];

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

/** Credit usage table: Date · Usage · Details · Status · Credits, paged. */
export function CreditUsageTable({ rows }: { rows: CreditUsageRow[] }) {
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, totalPages);
  const visible = rows.slice((current - 1) * size, current * size);

  const navBtn =
    "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur">
      <div className="flex min-h-[22rem] flex-col rounded-[1.25rem] border border-white/[0.06] bg-white/[0.02]">
        <p className="border-b border-white/[0.06] px-4 py-4 text-lg font-semibold text-white">Credit usage history</p>

        <div className="flex-1 overflow-x-auto px-4 pt-2">
          {rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/40">No credit activity yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/45">
                  <th className="py-3 pr-4 font-normal">Date</th>
                  <th className="py-3 pr-4 font-normal">Usage</th>
                  <th className="w-full py-3 pr-4 font-normal">Details</th>
                  <th className="py-3 pr-4 font-normal">Status</th>
                  <th className="py-3 text-right font-normal">Credits</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap py-2 pr-4">
                      <span className="rounded-md bg-white/[0.07] px-1.5 py-1 text-xs tabular-nums text-white/80">
                        {fmtDate(r.created_at)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      <span className="rounded-md bg-white/[0.07] px-1.5 py-1 text-xs text-white/80">{r.usage}</span>
                    </td>
                    <td className="max-w-0 py-2 pr-4">
                      <p className="truncate text-white/90">{r.detail}</p>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-white/80">{r.amount < 0 ? "Used" : "Added"}</td>
                    <td
                      className={`whitespace-nowrap py-2 text-right tabular-nums ${r.amount < 0 ? "text-white/85" : "text-emerald-300"}`}
                    >
                      {r.amount > 0 ? `+${r.amount}` : r.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <label className="relative flex items-center rounded-lg bg-white/[0.07] text-sm text-white/60">
            <span className="pl-2.5">Show</span>
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(1);
              }}
              className="cursor-pointer appearance-none bg-transparent py-1.5 pl-1.5 pr-7 font-semibold text-white outline-none"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n} className="bg-zinc-900">
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5" />
          </label>
          <p className="text-xs text-white/45">
            Page {current} of {totalPages}
          </p>
          <div className="flex gap-1.5">
            <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)} className={navBtn}>
              <ChevronUp className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Next page" disabled={current === totalPages} onClick={() => setPage(current + 1)} className={navBtn}>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
