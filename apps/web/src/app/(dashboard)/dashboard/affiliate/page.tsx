import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { AffiliateDashboard, AffiliateApply, AffiliateLoadError } from "./client";

export const metadata: Metadata = { title: "Refer & earn" };

export type AffiliateStats = {
  total_clicks: number;
  total_referrals: number;
  total_conversions: number;
  total_earnings_paise: number;
  pending_earnings_paise: number;
  paid_out_paise: number;
  available_paise: number;
  /** Payouts requested but not yet paid. */
  requested_paise?: number;
  commission_rate: number;
};

export type AffiliateProgram = {
  tiers: Array<{ id: string; name: string; min_conversions: number; max_conversions: number | null; rate: number }>;
  min_payout_paise: number;
  commission_hold_days: number;
  payout_methods: Array<{ id: string; label: string }>;
};

export type AffiliateData = {
  affiliate: {
    id: string;
    ref_code: string;
    status: string;
    commission_rate: number;
    email: string | null;
    channel_url: string | null;
    applied_at: string;
    approved_at: string | null;
  };
  stats: AffiliateStats;
  referrals: Array<{
    id: string;
    status: string;
    plan_id: string | null;
    created_at: string;
    converted_at: string | null;
  }>;
  commissions: Array<{
    id: string;
    amount_paise: number;
    commission_rate: number;
    plan_id: string | null;
    billing_period: string | null;
    status: string;
    created_at: string;
  }>;
  payouts: Array<{
    id: string;
    amount_paise: number;
    status: string;
    payment_method: string;
    paid_at: string | null;
    created_at: string;
  }>;
  program?: AffiliateProgram;
};

export default async function AffiliatePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session!.access_token;

  const [res, programRes] = await Promise.all([
    apiFetch<AffiliateData>("/api/v1/affiliates/me", { token, cache: "no-store" }),
    apiFetch<AffiliateProgram>("/api/v1/affiliates/program", { cache: "no-store" }),
  ]);
  const program = res.data?.program ?? programRes.data ?? null;

  if (res.success && res.data) {
    return <AffiliateDashboard data={res.data} program={program} token={token} />;
  }
  // Only a missing account means "not an affiliate yet"; anything else is a load failure.
  if (res.error?.code === "NOT_FOUND") {
    return <AffiliateApply token={token} program={program} />;
  }
  return <AffiliateLoadError />;
}
