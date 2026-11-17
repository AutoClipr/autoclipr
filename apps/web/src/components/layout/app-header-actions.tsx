"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Plus, Zap } from "lucide-react";
import { PricingModal } from "@/components/billing/pricing-modal";

/**
 * Right side of the header on app pages: notifications, credit balance and an
 * "Add credits" button that opens the pricing plans in a popup.
 */
export function AppHeaderActions({ credits, plan = "free" }: { credits: number; plan?: string }) {
  const planName = `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan`;
  const [bellOpen, setBellOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close the notifications dropdown on outside click.
  useEffect(() => {
    if (!bellOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [bellOpen]);

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Notifications */}
        <div ref={bellRef} className="relative">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setBellOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-white/10 bg-[#0b0f14]/95 p-4 shadow-2xl backdrop-blur">
              <p className="text-sm font-semibold text-white">Notifications</p>
              <div className="flex flex-col items-center py-6 text-center">
                <Bell className="mb-2 h-6 w-6 text-white/25" />
                <p className="text-sm text-white/50">You&apos;re all caught up</p>
              </div>
            </div>
          )}
        </div>

        {/* Credits — hover card with plan details */}
        <div className="group relative hidden sm:block">
          <button
            type="button"
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06] group-focus-within:bg-white/[0.06]"
            aria-label={`${credits} credits remaining`}
          >
            <Zap className="h-4 w-4 fill-amber-400 text-amber-400" />
            {credits}
          </button>
          {/* pt-2 bridges the gap so the card stays open while moving onto it */}
          <div className="invisible absolute right-0 top-full z-50 w-72 pt-2 opacity-0 transition-all duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
            <div className="rounded-2xl border border-white/10 bg-[#111418]/95 p-4 shadow-2xl backdrop-blur">
              <Link href="/subscription" className="flex items-center justify-between gap-3 rounded-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{planName}</span>
                    <span className="rounded-full bg-lime-400/15 px-2 py-0.5 text-[11px] font-semibold text-lime-300">Active</span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/45">Manage plan &amp; credits</p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/40" />
              </Link>
              <div className="my-3 h-px bg-white/10" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/80">Plan credits</span>
                <span className="text-white/60">{credits}</span>
              </div>
              <button
                type="button"
                onClick={() => setPricingOpen(true)}
                className="mt-4 w-full rounded-xl bg-white py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Upgrade
              </button>
              <Link href="/pricing#faq" className="mt-3 block text-center text-xs text-white/45 hover:text-white/70">
                Learn how credits work
              </Link>
            </div>
          </div>
        </div>

        {/* Add credits */}
        <button
          type="button"
          onClick={() => setPricingOpen(true)}
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] sm:text-sm"
        >
          <Plus className="h-3.5 w-3.5 sm:hidden" />
          <span className="hidden sm:inline">Add credits</span>
          <span className="sm:hidden">Credits</span>
        </button>
      </div>

      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} credits={credits} />
    </>
  );
}
