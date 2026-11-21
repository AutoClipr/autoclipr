"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, ExternalLink, Gift, Instagram,
  Loader2, MessageCircle, MousePointer, Search, Send, Share2, TrendingUp, UserPlus, Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { AffiliateData, AffiliateProgram } from "./page";

const CARD = "rounded-2xl border border-[#253244] bg-[#101824]";
const FIELD =
  "w-full rounded-lg border border-[#253244] bg-[#0A111B] px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder:text-[#64748B] outline-none focus:border-[#54D045]/60";

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-amber-200" },
  processing: { label: "Processing", cls: "border-[#35D6E8]/30 bg-[#35D6E8]/10 text-[#9beef7]" },
  active: { label: "Active", cls: "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]" },
  suspended: { label: "Suspended", cls: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#fca5a5]" },
  signed_up: { label: "Signed up", cls: "border-[#35D6E8]/30 bg-[#35D6E8]/10 text-[#9beef7]" },
  converted: { label: "Paid", cls: "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]" },
  churned: { label: "Cancelled", cls: "border-[#253244] bg-[#131D2B] text-[#94A3B8]" },
  approved: { label: "Approved", cls: "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]" },
  paid: { label: "Paid", cls: "border-[#54D045]/30 bg-[#54D045]/10 text-[#a6ec9c]" },
  rejected: { label: "Rejected", cls: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#fca5a5]" },
  failed: { label: "Failed", cls: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#fca5a5]" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status.replace(/_/g, " "), cls: "border-[#253244] bg-[#131D2B] text-[#94A3B8]" };
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium capitalize", s.cls)}>{s.label}</span>;
}

/** Current tier and the next one, from the program rules. */
function tierInfo(program: AffiliateProgram | null, conversions: number, rate: number) {
  const tiers = program?.tiers ?? [];
  const current = tiers.find((t) => t.rate === rate) ?? tiers.find((t) => conversions >= t.min_conversions && (t.max_conversions == null || conversions <= t.max_conversions));
  const next = tiers.find((t) => t.min_conversions > conversions && t.rate > rate);
  return { tiers, current, next, left: next ? Math.max(0, next.min_conversions - conversions) : null };
}

function ShareButton({ href, onClick, children }: { href?: string; onClick?: () => void; children: React.ReactNode }) {
  const cls =
    "flex h-9 items-center gap-2 rounded-lg border border-[#253244] bg-[#0A111B] px-3 text-xs font-medium text-[#cbd5e1] transition-colors hover:border-[#35445a] hover:text-white";
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

export function AffiliateDashboard({
  data,
  program,
  token,
}: {
  data: AffiliateData;
  program: AffiliateProgram | null;
  token: string;
}) {
  const router = useRouter();
  const { affiliate, stats, referrals, commissions, payouts } = data;
  const { copied, copy } = useCopy();

  const link = `${SITE_URL.replace(/\/$/, "")}/?ref=${encodeURIComponent(affiliate.ref_code)}`;
  const shareText = `I make my shorts with AutoClipr — AI that turns long videos into viral clips. Try it free: ${link}`;
  const enc = encodeURIComponent;
  const { tiers, current, next, left } = tierInfo(program, stats.total_conversions, stats.commission_rate);
  const minPayout = program?.min_payout_paise ?? null;
  const holdDays = program?.commission_hold_days;
  const conversionRate = stats.total_clicks > 0 ? (stats.total_conversions / stats.total_clicks) * 100 : null;

  // Instagram has no web share link: copy the message, then open DMs to paste it.
  const [igCopied, setIgCopied] = useState(false);
  function shareInstagram() {
    navigator.clipboard.writeText(shareText).catch(() => {});
    setIgCopied(true);
    setTimeout(() => setIgCopied(false), 4000);
    window.open("https://www.instagram.com/direct/inbox/", "_blank", "noopener,noreferrer");
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

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <header className="pb-1">
        <div className="flex items-center gap-2.5">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">REFER &amp; EARN</p>
          <StatusBadge status={affiliate.status} />
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#F8FAFC]">Share AutoClipr. Earn every month.</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#94A3B8]">
          Recommend AutoClipr to your audience and earn recurring commissions from qualifying paid subscriptions.
        </p>
      </header>

      {/* Link + commission */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className={cn(CARD, "relative overflow-hidden p-5 sm:p-6")}>
          <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-[#54D045]/[0.10] blur-3xl" aria-hidden />
          <div className="relative">
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Your referral link</h2>
            <p className="mt-0.5 text-sm text-[#94A3B8]">Share your personal link and earn when people subscribe to AutoClipr.</p>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#253244] bg-[#0A111B] p-1.5 pl-4">
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-[#F8FAFC]">{link}</span>
              <button
                type="button"
                onClick={() => copy(link)}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] transition-colors hover:bg-[#62dc53]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy link"}
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
              <ShareButton onClick={shareInstagram}>
                <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5]">
                  <Instagram className="h-2.5 w-2.5 text-white" />
                </span>
                {igCopied ? "Copied — paste in DM" : "Instagram"}
              </ShareButton>
              <ShareButton href={`https://twitter.com/intent/tweet?text=${enc(shareText)}`}>
                <span className="text-sm font-black leading-none">𝕏</span>
                Post
              </ShareButton>
              <ShareButton onClick={shareMore}>
                <Share2 className="h-3.5 w-3.5" />
                More
              </ShareButton>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-[#94A3B8]">
              Referral code
              <span className="rounded-md border border-[#253244] bg-[#0A111B] px-2 py-0.5 font-mono font-semibold text-[#F8FAFC]">
                {affiliate.ref_code}
              </span>
            </p>
          </div>
        </section>

        <section className="relative flex flex-col overflow-hidden rounded-2xl bg-[#54D045] p-5 text-white shadow-[0_20px_50px_-24px_rgba(84,208,69,0.8)] sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/20 blur-2xl" aria-hidden />
          <p className="relative text-xs font-semibold uppercase tracking-wider text-white/85">Your commission</p>
          <p className="relative mt-1 text-5xl font-extrabold tabular-nums">
            {stats.commission_rate}
            <span className="text-2xl">%</span>
          </p>
          <p className="relative mt-1 text-sm font-semibold">
            recurring{current ? ` · ${current.name} tier` : ""}
          </p>
          <p className="relative mt-3 text-xs leading-relaxed text-white/90">
            Earned on qualifying payments while your referrals stay subscribed, under the program terms.
          </p>
          <div className="relative mt-auto pt-4">
            {next && left != null ? (
              <>
                <div className="flex justify-between text-xs font-medium text-white/90">
                  <span>{stats.total_conversions} paid conversions</span>
                  <span>{next.min_conversions} for {next.rate}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${Math.max(2, Math.min(100, (stats.total_conversions / next.min_conversions) * 100))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs">
                  {left} more to reach <span className="font-bold">{next.name}</span>
                </p>
              </>
            ) : (
              <p className="text-xs font-semibold">You&apos;re on the top tier.</p>
            )}
          </div>
        </section>
      </div>

      {/* Stats */}
      <section className={cn(CARD, "grid grid-cols-2 divide-[#253244] sm:grid-cols-4 sm:divide-x")}>
        {[
          { label: "Link clicks", value: stats.total_clicks.toLocaleString("en-IN"), icon: MousePointer },
          { label: "Signups", value: stats.total_referrals.toLocaleString("en-IN"), icon: UserPlus },
          { label: "Paid conversions", value: stats.total_conversions.toLocaleString("en-IN"), icon: TrendingUp },
          { label: "Total earned", value: fmt(stats.total_earnings_paise), icon: Wallet },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="p-5">
            <p className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Funnel clicks={stats.total_clicks} signups={stats.total_referrals} paid={stats.total_conversions} rate={conversionRate} />
        <MonthlyEarnings commissions={commissions} />
      </div>

      <TierCards tiers={tiers} rate={stats.commission_rate} conversions={stats.total_conversions} />

      <WithdrawalCenter
        stats={stats}
        payouts={payouts}
        program={program}
        minPayout={minPayout}
        holdDays={holdDays}
        token={token}
        onDone={() => router.refresh()}
      />

      <ActivityTabs data={data} onCopy={() => copy(link)} />

      <ProgramFaq program={program} />
    </div>
  );
}

/* ------------------------------------------------------------------ funnel */

function Funnel({ clicks, signups, paid, rate }: { clicks: number; signups: number; paid: number; rate: number | null }) {
  const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");
  const steps = [
    { label: "Link clicks", value: clicks, note: "Total clicks (not unique visitors)" },
    { label: "Signups", value: signups, note: `${pct(signups, clicks)} of clicks` },
    { label: "Paid subscriptions", value: paid, note: `${pct(paid, signups)} of signups` },
  ];
  const max = Math.max(1, clicks, signups, paid);
  return (
    <section className={cn(CARD, "p-5 sm:p-6")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Conversion funnel</h2>
        <span className="text-xs text-[#94A3B8]">Overall {rate != null ? `${rate.toFixed(1)}%` : "—"}</span>
      </div>
      {clicks === 0 ? (
        <p className="mt-6 text-sm text-[#94A3B8]">No clicks yet. Share your link to start filling the funnel.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {steps.map((s) => (
            <li key={s.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-[#cbd5e1]">{s.label}</span>
                <span className="font-semibold tabular-nums text-[#F8FAFC]">{s.value.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#0A111B]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#54D045] to-[#35D6E8]" style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] text-[#64748B]">{s.note}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* --------------------------------------------------------- monthly earnings */

function MonthlyEarnings({ commissions }: { commissions: AffiliateData["commissions"] }) {
  // Last 6 calendar months, built only from real commission records.
  const months = useMemo(() => {
    const now = new Date();
    const list = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-IN", { month: "short" }), paise: 0 };
    });
    for (const c of commissions) {
      if (c.status === "rejected") continue;
      const d = new Date(c.created_at);
      const m = list.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.paise += c.amount_paise;
    }
    return list;
  }, [commissions]);
  const max = Math.max(1, ...months.map((m) => m.paise));
  const total = months.reduce((s, m) => s + m.paise, 0);

  return (
    <section className={cn(CARD, "p-5 sm:p-6")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Commissions by month</h2>
        <span className="text-xs text-[#94A3B8]">Last 6 months · {fmt(total)}</span>
      </div>
      {total === 0 ? (
        <p className="mt-6 text-sm text-[#94A3B8]">No commissions yet. Your monthly earnings will chart here.</p>
      ) : (
        <div className="mt-5 flex h-32 items-end gap-2" role="img" aria-label="Commissions earned per month">
          {months.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-[#94A3B8]">{m.paise ? fmt(m.paise) : ""}</span>
              <div
                className={cn("w-full rounded-t-md", m.paise ? "bg-gradient-to-t from-[#54D045] to-[#35D6E8]" : "bg-[#131D2B]")}
                style={{ height: `${Math.max(4, (m.paise / max) * 88)}px` }}
              />
              <span className="text-[11px] text-[#64748B]">{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- tier cards */

function TierCards({ tiers, rate, conversions }: { tiers: AffiliateProgram["tiers"]; rate: number; conversions: number }) {
  if (!tiers.length) return null;
  return (
    <section className={cn(CARD, "p-5 sm:p-6")}>
      <h2 className="text-base font-semibold text-[#F8FAFC]">Commission tiers</h2>
      <p className="mt-0.5 text-sm text-[#94A3B8]">Your rate goes up automatically as your paid conversions grow.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiers.map((t) => {
          const active = t.rate === rate;
          const reached = conversions >= t.min_conversions;
          const range =
            t.max_conversions == null ? `${t.min_conversions}+ conversions` : `${Math.max(1, t.min_conversions)}–${t.max_conversions} conversions`;
          return (
            <div
              key={t.id}
              className={cn(
                "relative rounded-xl border p-4",
                active ? "border-[#54D045]/50 bg-[#54D045]/[0.07]" : "border-[#253244] bg-[#0A111B]",
              )}
            >
              {active && (
                <span className="absolute right-3 top-3 rounded-md bg-[#54D045] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#070B12]">
                  Current
                </span>
              )}
              <p className="text-sm font-semibold text-[#F8FAFC]">{t.name}</p>
              <p className="text-xs text-[#94A3B8]">{range}</p>
              <p className={cn("mt-2 text-3xl font-bold tabular-nums", active ? "text-[#F8FAFC]" : "text-[#cbd5e1]")}>{t.rate}%</p>
              <p className="text-[11px] text-[#64748B]">of every qualifying payment</p>
              {!reached && (
                <p className="mt-2 text-[11px] text-[#94A3B8]">
                  {t.min_conversions - conversions} more paid conversion{t.min_conversions - conversions === 1 ? "" : "s"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- withdrawal center */

function WithdrawalCenter({
  stats,
  payouts,
  program,
  minPayout,
  holdDays,
  token,
  onDone,
}: {
  stats: AffiliateData["stats"];
  payouts: AffiliateData["payouts"];
  program: AffiliateProgram | null;
  minPayout: number | null;
  holdDays?: number;
  token: string;
  onDone: () => void;
}) {
  const methods = program?.payout_methods ?? [];
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0]?.id ?? "");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const openRequest = payouts.find((p) => p.status === "pending" || p.status === "processing");
  const eligible = minPayout != null && stats.available_paise >= minPayout && !openRequest;
  const amountPaise = Math.round((parseFloat(amount) || 0) * 100);
  const amountError =
    !amount
      ? null
      : minPayout != null && amountPaise < minPayout
        ? `Minimum is ${fmt(minPayout)}.`
        : amountPaise > stats.available_paise
          ? `You can withdraw up to ${fmt(stats.available_paise)}.`
          : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || amountError || !amount || !details.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await apiFetch("/api/v1/affiliates/payouts/request", {
      method: "POST",
      token,
      body: JSON.stringify({ amountPaise, method, details: details.trim() }),
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error?.message ?? "We couldn't submit your request. Please try again.");
      return;
    }
    setSuccess(true);
    setOpen(false);
    setAmount("");
    setDetails("");
    onDone();
  }

  const methodLabel = (id: string) => methods.find((m) => m.id === id)?.label ?? id.replace(/_/g, " ");

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cn(CARD, "p-5")}>
          <p className="text-xs text-[#94A3B8]">Available to withdraw</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#86efac]">{fmt(stats.available_paise)}</p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            {minPayout != null ? `Withdraw from ${fmt(minPayout)}` : "Cleared commissions only"}
          </p>
        </div>
        <div className={cn(CARD, "p-5")}>
          <p className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
            <Clock className="h-3.5 w-3.5" />
            Pending approval
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-amber-200">{fmt(stats.pending_earnings_paise)}</p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            {holdDays ? `Clears ${holdDays} days after each payment` : "Not withdrawable yet"}
          </p>
        </div>
        <div className={cn(CARD, "p-5")}>
          <p className="text-xs text-[#94A3B8]">Paid out</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{fmt(stats.paid_out_paise)}</p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            {stats.requested_paise ? `${fmt(stats.requested_paise)} requested, not yet paid` : "Completed payouts"}
          </p>
        </div>
      </div>

      <div className={cn(CARD, "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">Withdraw earnings</h2>
            <p className="mt-0.5 text-sm text-[#94A3B8]">
              {openRequest
                ? `Your request for ${fmt(openRequest.amount_paise)} is ${STATUS_STYLE[openRequest.status]?.label.toLowerCase() ?? openRequest.status}. You can request again once it's done.`
                : eligible
                  ? `You can withdraw up to ${fmt(stats.available_paise)}${methods.length ? ` by ${methods.map((m) => m.label.split(" (")[0]).join(", ")}` : ""}.`
                  : minPayout != null
                    ? `You need ${fmt(minPayout)} in cleared commissions to request a payout. Pending commissions don't count yet.`
                    : "Payout details couldn't be loaded."}
            </p>
          </div>
          {!open && (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setSuccess(false);
              }}
              disabled={!eligible || !methods.length}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53] disabled:cursor-not-allowed disabled:bg-[#19251F] disabled:text-[#64748B]"
            >
              <Wallet className="h-4 w-4" /> Request payout
            </button>
          )}
        </div>

        {success && (
          <p className="mt-4 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 px-3 py-2 text-sm text-[#86efac]" role="status">
            Payout request submitted. We&apos;ll email you when it&apos;s processed.
          </p>
        )}

        {open && (
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={submit}
            className="mt-5 grid gap-4 border-t border-[#253244] pt-5 sm:grid-cols-3"
          >
            <div>
              <label htmlFor="po-amount" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
                Amount (₹)
              </label>
              <input
                id="po-amount"
                type="number"
                inputMode="decimal"
                min={minPayout ? minPayout / 100 : undefined}
                max={Math.floor(stats.available_paise / 100)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={minPayout ? String(minPayout / 100) : ""}
                required
                aria-invalid={!!amountError}
                className={cn(FIELD, amountError && "border-[#EF4444]/60")}
              />
              <button
                type="button"
                onClick={() => setAmount(String(Math.floor(stats.available_paise / 100)))}
                className="mt-1 text-[11px] font-medium text-[#8fe383] hover:underline"
              >
                Use full balance
              </button>
              {amountError && <p className="mt-1 text-[11px] text-[#fca5a5]">{amountError}</p>}
            </div>
            <div>
              <label htmlFor="po-method" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
                Payment method
              </label>
              <select id="po-method" value={method} onChange={(e) => setMethod(e.target.value)} className={FIELD}>
                {methods.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#101824]">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="po-details" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
                {method === "paypal" ? "PayPal email" : method === "upi" ? "UPI ID" : "Account no · IFSC"}
              </label>
              <input
                id="po-details"
                type={method === "paypal" ? "email" : "text"}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={method === "paypal" ? "you@paypal.com" : method === "upi" ? "name@upi" : "1234567890 · HDFC0001234"}
                required
                className={FIELD}
              />
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-[#fca5a5] sm:col-span-3" role="alert">
                <AlertTriangle className="h-4 w-4" /> {error}
              </p>
            )}
            <div className="flex gap-2 sm:col-span-3">
              <button
                type="submit"
                disabled={submitting || !!amountError || !amount || !details.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53] disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Submitting…" : `Request ${amount ? fmt(amountPaise) : "payout"}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="h-10 rounded-lg border border-[#253244] px-4 text-sm text-[#cbd5e1] hover:bg-white/[0.04]"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}

        {payouts.length > 0 && !open && (
          <p className="mt-4 text-xs text-[#64748B]">
            Last request: {fmt(payouts[0].amount_paise)} via {methodLabel(payouts[0].payment_method)} on {fmtDate(payouts[0].created_at)} ·{" "}
            <StatusBadge status={payouts[0].status} />
          </p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ activity tabs */

type Tab = "referrals" | "commissions" | "payouts";
const PAGE_SIZE = 10;

function ActivityTabs({ data, onCopy }: { data: AffiliateData; onCopy: () => void }) {
  const { referrals, commissions, payouts } = data;
  const [tab, setTab] = useState<Tab>("referrals");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [newest, setNewest] = useState(true);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    type R = { id: string; date: string; status: string; title: string; sub: string; amount?: number };
    const base: R[] =
      tab === "referrals"
        ? referrals.map((r, i) => ({
            id: r.id,
            date: r.created_at,
            status: r.status,
            // Never show who the referred person is — just a stable number.
            title: `Referral #${referrals.length - i}`,
            sub: r.converted_at ? `Paid ${r.plan_id ?? ""} plan on ${fmtDate(r.converted_at)}` : "Signed up, not paid yet",
          }))
        : tab === "commissions"
          ? commissions.map((c) => ({
              id: c.id,
              date: c.created_at,
              status: c.status,
              title: `${c.plan_id ?? "Plan"} · ${c.billing_period ?? ""}`.trim(),
              sub: `${c.commission_rate}% commission`,
              amount: c.amount_paise,
            }))
          : payouts.map((p) => ({
              id: p.id,
              date: p.created_at,
              status: p.status,
              title: p.payment_method.replace(/_/g, " "),
              sub: p.paid_at ? `Paid ${fmtDate(p.paid_at)}` : `Ref ${p.id.slice(0, 8)}`,
              amount: p.amount_paise,
            }));
    const q = query.trim().toLowerCase();
    const filtered = base.filter(
      (r) => (status === "all" || r.status === status) && (!q || `${r.title} ${r.sub}`.toLowerCase().includes(q)),
    );
    filtered.sort((a, b) => (newest ? 1 : -1) * (new Date(b.date).getTime() - new Date(a.date).getTime()));
    return filtered;
  }, [tab, referrals, commissions, payouts, query, status, newest]);

  const statuses = useMemo(() => {
    const src = tab === "referrals" ? referrals : tab === "commissions" ? commissions : payouts;
    return Array.from(new Set(src.map((x) => x.status)));
  }, [tab, referrals, commissions, payouts]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const total = tab === "referrals" ? referrals.length : tab === "commissions" ? commissions.length : payouts.length;

  const tabs = [
    { id: "referrals", label: "Referrals", count: referrals.length },
    { id: "commissions", label: "Commissions", count: commissions.length },
    { id: "payouts", label: "Payouts", count: payouts.length },
  ] as const;

  const empty = {
    referrals: { title: "No referrals yet", text: "Share your link — everyone who signs up with it appears here.", copy: true },
    commissions: { title: "No commissions yet", text: "Commissions appear here as soon as a referral pays for a plan.", copy: true },
    payouts: { title: "No payouts yet", text: "Request a payout once your cleared balance reaches the minimum.", copy: false },
  }[tab];

  return (
    <section className={CARD}>
      <div className="flex gap-1 overflow-x-auto border-b border-[#253244] px-3 pt-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setStatus("all");
              setQuery("");
              setPage(1);
            }}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "border-[#54D045] text-[#F8FAFC]" : "border-transparent text-[#94A3B8] hover:text-[#F8FAFC]",
            )}
          >
            {t.label} <span className="text-[#64748B]">{t.count}</span>
          </button>
        ))}
      </div>

      {total === 0 ? (
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#54D045]/25 bg-[#54D045]/10">
            <Gift className="h-4 w-4 text-[#8fe383]" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#F8FAFC]">{empty.title}</p>
            <p className="mt-0.5 text-xs text-[#94A3B8]">{empty.text}</p>
          </div>
          {empty.copy && (
            <button type="button" onClick={onCopy} className="h-9 rounded-lg bg-[#F8FAFC] px-3 text-sm font-semibold text-[#070B12]">
              Copy your link
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-[#253244] px-5 py-3">
            <label className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search"
                aria-label="Search"
                className={cn(FIELD, "h-9 py-0 pl-8")}
              />
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
              className={cn(FIELD, "h-9 w-auto py-0")}
            >
              <option value="all" className="bg-[#101824]">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s} className="bg-[#101824]">
                  {STATUS_STYLE[s]?.label ?? s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNewest((v) => !v)}
              className="h-9 rounded-lg border border-[#253244] px-3 text-xs font-medium text-[#cbd5e1] hover:bg-white/[0.04]"
            >
              {newest ? "Newest first" : "Oldest first"}
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#94A3B8]">Nothing matches these filters.</p>
          ) : (
            <ul className="divide-y divide-[#253244]/60">
              {visible.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize text-[#F8FAFC]">{r.title}</p>
                    <p className="text-xs text-[#94A3B8]">
                      {fmtDate(r.date)} · {r.sub}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {r.amount != null && (
                      <span className={cn("text-sm font-semibold tabular-nums", tab === "commissions" ? "text-[#86efac]" : "text-[#F8FAFC]")}>
                        {fmt(r.amount)}
                      </span>
                    )}
                    <StatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#253244] px-5 py-3 text-xs text-[#94A3B8]">
              <span>
                Page {current} of {totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#253244] disabled:opacity-35"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={current === totalPages}
                  onClick={() => setPage(current + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#253244] disabled:opacity-35"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------- how it works + FAQ */

function HowItWorks({ program, currentRate }: { program: AffiliateProgram | null; currentRate?: number }) {
  const min = program ? fmt(program.min_payout_paise) : null;
  return (
    <div className={`${CARD} p-6`}>
      <h3 className="text-base font-semibold text-[#F8FAFC]">How it works</h3>
      <div className="mt-4 grid gap-5 sm:grid-cols-3">
        {[
          { t: "Share your link", d: "Post it in a video description, a bio, a blog or a DM. It works on any page of the site." },
          { t: "They go paid", d: "Your referral signs up and upgrades to a paid plan within 90 days of clicking." },
          { t: "You earn monthly", d: `You get your share of every payment while they stay subscribed.${min ? ` Withdraw from ${min}.` : ""}` },
        ].map((s, n) => (
          <div key={s.t} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#54D045]/40 bg-[#54D045]/10 text-xs font-bold text-[#8fe383]">
              {n + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-[#F8FAFC]">{s.t}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">{s.d}</p>
            </div>
          </div>
        ))}
      </div>
      {program && <TierCards tiers={program.tiers} rate={currentRate ?? -1} conversions={0} />}
    </div>
  );
}

function ProgramFaq({ program }: { program: AffiliateProgram | null }) {
  const min = program ? fmt(program.min_payout_paise) : "the minimum";
  const hold = program?.commission_hold_days ?? 30;
  const methods = program?.payout_methods.map((m) => m.label.split(" (")[0]).join(", ") ?? "the listed methods";
  const tiers = program?.tiers ?? [];
  const tierText = tiers.length
    ? tiers.map((t) => `${t.rate}% (${t.name}${t.max_conversions == null ? `, ${t.min_conversions}+` : `, ${Math.max(1, t.min_conversions)}–${t.max_conversions}`} paid conversions)`).join(", ")
    : "";
  const faqs = [
    {
      q: "Who counts as a referral?",
      a: "Anyone who signs up through your link and moves to a paid plan within 90 days of their first click. Free-plan signups show in your list but don't earn a commission.",
    },
    {
      q: "How does referral tracking work?",
      a: "Your link adds your code (?ref=…) to any AutoClipr page. When someone opens it, the code is saved in their browser and attached to their account when they sign up.",
    },
    {
      q: "How do recurring commissions work?",
      a: "You earn your commission rate on each payment a referral makes for a paid plan, every billing cycle, for as long as they keep paying.",
    },
    {
      q: "When are commissions approved?",
      a: `A commission is held for ${hold} days after the payment, then it becomes available to withdraw.`,
    },
    {
      q: "When can I withdraw my earnings?",
      a: `Once your available (cleared) balance reaches ${min}. Pending commissions don't count until they clear. One payout request can be open at a time.`,
    },
    { q: "What is the minimum withdrawal amount?", a: `${min}, paid by ${methods}.` },
    {
      q: "How do commission tiers work?",
      a: `Your rate rises automatically as your paid conversions grow${tierText ? `: ${tierText}` : ""}. The new rate applies to commissions earned after you reach the tier.`,
    },
    {
      q: "What happens when a referred customer cancels?",
      a: "Commissions stop when their payments stop. Commissions you already earned on their earlier payments stay yours.",
    },
  ];
  return (
    <div className={`${CARD} p-6`}>
      <h3 className="text-lg font-semibold text-[#F8FAFC]">Questions about the program</h3>
      <p className="mt-1 text-sm text-[#94A3B8]">How referrals, commissions and payouts work.</p>
      <div className="mt-4 divide-y divide-[#253244]">
        {faqs.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[#F8FAFC]">
              {f.q}
              <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8] transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{f.a}</p>
          </details>
        ))}
      </div>
      <Link href="/affiliate" target="_blank" className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#F8FAFC]">
        <ExternalLink className="h-3.5 w-3.5" />
        Full program details
      </Link>
    </div>
  );
}

export function AffiliateLoadError() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className={cn(CARD, "px-6 py-12 text-center")}>
        <p className="font-medium text-[#F8FAFC]">We couldn&apos;t load your affiliate dashboard</p>
        <p className="mt-1 text-sm text-[#94A3B8]">Please try again in a moment.</p>
        <Link href="/dashboard/affiliate" className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#F8FAFC] px-4 text-sm font-semibold text-[#070B12]">
          Retry
        </Link>
      </div>
    </div>
  );
}

export function AffiliateApply({
  token,
  program,
  defaultEmail = "",
  defaultChannelUrl = "",
}: {
  token: string;
  program: AffiliateProgram | null;
  defaultEmail?: string;
  defaultChannelUrl?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [channelUrl, setChannelUrl] = useState(defaultChannelUrl);
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
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Refer &amp; earn</p>
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
                      className="rounded-lg bg-[#54D045] px-5 py-2.5 text-sm font-bold text-[#070B12] transition-colors hover:bg-[#62dc53] disabled:opacity-50"
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

      <HowItWorks program={program} />
      <ProgramFaq program={program} />
    </div>
  );
}
