"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check, ChevronDown, Clock, Copy, DollarSign, ExternalLink, Gift, MessageCircle,
  MousePointer, Send, Share2, TrendingUp, Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { AffiliateData } from "./page";

const EASE = [0.22, 1, 0.36, 1] as const;

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
    active:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    suspended: "bg-red-500/10 text-red-400 border-red-500/20",
    signed_up: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    converted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    churned:   "bg-white/5 text-white/30 border-white/10",
    approved:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    paid:      "bg-violet-500/10 text-violet-400 border-violet-500/20",
  };
  const cls = map[status] ?? "bg-white/5 text-white/30 border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}

const TIERS = [
  { label: "Starter", range: "1–5 conversions", rate: 30 },
  { label: "Growth", range: "6–20 conversions", rate: 35 },
  { label: "Elite", range: "21+ conversions", rate: 40 },
];

const FAQS = [
  {
    q: "Who counts as a referral?",
    a: "Anyone who signs up through your link and moves to a paid plan within 90 days of their first click. Free-plan signups show up in your list but don't earn a commission.",
  },
  {
    q: "How much do I earn?",
    a: "A share of every payment your referral makes, for as long as they stay subscribed: 30% to start, 35% after 6 conversions and 40% after 21.",
  },
  {
    q: "When can I withdraw?",
    a: "Commissions are approved within 30 days of the payment. Once your approved balance reaches ₹1,000 you can request a payout by PayPal, bank transfer or UPI.",
  },
  {
    q: "Where can I share my link?",
    a: "Anywhere: YouTube descriptions, TikTok bios, blogs, newsletters or a message to a friend. Every page of autoclipr.com accepts your ?ref code.",
  },
];

function ShareButton({ href, onClick, children }: { href?: string; onClick?: () => void; children: React.ReactNode }) {
  const cls =
    "flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.09] hover:text-white";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return { copied, copy };
}

export function AffiliateDashboard({ data, token }: { data: AffiliateData; token: string }) {
  const { affiliate, stats, referrals, commissions, payouts } = data;
  const [tab, setTab] = useState<"referrals" | "commissions" | "payouts">("referrals");
  const [payoutForm, setPayoutForm] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("paypal");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState(false);
  const { copied, copy } = useCopy();

  const link = `https://autoclipr.com/?ref=${affiliate.ref_code}`;
  const shareText = `I make my shorts with AutoClipr — AI that turns long videos into viral clips. Try it free: ${link}`;
  const enc = encodeURIComponent;

  const nextTier = TIERS.find((t) => t.rate > stats.commission_rate);
  const nextTierAt = nextTier ? (nextTier.rate === 35 ? 6 : 21) : null;
  const conversionsLeft = nextTierAt ? Math.max(0, nextTierAt - stats.total_conversions) : null;

  async function submitPayout(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const amountPaise = Math.round(parseFloat(payoutAmount) * 100);
    const res = await apiFetch("/api/v1/affiliates/payouts/request", {
      method: "POST",
      token,
      body: JSON.stringify({ amountPaise, method: payoutMethod, details: payoutDetails }),
    });
    setSubmitting(false);
    if (res.success) {
      setPayoutSuccess(true);
      setPayoutForm(false);
    }
  }

  async function shareMore() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "AutoClipr", text: shareText, url: link });
      } catch {
        // dismissed
      }
    } else {
      copy(link);
    }
  }

  const tabs = [
    { id: "referrals", label: "Referrals", count: referrals.length },
    { id: "commissions", label: "Commissions", count: commissions.length },
    { id: "payouts", label: "Payouts", count: payouts.length },
  ] as const;

  const card = "rounded-2xl border border-white/[0.08] bg-white/[0.025]";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Heading */}
      <div className="pb-1">
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Earn &amp; refer</p>
          <StatusBadge status={affiliate.status} />
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Share AutoClipr. Earn every month.
        </h1>
      </div>

      {/* Share card */}
      <div className={`${card} relative overflow-hidden p-6 sm:p-7`}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 80% at 100% 0%, rgba(16,185,129,0.12), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white sm:text-[28px]">
              Earn {stats.commission_rate}% of every payment.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              When someone joins a paid plan through your link, you get{" "}
              <span className="font-semibold text-white">{stats.commission_rate}% of what they pay, every month</span>{" "}
              they stay subscribed. Clicks are tracked for 90 days, and commissions are approved within 30 days.
            </p>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5 pl-4">
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-white/75">{link}</span>
              <button
                type="button"
                onClick={() => copy(link)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ShareButton href={`https://wa.me/?text=${enc(shareText)}`}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#25D366]">
                  <MessageCircle className="h-2.5 w-2.5 text-white" />
                </span>
                WhatsApp
              </ShareButton>
              <ShareButton href={`https://t.me/share/url?url=${enc(link)}&text=${enc(shareText)}`}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2AABEE]">
                  <Send className="h-2.5 w-2.5 text-white" />
                </span>
                Telegram
              </ShareButton>
              <ShareButton href={`https://twitter.com/intent/tweet?text=${enc(shareText)}`}>
                <span className="text-sm font-black leading-none">𝕏</span>
              </ShareButton>
              <ShareButton onClick={shareMore}>
                <Share2 className="h-3.5 w-3.5" />
                More…
              </ShareButton>
              <span className="ml-auto flex items-center gap-2 text-xs text-white/40">
                Code
                <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono font-bold text-white">
                  {affiliate.ref_code}
                </span>
              </span>
            </div>
          </div>

          {/* Decorative commission card */}
          <div className="hidden justify-center lg:flex">
            <div className="relative w-60 rotate-[-5deg]">
              <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-emerald-900/40" aria-hidden />
              <div className="relative rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-400 to-lime-300 p-5 text-black shadow-2xl shadow-emerald-500/20">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-black/60">Commission</p>
                <p className="mt-1 text-4xl font-black">{stats.commission_rate}%</p>
                <p className="text-xs font-semibold text-black/70">recurring · {TIERS.find((t) => t.rate === stats.commission_rate)?.label ?? "Starter"} tier</p>
              </div>
              <div className="relative -mt-2 rounded-b-2xl border border-white/10 bg-[#0d1110] px-5 pb-3 pt-4 text-[11px] leading-snug text-white/50">
                {conversionsLeft != null && nextTier
                  ? `${conversionsLeft} more conversion${conversionsLeft === 1 ? "" : "s"} to reach ${nextTier.rate}%.`
                  : "You're on the top tier. Nice work."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Numbers */}
      <div className={`${card} grid grid-cols-2 divide-white/[0.06] sm:grid-cols-4 sm:divide-x`}>
        {[
          { label: "Clicks", value: stats.total_clicks.toString(), icon: MousePointer },
          { label: "Signups", value: stats.total_referrals.toString(), icon: Users },
          { label: "Paid conversions", value: stats.total_conversions.toString(), icon: TrendingUp },
          { label: "Total earned", value: fmt(stats.total_earnings_paise), icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="p-5">
            <p className="flex items-center gap-1.5 text-xs text-white/45">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <HowItWorks currentRate={stats.commission_rate} />

      {/* Balances */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${card} p-5`}>
          <p className="text-xs text-white/45">Available to withdraw</p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-300">{fmt(stats.available_paise)}</p>
          {stats.available_paise >= 100000 ? (
            !payoutForm && (
              <button
                onClick={() => setPayoutForm(true)}
                className="mt-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Request payout →
              </button>
            )
          ) : (
            <p className="mt-1 text-[11px] text-white/35">Withdraw from ₹1,000</p>
          )}
        </div>
        <div className={`${card} p-5`}>
          <p className="flex items-center gap-1.5 text-xs text-white/45"><Clock className="h-3.5 w-3.5" />Pending approval</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-300">{fmt(stats.pending_earnings_paise)}</p>
          <p className="mt-1 text-[11px] text-white/35">Approved within 30 days</p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-xs text-white/45">Paid out</p>
          <p className="mt-1.5 text-2xl font-bold text-white">{fmt(stats.paid_out_paise)}</p>
          <p className="mt-1 text-[11px] text-white/35">PayPal, bank transfer or UPI</p>
        </div>
      </div>

      {payoutForm && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${card} p-6`}>
          <h3 className="mb-4 text-base font-bold">Request payout</h3>
          <form onSubmit={submitPayout} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/60">Amount (₹)</label>
              <input
                type="number"
                min={1000}
                max={(stats.available_paise / 100).toFixed(0)}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="1000"
                required
                className={FIELD}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/60">Payment method</label>
              <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} className={FIELD}>
                <option value="paypal">PayPal</option>
                <option value="bank_transfer">Bank Transfer (IMPS/NEFT)</option>
                <option value="upi">UPI</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/60">
                {payoutMethod === "paypal" ? "PayPal email" : payoutMethod === "upi" ? "UPI ID" : "Account details"}
              </label>
              <input
                type="text"
                value={payoutDetails}
                onChange={(e) => setPayoutDetails(e.target.value)}
                placeholder={payoutMethod === "paypal" ? "you@paypal.com" : payoutMethod === "upi" ? "name@upi" : "Account no · IFSC"}
                required
                className={FIELD}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit request"}
              </button>
              <button
                type="button"
                onClick={() => setPayoutForm(false)}
                className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white/50 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {payoutSuccess && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-400">
          Payout request submitted. We&apos;ll process it within 5–7 business days.
        </div>
      )}

      {/* Activity */}
      <div className={card}>
        <div className="flex gap-1 border-b border-white/[0.06] px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? "border-emerald-400 text-white" : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t.label} <span className="text-white/30">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === "referrals" &&
            (referrals.length === 0 ? (
              <EmptyState
                title="Your referrals will show up here"
                text="No one yet. Share your link — each person who signs up with it appears here, with their status, until they go paid."
                onCopy={() => copy(link)}
              />
            ) : (
              <Rows>
                {referrals.map((r) => (
                  <Row key={r.id} title="New referral" sub={new Date(r.created_at).toLocaleDateString("en-IN")} right={<StatusBadge status={r.status} />} />
                ))}
              </Rows>
            ))}
          {tab === "commissions" &&
            (commissions.length === 0 ? (
              <EmptyState title="No commissions yet" text="Commissions appear here as soon as a referral pays for a plan." onCopy={() => copy(link)} />
            ) : (
              <Rows>
                {commissions.map((c) => (
                  <Row
                    key={c.id}
                    title={<span className="capitalize">{c.plan_id} · {c.billing_period}</span>}
                    sub={`${new Date(c.created_at).toLocaleDateString("en-IN")} · ${c.commission_rate}% commission`}
                    right={
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-300">{fmt(c.amount_paise)}</p>
                        <StatusBadge status={c.status} />
                      </div>
                    }
                  />
                ))}
              </Rows>
            ))}
          {tab === "payouts" &&
            (payouts.length === 0 ? (
              <EmptyState title="No payouts yet" text="Once your approved balance reaches ₹1,000 you can request your first payout." />
            ) : (
              <Rows>
                {payouts.map((p) => (
                  <Row
                    key={p.id}
                    title={<span className="capitalize">{p.payment_method.replace("_", " ")}</span>}
                    sub={new Date(p.created_at).toLocaleDateString("en-IN")}
                    right={
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{fmt(p.amount_paise)}</p>
                        <StatusBadge status={p.status} />
                      </div>
                    }
                  />
                ))}
              </Rows>
            ))}
        </div>
      </div>

      <ProgramFaq />
    </div>
  );
}

const CARD = "rounded-2xl border border-white/[0.08] bg-white/[0.025]";

function HowItWorks({ currentRate }: { currentRate?: number }) {
  return (
      <div className={`${CARD} p-6`}>
        <h3 className="text-base font-semibold text-white">How it works</h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {[
            { t: "Share your link", d: "Post it in a video description, a bio, a blog or a DM. It works on any page of the site." },
            { t: "They go paid", d: "Your referral signs up and upgrades to a paid plan within 90 days of clicking." },
            { t: "You earn monthly", d: "You get your share of every payment while they stay subscribed. Withdraw from ₹1,000." },
          ].map((s, n) => (
            <div key={s.t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-xs font-bold text-emerald-300">
                {n + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{s.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/45">{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {TIERS.map((tier) => {
            const active = currentRate === tier.rate;
            return (
              <div
                key={tier.label}
                className={`relative rounded-xl border p-4 ${
                  active ? "border-emerald-400/40 bg-emerald-500/[0.08]" : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                {active && (
                  <span className="absolute right-3 top-3 rounded bg-emerald-400 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-black">
                    You
                  </span>
                )}
                <p className="text-xs text-white/50">{tier.label} · {tier.range}</p>
                <p className={`mt-1 text-2xl font-bold ${active ? "text-white" : "text-white/70"}`}>{tier.rate}%</p>
                <p className="text-[11px] text-white/35">of every payment</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-white/40">Tiers unlock automatically as your paid conversions grow.</p>
      </div>
  );
}

function ProgramFaq() {
  return (
      <div className={`${CARD} p-6`}>
        <h3 className="text-lg font-semibold text-white">Questions about the program</h3>
        <p className="mt-1 text-sm text-white/45">How referrals, commissions and payouts work. Tap a question to open it.</p>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                {f.q}
                <ChevronDown className="h-4 w-4 text-white/40 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{f.a}</p>
            </details>
          ))}
        </div>
        <a
          href="/affiliate"
          target="_blank"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Full program details
        </a>
      </div>
  );
}

const FIELD =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-emerald-500/40";

function EmptyState({ title, text, onCopy }: { title: string; text: string; onCopy?: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl p-2 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10">
        <Gift className="h-4 w-4 text-emerald-300" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs text-white/45">{text}</p>
      </div>
      {onCopy && (
        <button type="button" onClick={onCopy} className="text-sm font-semibold text-white hover:text-emerald-300">
          Copy your link
        </button>
      )}
    </div>
  );
}

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-white/[0.06]">{children}</div>;
}

function Row({ title, sub, right }: { title: React.ReactNode; sub: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/35">{sub}</p>
      </div>
      {right}
    </div>
  );
}

export function AffiliateApply({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await apiFetch("/api/v1/affiliates/apply", {
      method: "POST",
      token,
      body: JSON.stringify({ email, channelUrl }),
    });
    setSubmitting(false);
    if (res.success) {
      setSuccess(true);
    } else {
      setError(res.error?.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="pb-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Earn &amp; refer</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Share AutoClipr. Earn every month.
        </h1>
      </div>

      <div className={`${CARD} relative overflow-hidden p-6 sm:p-7`}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 80% at 100% 0%, rgba(16,185,129,0.12), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            {success ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400 text-black">
                  <Check className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-2xl font-bold text-white">You&apos;re in.</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
                  Your affiliate account is live and your link is ready. We&apos;ve also emailed it to{" "}
                  <span className="font-semibold text-white">{email}</span>.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-5 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:opacity-90"
                >
                  Get my referral link →
                </button>
              </motion.div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white sm:text-[28px]">Earn up to 40% of every payment.</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
                  Get your own link and earn{" "}
                  <span className="font-semibold text-white">30–40% of what your referrals pay, every month</span>{" "}
                  they stay subscribed. Free to join, no cap on earnings.
                </p>

                <form onSubmit={submit} className="mt-5 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your email"
                      aria-label="Your email"
                      required
                      className={FIELD}
                    />
                    <input
                      type="url"
                      value={channelUrl}
                      onChange={(e) => setChannelUrl(e.target.value)}
                      placeholder="YouTube, TikTok or blog URL"
                      aria-label="YouTube, TikTok or blog URL"
                      required
                      className={FIELD}
                    />
                  </div>
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {submitting ? "Joining…" : "Join the program"}
                    </button>
                    <span className="text-xs text-white/40">Free to join · Approved within 48 hours</span>
                  </div>
                </form>
              </>
            )}
          </div>

          <div className="hidden justify-center lg:flex">
            <div className="relative w-60 rotate-[-5deg]">
              <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-emerald-900/40" aria-hidden />
              <div className="relative rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-400 to-lime-300 p-5 text-black shadow-2xl shadow-emerald-500/20">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-black/60">Commission</p>
                <p className="mt-1 text-4xl font-black">30–40%</p>
                <p className="text-xs font-semibold text-black/70">recurring, every month</p>
              </div>
              <div className="relative -mt-2 rounded-b-2xl border border-white/10 bg-[#0d1110] px-5 pb-3 pt-4 text-[11px] leading-snug text-white/50">
                90-day tracking on every click. Withdraw from ₹1,000.
              </div>
            </div>
          </div>
        </div>
      </div>

      <HowItWorks />
      <ProgramFaq />
    </div>
  );
}
