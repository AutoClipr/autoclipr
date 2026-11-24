import { Check, Clock, Minus } from "lucide-react";
import { FALLBACK_PLANS, LIVE_PUBLISH_PLATFORMS, formatMinutes, planExtras, type PlanNumbers } from "@/lib/plans";

type Cell = boolean | string | "soon";
type Row = { feature: string; hint?: string; cell: (p: PlanNumbers) => Cell };

/**
 * Plan comparison. Every row is derived from the plan data the API serves
 * (credits, limits, watermark, scheduling, analytics), so the table can't
 * drift from what the backend enforces. Unbuilt items show "Soon".
 */
const ROWS: Row[] = [
  { feature: "Monthly credits", cell: (p) => p.credits_per_month.toLocaleString("en-IN") },
  { feature: "Estimated clips per month", hint: "Depends on video length and settings", cell: (p) => `${p.estimated_clips[0]}–${p.estimated_clips[1]}` },
  { feature: "Maximum source video length", cell: (p) => formatMinutes(p.max_video_seconds) },
  { feature: "AI viral moment detection", cell: () => true },
  { feature: "AI clip scoring", cell: (p) => p.price_cents > 0 },
  { feature: "Auto captions & subtitles (15 styles)", cell: () => true },
  { feature: "Vertical 9:16 export", cell: () => true },
  { feature: "16:9, 1:1 & 4:5 export", cell: (p) => planExtras(p.id).allRatios },
  { feature: "Fill & Fit layouts", cell: () => true },
  { feature: "Upload your own SRT subtitles", cell: () => true },
  { feature: "Brand kits", hint: "Logo, colours, captions, intro & outro", cell: (p) => (planExtras(p.id).brandKits ? `Up to ${planExtras(p.id).brandKits}` : false) },
  { feature: "AI hooks & headlines", hint: "Animated opening hooks and title styles", cell: (p) => ({ none: false, basic: "7 hooks + 4 headlines", all: "19 hooks + 4 headlines" } as const)[planExtras(p.id).hooks] },
  { feature: "AI emojis", cell: () => true },
  { feature: "Caption translation", hint: "11 languages", cell: () => true },
  { feature: "Speech cleanup", hint: "Removes filler words and long pauses", cell: (p) => planExtras(p.id).enhancements === "all" },
  { feature: "Auto zoom, transitions & colour correction", cell: (p) => planExtras(p.id).enhancements === "all" },
  { feature: "Enhance audio", hint: "6 credits / min", cell: (p) => planExtras(p.id).enhancements === "all" },
  { feature: "Motion graphics", hint: "6 credits / min", cell: (p) => planExtras(p.id).enhancements === "all" },
  { feature: "Auto sound effects", hint: "7 credits / min", cell: (p) => planExtras(p.id).enhancements === "all" },
  { feature: "AI voice dubbing", hint: "10 credits / min, 11 languages", cell: (p) => planExtras(p.id).enhancements === "all" },
  { feature: "Eye contact correction", cell: () => "soon" },
  { feature: "Publish to YouTube Shorts & Instagram Reels", cell: (p) => LIVE_PUBLISH_PLATFORMS.every((x) => p.platforms.includes(x)) },
  { feature: "TikTok, Facebook, LinkedIn, X & Threads", cell: (p) => p.platforms.length > LIVE_PUBLISH_PLATFORMS.length },
  { feature: "Content scheduling for all social media platforms", cell: (p) => p.scheduling },
  { feature: "Analytics & performance tracking", cell: (p) => p.analytics },
  { feature: "Watermark-free exports", cell: (p) => !p.watermark },
  { feature: "Support", cell: (p) => (p.price_cents === 0 ? false : p.id === "creator" ? "Email & chat" : "Email + 24/7 live chat") },
];

const HIGHLIGHT = "pro";

function Value({ v }: { v: Cell }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-[#54D045]" aria-label="Included" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-[#475569]" aria-label="Not included" />;
  if (v === "soon")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#94A3B8]">
        <Clock className="h-3.5 w-3.5" aria-hidden /> Soon
      </span>
    );
  return <span className="font-semibold tabular-nums text-[#F8FAFC]">{v}</span>;
}

export function PlanComparison({ plans = FALLBACK_PLANS }: { plans?: PlanNumbers[] }) {
  return (
    <section className="relative mx-auto max-w-5xl px-4 pb-16 sm:px-6" aria-labelledby="compare-title">
      <div className="mb-6 text-center">
        <h2 id="compare-title" className="text-2xl font-bold tracking-tight text-[#F8FAFC] sm:text-3xl">
          Compare all plans
        </h2>
        <p className="mt-2 text-sm text-[#94A3B8]">Everything you need to create, publish, and grow your content.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#253244] bg-[#101824]">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="sticky top-0 bg-[#101824]">
            <tr className="border-b border-[#253244]">
              <th scope="col" className="px-5 py-3.5 text-left font-medium text-[#94A3B8]">Feature</th>
              {plans.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className={`px-4 py-3.5 text-center font-semibold ${p.id === HIGHLIGHT ? "bg-[#54D045]/[0.07] text-[#a6ec9c]" : "text-[#F8FAFC]"}`}
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#253244]/60">
            {ROWS.map((r) => (
              <tr key={r.feature}>
                <th scope="row" className="px-5 py-3 text-left font-normal text-[#cbd5e1]">
                  {r.feature}
                  {r.hint && <span className="block text-[11px] text-[#64748B]">{r.hint}</span>}
                </th>
                {plans.map((p) => (
                  <td key={p.id} className={`px-4 py-3 text-center ${p.id === HIGHLIGHT ? "bg-[#54D045]/[0.04]" : ""}`}>
                    <Value v={r.cell(p)} />
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
