"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, X } from "lucide-react";
import { getAccessToken } from "@/lib/auth-token";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const REASONS: { value: string; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_using", label: "Not using AutoClipr enough" },
  { value: "missing_features", label: "Missing features" },
  { value: "found_alternative", label: "Found an alternative" },
  { value: "technical_issues", label: "Technical issues" },
  { value: "other", label: "Other" },
];

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * "Cancel subscription" link + confirmation modal. Nothing is cancelled until
 * the user presses Confirm Cancellation; the reason question is optional.
 */
export function CancelSubscriptionButton({ planName, accessUntil }: { planName: string; accessUntil?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function confirm() {
    setBusy(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      router.push("/login?redirect=/subscription");
      return;
    }
    const res = await apiFetch("/api/v1/billing/subscription/cancel", {
      method: "POST",
      token,
      body: JSON.stringify({
        ...(reason ? { reason } : {}),
        ...(reason === "other" && comment.trim() ? { comment: comment.trim() } : {}),
      }),
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error?.message ?? "We could not cancel your subscription. Please try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-red-400 underline-offset-4 transition-colors hover:text-red-300 hover:underline"
      >
        Cancel subscription
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
            onMouseDown={(e) => e.target === e.currentTarget && !busy && setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-sub-title"
          >
            <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0f14] p-6 shadow-2xl">
              <button
                type="button"
                aria-label="Close"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <h2 id="cancel-sub-title" className="text-xl font-bold text-white">
                Cancel your subscription?
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Are you sure you want to cancel your AutoClipr {planName}?
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  Your plan stays active until the end of your billing period
                  {accessUntil ? ` (${fmt(accessUntil)})` : ""}.
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  You will not be charged for the next billing cycle.
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  Premium features stay available until your subscription expires.
                </li>
              </ul>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                  Why are you leaving? <span className="font-normal normal-case tracking-normal">(optional)</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReason(reason === r.value ? null : r.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        reason === r.value
                          ? "border-white bg-white font-semibold text-black"
                          : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]",
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {reason === "other" && (
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Tell us more (optional)"
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/25"
                  />
                )}
              </div>

              {error && (
                <p className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-sm text-rose-200">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                >
                  Keep My Subscription
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirm}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Banner shown while a cancellation is scheduled, with a way to undo it. */
export function CancellationScheduled({ accessUntil }: { accessUntil?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resume() {
    setBusy(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) return;
    const res = await apiFetch("/api/v1/billing/subscription/resume", { method: "POST", token });
    setBusy(false);
    if (!res.success) {
      setError(res.error?.message ?? "We could not resume your subscription. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-1.5 mb-1.5 flex flex-col gap-3 rounded-[1.25rem] border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <p className="font-semibold text-amber-100">Subscription Cancellation Scheduled</p>
          <p className="mt-0.5 text-sm text-amber-100/70">
            Your subscription will remain active until {accessUntil ? fmt(accessUntil) : "the end of your billing period"}.
            You will not be charged for another billing cycle.
          </p>
          {error && <p className="mt-1 text-sm text-rose-300">{error}</p>}
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={resume}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Resume subscription
      </button>
    </div>
  );
}
