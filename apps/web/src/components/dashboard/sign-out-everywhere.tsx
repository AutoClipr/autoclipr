"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/hooks/use-confirm";

/** Ends every session for this account (all browsers and devices), including this one. */
export function SignOutEverywhere() {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [loading, setLoading] = useState(false);

  async function run() {
    const ok = await confirm({
      title: "Sign out of all devices?",
      description: "You'll be signed out everywhere, including this browser, and will need to sign in again.",
      confirmLabel: "Sign out everywhere",
    });
    if (!ok) return;
    setLoading(true);
    const { error } = await createClient().auth.signOut({ scope: "global" });
    if (error) {
      setLoading(false);
      toast.error("Couldn't sign out of other devices. Please try again.");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {dialog}
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#253244] px-3 text-xs font-medium text-[#F8FAFC] transition-colors hover:border-[#35445a] hover:bg-white/[0.04] disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Sign out everywhere
      </button>
    </>
  );
}
