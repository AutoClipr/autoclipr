"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { apiFetch } from "@/lib/api";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await apiFetch<{ subscribed: boolean }>("/api/v1/newsletter/subscribe", {
        method: "POST",
        skipGlobalLoader: true,
        body: JSON.stringify({
          email,
          source: "footer",
          page_url: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });

      if (res.success) {
        setStatus("done");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(res.error?.message ?? "Something went wrong. Try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-500/10 p-1.5 pr-5 shadow-[0_0_30px_-8px_rgba(16,185,129,0.5)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-black">
          <Check className="h-4 w-4" />
        </span>
        <p className="text-sm font-medium text-emerald-200">You&apos;re subscribed — watch your inbox.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      {/* One pill: icon · email · Subscribe button */}
      <div
        className={`flex items-center gap-2 rounded-full border bg-white/[0.04] p-1.5 pl-4 backdrop-blur transition-all focus-within:border-emerald-400/60 focus-within:shadow-[0_0_30px_-8px_rgba(16,185,129,0.55)] ${
          status === "error" ? "border-rose-400/50" : "border-white/15"
        }`}
      >
        <Mail className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "newsletter-error" : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white placeholder:text-white/35 border-0 shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.03] disabled:opacity-60"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Subscribe
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>

      {status === "error" && (
        <p id="newsletter-error" role="alert" className="mt-2 pl-4 text-xs text-rose-400">
          {message}
        </p>
      )}
      <p className="mt-3 flex items-center gap-1.5 pl-4 text-xs text-white/45">
        <Check className="h-3.5 w-3.5 text-emerald-400" />
        Clip tips and product updates. Unsubscribe anytime.
      </p>
    </form>
  );
}
