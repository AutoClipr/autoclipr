import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AnalyticsBody, type AnalyticsData } from "@/components/admin/analytics-views";
import { EmptyState } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/v1`;

async function fetchAnalytics(days: number): Promise<AnalyticsData | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await fetch(`${API}/admin/analytics?days=${days}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return (await res.json()).data;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: daysParam } = await searchParams;
  const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30;
  const data = await fetchAnalytics(days);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC]">Analytics</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">Platform activity from the database · last {days} days · UTC</p>
        </div>
        <div role="radiogroup" aria-label="Date range" className="flex rounded-lg border border-[#263449] bg-[#141F30] p-1">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={d === 30 ? "/admin/analytics" : `/admin/analytics?days=${d}`} role="radio" aria-checked={days === d} scroll={false}
              className={cn("flex h-8 items-center rounded-md px-3 text-xs font-medium", days === d ? "bg-[#54D045] text-[#0B1120]" : "text-[#94A3B8] hover:text-[#F8FAFC]")}>
              {d}d
            </Link>
          ))}
        </div>
      </div>

      {data ? (
        <AnalyticsBody data={data} />
      ) : (
        <div className="rounded-xl border border-[#263449] bg-[#141F30]">
          <EmptyState icon={AlertTriangle} title="Couldn't load analytics" text="The API didn't respond. Refresh the page to try again." />
        </div>
      )}
    </div>
  );
}
