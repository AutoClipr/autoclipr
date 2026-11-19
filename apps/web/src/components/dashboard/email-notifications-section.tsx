"use client";

import { useState } from "react";
import { Bell, BellOff, CalendarClock, CreditCard, Link2, Lock, Scissors } from "lucide-react";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/auth-token";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Optional email types the user can switch off. Keys are profile columns. */
export type EmailPrefKey =
  | "clips_ready_email_notifications"
  | "scheduler_email_notifications"
  | "platform_email_notifications";

export type EmailPrefs = Record<EmailPrefKey, boolean>;

const OPTIONAL_TYPES: { key: EmailPrefKey; icon: typeof Bell; label: string; description: string }[] = [
  {
    key: "clips_ready_email_notifications",
    icon: Scissors,
    label: "Clips ready",
    description: "When AI clip generation for a video finishes.",
  },
  {
    key: "scheduler_email_notifications",
    icon: CalendarClock,
    label: "Scheduled posts",
    description: "When a scheduled post goes live or needs your attention.",
  },
  {
    key: "platform_email_notifications",
    icon: Link2,
    label: "Platform connections",
    description: "When a social account is connected or disconnected.",
  },
];

async function patchProfile(body: Record<string, boolean>) {
  const token = await getAccessToken();
  if (!token) return { ok: false, message: "Your session expired. Please sign in again." };
  const res = await apiFetch("/api/v1/users/me", { method: "PATCH", token, body: JSON.stringify(body) });
  return { ok: res.success, message: res.error?.message ?? "Couldn't save your preference. Please try again." };
}

export function EmailNotificationsSection({
  initialEnabled,
  initialPrefs,
}: {
  initialEnabled: boolean;
  initialPrefs: EmailPrefs;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [prefs, setPrefs] = useState<EmailPrefs>(initialPrefs);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggleMaster(next: boolean) {
    setEnabled(next);
    setSaving("master");
    // Only the master switch changes, so individual choices come back when it's re-enabled.
    const res = await patchProfile({ email_notifications_enabled: next });
    setSaving(null);
    if (!res.ok) {
      setEnabled(!next);
      toast.error(res.message);
      return;
    }
    toast.success(next ? "Email notifications turned on" : "Email notifications paused");
  }

  async function toggleType(key: EmailPrefKey, next: boolean) {
    setPrefs((p) => ({ ...p, [key]: next }));
    setSaving(key);
    const res = await patchProfile({ [key]: next });
    setSaving(null);
    if (!res.ok) {
      setPrefs((p) => ({ ...p, [key]: !next }));
      toast.error(res.message);
      return;
    }
    toast.success("Preference saved");
  }

  return (
    <div className="space-y-4">
      {/* Master switch */}
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors",
          enabled ? "border-[#54D045]/30 bg-[#54D045]/[0.06]" : "border-[#253244] bg-[#0B1220]",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              enabled ? "border-[#54D045]/30 bg-[#54D045]/10 text-[#8fe383]" : "border-[#253244] text-[#94A3B8]",
            )}
          >
            {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </span>
          <div>
            <p id="master-label" className="text-sm font-medium text-[#F8FAFC]">
              Email notifications
            </p>
            <p className="text-xs text-[#94A3B8]">
              {enabled
                ? "Optional emails follow your choices below."
                : "Optional emails are paused. Your choices below are kept for when you turn this back on."}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={saving === "master"}
          onChange={toggleMaster}
          labelledBy="master-label"
        />
      </div>

      {/* Per-type */}
      <ul className="divide-y divide-[#253244] overflow-hidden rounded-xl border border-[#253244]">
        {OPTIONAL_TYPES.map((t) => {
          const Icon = t.icon;
          const on = prefs[t.key];
          return (
            <li
              key={t.key}
              className={cn("flex items-center gap-3 bg-[#0B1220]/40 px-4 py-3.5 transition-opacity", !enabled && "opacity-50")}
            >
              <Icon className="h-4 w-4 shrink-0 text-[#94A3B8]" />
              <div className="min-w-0 flex-1">
                <p id={`${t.key}-label`} className="text-sm font-medium text-[#F8FAFC]">
                  {t.label}
                </p>
                <p className="text-xs text-[#94A3B8]">{t.description}</p>
              </div>
              <Switch
                checked={on}
                disabled={!enabled || saving === t.key}
                onChange={(next) => void toggleType(t.key, next)}
                labelledBy={`${t.key}-label`}
              />
            </li>
          );
        })}
        <li className="flex items-center gap-3 bg-[#0B1220]/40 px-4 py-3.5">
          <CreditCard className="h-4 w-4 shrink-0 text-[#94A3B8]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#F8FAFC]">Billing &amp; receipts</p>
            <p className="text-xs text-[#94A3B8]">Purchase confirmations, invoices and subscription changes.</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-[#253244] px-2 py-1 text-[11px] text-[#94A3B8]">
            <Lock className="h-3 w-3" /> Always on
          </span>
        </li>
      </ul>
    </div>
  );
}

function Switch({
  checked,
  disabled,
  onChange,
  labelledBy,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101824] disabled:cursor-not-allowed",
        checked ? "bg-[#54D045]" : "bg-[#253244]",
        disabled && "opacity-60",
      )}
    >
      <span
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
