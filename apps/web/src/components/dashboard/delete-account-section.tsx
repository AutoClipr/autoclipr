"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DELETED_ITEMS = [
  "Your profile, credits and subscription",
  "All uploaded videos and generated clips",
  "Scheduled posts and connected social accounts",
];

export function DeleteAccountSection() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typed = confirmText === "DELETE";

  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !loading && setDialogOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, loading]);

  async function deleteAccount() {
    if (!typed) return;
    setLoading(true);
    setError(null);

    const token = await getAccessToken();
    if (!token) {
      setError("Your session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    const res = await apiFetch<{ deleted: boolean }>("/api/v1/users/me", {
      method: "DELETE",
      token,
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    if (!res.success) {
      setError(res.error?.message ?? "We couldn't delete your account. Please try again or contact support.");
      setLoading(false);
      return;
    }

    // Only after the backend confirms.
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#cbd5e1]">Permanently delete your AutoClipr account and associated data.</p>
        <ul className="mt-3 space-y-1.5">
          {DELETED_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <span className="h-1 w-1 rounded-full bg-[#EF4444]/70" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-medium text-[#fca5a5]">This can&apos;t be undone.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="delete-confirm" className="text-[#cbd5e1]">
          Type <span className="font-mono font-semibold text-[#F8FAFC]">DELETE</span> to continue
        </Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            className="h-11 border-[#253244] bg-[#0B1220] font-mono sm:max-w-xs"
          />
          <button
            type="button"
            disabled={!typed || loading}
            onClick={() => {
              setError(null);
              setDialogOpen(true);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#EF4444]/40 px-4 text-sm font-semibold text-[#fca5a5] transition-colors hover:bg-[#EF4444]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Delete account…
          </button>
        </div>
      </div>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070B12]/85 p-4 backdrop-blur-sm"
          onClick={() => !loading && setDialogOpen(false)}
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-desc"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#EF4444]/30 bg-[#101824] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]"
          >
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10">
              <AlertTriangle className="h-5 w-5 text-[#f87171]" />
            </span>
            <h3 id="delete-title" className="text-lg font-semibold text-[#F8FAFC]">
              Delete your account for good?
            </h3>
            <p id="delete-desc" className="mt-2 text-sm text-[#94A3B8]">
              Your videos, clips, scheduled posts, credits and connected accounts will be permanently removed and
              you&apos;ll be signed out. There is no way to recover them.
            </p>
            {error && (
              <p className="mt-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-sm text-[#fca5a5]" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                disabled={loading}
                onClick={() => setDialogOpen(false)}
                className="h-10 rounded-lg border border-[#253244] px-4 text-sm font-medium text-[#F8FAFC] hover:bg-white/[0.04] disabled:opacity-50"
              >
                Keep my account
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={deleteAccount}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#EF4444] px-4 text-sm font-semibold text-white hover:bg-[#dc2626] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
