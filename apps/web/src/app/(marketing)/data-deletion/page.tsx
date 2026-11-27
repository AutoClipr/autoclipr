import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Data Deletion",
  description: "How to delete the data AutoClipr holds from your connected Instagram or Facebook account, and check a deletion request.",
  path: "/data-deletion",
});

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/v1`;

type Status = { valid: boolean; completedAt: string | null };

async function lookup(code: string): Promise<Status | null> {
  try {
    const res = await fetch(`${API}/platforms/data-deletion/${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()).data as Status;
  } catch {
    return null;
  }
}

export default async function DataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const status = code ? await lookup(code) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-32 sm:px-6">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/70">
        <ShieldCheck className="h-3.5 w-3.5 text-[#54D045]" /> Your data
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">Data deletion</h1>

      {code && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {status?.valid ? (
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#54D045]" />
              <div>
                <p className="font-semibold text-white">Deletion complete</p>
                <p className="mt-1 text-sm text-white/60">
                  We deleted the data linked to your Instagram account
                  {status.completedAt ? ` on ${new Date(status.completedAt).toUTCString()}` : ""}.
                </p>
                <p className="mt-3 font-mono text-xs text-white/40">Confirmation code: {code}</p>
              </div>
            </div>
          ) : status ? (
            <div className="flex gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#F87171]" />
              <div>
                <p className="font-semibold text-white">We don&apos;t recognise this code</p>
                <p className="mt-1 text-sm text-white/60">Check the code from Instagram, or email us and we&apos;ll look into it.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/60">We couldn&apos;t check this code right now. Please try again in a minute.</p>
          )}
        </div>
      )}

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-white/70">
        <section>
          <h2 className="text-lg font-semibold text-white">What we hold from Instagram</h2>
          <p className="mt-2">
            When you connect Instagram, we store your Instagram account ID, username and the access token that lets us publish clips you choose to post.
            We don&apos;t store your Instagram password, followers or messages.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">How to delete it</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <span className="text-white">From AutoClipr:</span> go to{" "}
              <Link href="/setup/platforms" className="text-[#8fe383] hover:underline">Connected platforms</Link> and click <em>Disconnect</em> on Instagram. This deletes the stored token and account details immediately.
            </li>
            <li>
              <span className="text-white">From Instagram:</span> Settings → Website permissions → Apps and websites → remove AutoClipr. Instagram tells us, and we delete the same data automatically. You&apos;ll get a confirmation code you can check on this page.
            </li>
            <li>
              <span className="text-white">Your whole AutoClipr account:</span> email{" "}
              <a href="mailto:hello@autoclipr.com" className="text-[#8fe383] hover:underline">hello@autoclipr.com</a> from your account&apos;s email address and we&apos;ll delete it. See our{" "}
              <Link href="/privacy" className="text-[#8fe383] hover:underline">privacy policy</Link> for details.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
