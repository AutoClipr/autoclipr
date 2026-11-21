"use client";

import { Crown } from "lucide-react";
import { PlanUpgradeCard } from "@/components/billing/plan-upgrade-card";

const BENEFITS = [
  "Custom logo branding",
  "Professional caption styles",
  "Custom brand colors",
  "Intro and outro videos",
  "Reusable brand templates",
];

/** Upgrade pitch for Starter users. */
export function BrandKitUpgradeCard({ onClose }: { onClose?: () => void }) {
  return (
    <PlanUpgradeCard
      icon={Crown}
      title="Make every video look like your brand."
      description="Create professional, consistent videos with your own logo, colors, fonts, captions, intros, and outros."
      benefits={BENEFITS}
      onClose={onClose}
    />
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
