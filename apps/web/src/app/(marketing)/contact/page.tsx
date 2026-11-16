import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type Profile } from "@/lib/api";
import { resolveUserFullName } from "@/lib/user-avatar";
import { pageMetadata } from "@/lib/seo";
import { ContactInfo } from "@/components/marketing/contact-info";
import { FeedbackForm } from "@/components/marketing/feedback-form";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Get in touch with the AutoClipr team for support, billing, partnerships, or general questions.",
  path: "/contact",
});

export default async function ContactPage() {
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
        label="Contact"
        title="Talk to the"
        highlight="team"
        description="Questions about your account, billing, or using AutoClipr? Send a message and we'll get back to you as soon as we can."
      />
      <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">

        <div className="grid gap-8 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-2">
            <ContactInfo />
          </div>
          <div className="lg:col-span-3">
            <FeedbackForm
              variant="contact"
              initialName={initialName}
              initialEmail={initialEmail}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
