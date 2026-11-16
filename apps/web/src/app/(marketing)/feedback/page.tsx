import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type Profile } from "@/lib/api";
import { resolveUserFullName } from "@/lib/user-avatar";
import { pageMetadata } from "@/lib/seo";
import { FeedbackForm } from "@/components/marketing/feedback-form";

export const metadata: Metadata = pageMetadata({
  title: "Feedback",
  description:
    "Share bugs, feature ideas, or general feedback about AutoClipr. We read every message.",
  path: "/feedback",
});

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let initialName = "";
  let initialEmail = session?.user.email ?? "";

  if (session?.access_token) {
    const profileRes = await apiFetch<Profile>("/api/v1/users/me", {
      token: session.access_token,
    });
    if (profileRes.data) {
      initialName =
        profileRes.data.full_name ??
        resolveUserFullName(session.user.user_metadata) ??
        "";
      initialEmail = profileRes.data.email || initialEmail;
    }
  }

  return (
    <div className="relative isolate">
      <MarketingHero
        label="Feedback"
        title="Help us build"
        highlight="better"
        description="Report bugs, request features, or share your experience. We read every message."
      />
      <div className="mx-auto max-w-2xl px-4 pb-20 sm:px-6">
        <FeedbackForm initialName={initialName} initialEmail={initialEmail} />
      </div>
    </div>
  );
}
