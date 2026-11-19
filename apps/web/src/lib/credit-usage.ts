import { apiFetch, type Video } from "@/lib/api";
import type { CreditTransaction } from "@/components/billing/credit-history";
import { resolveVideoTitle } from "@/lib/video-title";

export type CreditKind = "used" | "refund" | "bonus" | "added";

export type CreditUsageRow = {
  id: string;
  created_at: string;
  amount: number;
  /** Video name, or a readable reason when there is no video. */
  detail: string;
  /** Short tag, e.g. "Clip project". */
  usage: string;
  /** What kind of movement this is, from the backend's reason. */
  kind: CreditKind;
  /** Readable activity, e.g. "Video import & clipping" or "Refund — import failed". */
  activity: string;
  reason: string;
  reference_id: string | null;
  balance_after: number | null;
};

const REASON_LABELS: Record<string, string> = {
  clip_generation: "Clip generation",
  url_import_pipeline: "Video import & clipping",
  upload_pipeline: "Upload & clipping",
  coupon_bonus: "Coupon bonus",
  url_import_pipeline_failed: "Refund — import failed",
  url_import_enqueue_failed: "Refund — import couldn't start",
  upload_enqueue_failed: "Refund — upload couldn't start",
  clip_generation_enqueue_failed: "Refund — generation couldn't start",
  pipeline_failed: "Refund — processing failed",
};

/** Refunds are written by the backend with a reason ending in "_failed". */
export function creditKind(reason: string, amount: number): CreditKind {
  if (amount < 0) return "used";
  if (/_failed$/.test(reason)) return "refund";
  if (/bonus|coupon|referral|promo/.test(reason)) return "bonus";
  return "added";
}

export function creditActivity(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

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
    detail: (tx.reference_id && titles.get(tx.reference_id)) || creditActivity(tx.reason),
    usage: tx.reference_id ? "Clip project" : tx.amount < 0 ? "Usage" : "Credits added",
    kind: creditKind(tx.reason, tx.amount),
    activity: creditActivity(tx.reason),
    reason: tx.reason,
    reference_id: tx.reference_id,
    balance_after: tx.balance_after ?? null,
  }));
}
