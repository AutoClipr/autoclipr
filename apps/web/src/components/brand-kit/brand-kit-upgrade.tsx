"use client";

import Link from "next/link";
import { Check, Crown, X } from "lucide-react";

const BENEFITS = [
  "Custom logo branding",
  "Professional caption styles",
  "Custom brand colors",
  "Intro and outro videos",
  "Reusable brand templates",
];

/** Upgrade pitch for Starter users. Uses the normal pricing → checkout flow. */
export function BrandKitUpgradeCard({ onClose }: { onClose?: () => void }) {
  return (
    <div className="relative w-full max-w-lg rounded-3xl border border-[#253244] bg-[#101824] p-7 text-center shadow-2xl">
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white">
          <X className="h-5 w-5" />
        </button>
      )}
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 ring-1 ring-amber-400/30">
        <Crown className="h-7 w-7 text-amber-300" aria-hidden />
      </span>
      <p className="mb-2 inline-block rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
        Creator, Pro &amp; Business plans
      </p>
      <h2 className="text-2xl font-extrabold tracking-tight text-[#F8FAFC]">Make every video look like your brand.</h2>
      <p className="mt-2 text-sm text-[#94A3B8]">
        Create professional, consistent videos with your own logo, colors, fonts, captions, intros, and outros.
      </p>
      <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-[#cbd5e1]">
        {BENEFITS.map((b) => (
          <li key={b} className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#54D045]" aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/pricing?checkout=creator" className="inline-flex h-11 items-center justify-center rounded-full bg-[#54D045] px-6 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]">
          Upgrade to Creator
        </Link>
        <Link href="/pricing" className="inline-flex h-11 items-center justify-center rounded-full border border-[#253244] px-6 text-sm font-semibold text-[#F8FAFC] hover:bg-white/[0.04]">
          Explore plans
        </Link>
      </div>
    </div>
  );
}

export function BrandKitUpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Upgrade for Brand Kit">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <BrandKitUpgradeCard onClose={onClose} />
      </div>
    </div>
  );
}
