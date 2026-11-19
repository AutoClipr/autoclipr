import { Check, Minus } from "lucide-react";

type Cell = boolean | string;

/**
 * Plan comparison. Only lists what the app actually enforces or ships today:
 * credits match the subscription_plans table, scheduling is
 * gated to paid plans (lib/scheduler hasSchedulerAccess), and captions / 9:16
 * export / AI moment detection run for every plan.
 */
const ROWS: { feature: string; cells: [Cell, Cell, Cell] }[] = [
  { feature: "Credits per month", cells: ["30", "500", "1,200"] },
  { feature: "AI viral moment detection", cells: [true, true, true] },
  { feature: "Animated caption styles", cells: [true, true, true] },
  { feature: "Vertical 9:16 export", cells: [true, true, true] },
  { feature: "Import from YouTube, Vimeo, Loom, Drive or upload", cells: [true, true, true] },
  { feature: "Post to YouTube Shorts & Instagram Reels", cells: [true, true, true] },
  { feature: "Content scheduling", cells: [false, true, true] },
  { feature: "Priority support", cells: [false, true, true] },
];

const PLANS = ["Starter", "Creator", "Business"] as const;

function Value({ v }: { v: Cell }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-[#54D045]" aria-label="Included" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-[#475569]" aria-label="Not included" />;
  return <span className="font-semibold tabular-nums text-[#F8FAFC]">{v}</span>;
}

export function PlanComparison() {
  return (
    <section className="relative mx-auto max-w-4xl px-4 pb-16 sm:px-6" aria-labelledby="compare-title">
      <div className="mb-6 text-center">
        <h2 id="compare-title" className="text-2xl font-bold tracking-tight text-[#F8FAFC] sm:text-3xl">
          Compare plans
        </h2>
        <p className="mt-2 text-sm text-[#94A3B8]">Every plan includes the core AI clipping tools. Paid plans add more credits and scheduling.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#253244] bg-[#101824]">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[#253244]">
              <th scope="col" className="px-5 py-3.5 text-left font-medium text-[#94A3B8]">Feature</th>
              {PLANS.map((p) => (
                <th
                  key={p}
                  scope="col"
                  className={`px-4 py-3.5 text-center font-semibold ${p === "Creator" ? "bg-[#54D045]/[0.06] text-[#a6ec9c]" : "text-[#F8FAFC]"}`}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#253244]/60">
            {ROWS.map((r) => (
              <tr key={r.feature}>
                <th scope="row" className="px-5 py-3 text-left font-normal text-[#cbd5e1]">
                  {r.feature}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className={`px-4 py-3 text-center ${i === 1 ? "bg-[#54D045]/[0.04]" : ""}`}>
                    <Value v={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
