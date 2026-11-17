import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type Video } from "@/lib/api";
import type { CreditTransaction } from "@/components/billing/credit-history";
import { resolveVideoTitle } from "@/lib/video-title";

export const metadata = { title: "Credit usage history" };

const REASON_LABELS: Record<string, string> = {
  clip_generation: "Clip generation",
  url_import_pipeline: "Video import & clipping",
};

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

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session!.access_token;

  const [historyRes, videosRes] = await Promise.all([
    apiFetch<CreditTransaction[]>("/api/v1/users/me/credit-history", { token }),
    apiFetch<Video[]>("/api/v1/videos?limit=200", { token }),
  ]);

  const rows = historyRes.data ?? [];
  // Credit rows point at the video they were spent on — show its title.
  const usedIds = new Set(rows.map((r) => r.reference_id));
  const videos = (videosRes.data ?? []).filter((v) => usedIds.has(v.id));
  const titles = new Map(
    await Promise.all(videos.map(async (v) => [v.id, await resolveVideoTitle(v)] as const)),
  );

  return (
    <div className="relative mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Credit usage history</h1>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <Zap className="mx-auto mb-3 h-6 w-6 text-white/25" />
          <p className="text-sm text-white/50">No credit activity yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          {rows.map((tx) => {
            const spent = tx.amount < 0;
            const detail =
              (tx.reference_id && titles.get(tx.reference_id)) ||
              REASON_LABELS[tx.reason] ||
              tx.reason.replace(/_/g, " ");
            const type = tx.reference_id ? "Clip project" : spent ? "Usage" : "Credits added";
            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-3 last:border-b-0 hover:bg-white/[0.02] sm:gap-4 sm:px-4"
              >
                <span className="hidden shrink-0 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] tabular-nums text-white/55 sm:inline">
                  {fmtDate(tx.created_at)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/90">{detail}</p>
                  <p className="text-[11px] text-white/40 sm:hidden">{fmtDate(tx.created_at)}</p>
                </div>
                <span className="hidden shrink-0 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-white/55 md:inline">
                  {type}
                </span>
                <span
                  className={`flex w-16 shrink-0 items-center justify-end gap-1 text-sm font-semibold tabular-nums ${
                    spent ? "text-white/85" : "text-emerald-300"
                  }`}
                >
                  {spent ? "−" : "+"}
                  <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {Math.abs(tx.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
