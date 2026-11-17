import { apiFetch, type Video } from "@/lib/api";
import type { CreditTransaction } from "@/components/billing/credit-history";
import { resolveVideoTitle } from "@/lib/video-title";

export type CreditUsageRow = {
  id: string;
  created_at: string;
  amount: number;
  /** Video name, or a readable reason when there is no video. */
  detail: string;
  /** Short tag, e.g. "Clip project". */
  usage: string;
};

const REASON_LABELS: Record<string, string> = {
  clip_generation: "Clip generation",
  url_import_pipeline: "Video import & clipping",
};

/** Credit history with each row named after the video it was spent on. */
export async function getCreditUsageRows(token: string): Promise<CreditUsageRow[]> {
  const [historyRes, videosRes] = await Promise.all([
    apiFetch<CreditTransaction[]>("/api/v1/users/me/credit-history", { token }),
    apiFetch<Video[]>("/api/v1/videos?limit=200", { token }),
  ]);
  const history = historyRes.data ?? [];
  const usedIds = new Set(history.map((r) => r.reference_id));
  const videos = (videosRes.data ?? []).filter((v) => usedIds.has(v.id));
  const titles = new Map(
    await Promise.all(videos.map(async (v) => [v.id, await resolveVideoTitle(v)] as const)),
  );

  return history.map((tx) => ({
    id: tx.id,
    created_at: tx.created_at,
    amount: tx.amount,
    detail:
      (tx.reference_id && titles.get(tx.reference_id)) ||
      REASON_LABELS[tx.reason] ||
      tx.reason.replace(/_/g, " "),
    usage: tx.reference_id ? "Clip project" : tx.amount < 0 ? "Usage" : "Credits added",
  }));
}
