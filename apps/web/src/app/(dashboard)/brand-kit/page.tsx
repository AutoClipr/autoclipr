import { createClient } from "@/lib/supabase/server";
import { apiFetch, type Profile } from "@/lib/api";
import { isPaidTier } from "@/lib/plans";
import { BrandKitManager } from "@/components/brand-kit/brand-kit-manager";
import { BrandKitUpgradeCard } from "@/components/brand-kit/brand-kit-upgrade";

export const metadata = { title: "Brand Kit" };

export default async function BrandKitPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const me = await apiFetch<Profile>("/api/v1/users/me", { token: session!.access_token });

  // The API enforces this too; this only picks the right screen.
  if (!isPaidTier(me.data?.subscription_tier)) {
    return (
      <div className="flex justify-center py-10">
        <BrandKitUpgradeCard />
      </div>
    );
  }
  const { new: startNew } = await searchParams;
  return (
    <div>
      <BrandKitManager startNew={startNew === "1"} />
    </div>
  );
}
