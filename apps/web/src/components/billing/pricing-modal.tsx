"use client";

import { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PricingSection } from "@/components/landing/pricing-section";

/** Full-screen popup with the pricing plans, rendered into document.body. */
export function PricingModal({ open, onClose, credits }: { open: boolean; onClose: () => void; credits: number }) {
  // Escape closes the pricing popup; lock page scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          role="dialog"
          aria-modal="true"
          aria-label="Add credits"
        >
          <div className="relative my-4 w-full max-w-7xl rounded-3xl border border-white/10 bg-[#07090d] pb-6 pt-10 shadow-2xl">
            <button
              type="button"
              aria-label="Close"
              onClick={() => onClose()}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="px-2 text-center">
              <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Get more credits
              </h2>
              <p className="mt-2 text-sm text-white/55">
                You have <span className="font-semibold text-white">{credits}</span> credits left. Pick a plan to top up.
              </p>
            </div>
            <Suspense fallback={null}>
              <PricingSection showHeader={false} />
            </Suspense>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** A button that opens the pricing popup. */
export function UpgradeButton({ credits, className, children }: { credits: number; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <PricingModal open={open} onClose={() => setOpen(false)} credits={credits} />
    </>
  );
}
