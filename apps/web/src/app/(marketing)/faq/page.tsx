import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { FAQ } from "@/components/landing/faq";
import { CTA } from "@/components/landing/cta";
import { FaqPageJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = pageMetadata({
  title: "FAQ — Frequently Asked Questions",
  description:
    "Everything you need to know about AutoClipr — pricing, platforms, credits, privacy, and how it works.",
  path: "/faq",
});

export default function FAQPage() {
  return (
    <>
      <FaqPageJsonLd />
      <div className="relative isolate overflow-hidden pt-16">
        {/* Glow + faint grid */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-48 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-emerald-500/[0.09] blur-[130px]" />
          <div
            className="absolute inset-x-0 top-0 h-[560px] opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at top, black 20%, transparent 70%)",
            }}
          />
        </div>
        <FAQ />
      </div>
      <CTA />
    </>
  );
}
