"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Camera, Loader2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import {
  getUserAvatarFallback,
  getUserAvatarImageUrl,
  isEmojiAvatar,
} from "@/lib/user-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function SettingsForm({
  email: initialEmail,
  fullName: initialName,
  phone: initialPhone,
  avatarUrl: initialAvatarUrl,
  emailEditable,
  emailVerified = false,
}: {
  email: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  emailEditable?: boolean;
  emailVerified?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const avatarImageUrl = getUserAvatarImageUrl(avatarUrl);
  const avatarFallback = getUserAvatarFallback({
    email: initialEmail,
    phone: initialPhone,
    fullName,
    avatarUrl,
  });

  async function persistAvatarUrl(nextUrl: string) {
    const token = await getAccessToken();
    if (!token) throw new Error("Session expired. Please sign in again.");

    const res = await apiFetch("/api/v1/users/me", {
      method: "PATCH",
      token,
      body: JSON.stringify({ avatar_url: nextUrl }),
    });

    if (!res.success) {
      throw new Error(res.error?.message ?? "Failed to save profile photo");
    }

    const supabase = createClient();
    await supabase.auth.updateUser({
      data: { avatar_url: nextUrl || "" },
    });

    setAvatarUrl(nextUrl);
    router.refresh();
  }

  async function onAvatarSelected(file: File | null) {
    if (!file) return;

    if (!AVATAR_ACCEPT.split(",").includes(file.type)) {
      toast.error("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Profile photo must be 2 MB or smaller.");
      return;
    }

    setAvatarLoading(true);
    const toastId = toast.loading("Uploading photo…");

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Session expired. Please sign in again.");

      const init = await apiFetch<{ upload_url: string; avatar_url: string }>(
        "/api/v1/users/me/avatar/upload",
        {
          method: "POST",
          token,
          body: JSON.stringify({ filename: file.name, mime_type: file.type, size: file.size }),
        },
      );

      if (!init.success || !init.data) {
        throw new Error(init.error?.message ?? "Failed to start upload");
      }

      const uploadRes = await fetch(init.data.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Upload failed. Please try again.");

      const publicUrl = `${init.data.avatar_url}?t=${Date.now()}`;
      await persistAvatarUrl(publicUrl);
      toast.success("Profile photo updated!", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo", { id: toastId });
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarLoading(true);
    const toastId = toast.loading("Removing photo…");
    try {
      await persistAvatarUrl("");
      toast.success("Profile photo removed.", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove photo", { id: toastId });
    } finally {
      setAvatarLoading(false);
    }
  }

  async function save() {
    setLoading(true);

    const token = await getAccessToken();
    if (!token) {
      toast.error("Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    const res = await apiFetch("/api/v1/users/me", {
      method: "PATCH",
      token,
      body: JSON.stringify({
        full_name: fullName.trim(),
        ...(emailEditable && email.trim() ? { email: email.trim() } : {}),
      }),
    });

    if (!res.success) {
      toast.error(res.error?.message ?? "Failed to save profile");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });

    if (emailEditable && email.trim() && email.trim() !== initialEmail) {
      toast.success("Profile saved! Check your inbox to verify the new email.");
    } else {
      toast.success("Profile saved!");
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  const trimmedName = fullName.trim();
  const nameError = trimmedName.length > 0 && trimmedName.length < 2 ? "Name must be at least 2 characters." : null;
  const dirty =
    trimmedName !== initialName.trim() || (emailEditable && email.trim() !== initialEmail && !!email.trim());

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative w-fit">
          <Avatar className="h-20 w-20 ring-1 ring-[#253244] ring-offset-4 ring-offset-[#101824]">
            {avatarImageUrl && <AvatarImage src={avatarImageUrl} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className={cn("text-2xl", isEmojiAvatar(avatarFallback) ? "text-3xl" : "font-bold")}>
              {avatarFallback}
            </AvatarFallback>
          </Avatar>
          {avatarLoading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-medium text-[#F8FAFC]">Profile photo</p>
            <p className="text-xs text-[#94A3B8]">JPG, PNG or WebP, up to 2 MB. Your initial shows if no photo is set.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="hidden"
              onChange={(e) => onAvatarSelected(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={avatarLoading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#253244] bg-[#131D2B] px-3 text-xs font-medium text-[#F8FAFC] transition-colors hover:border-[#35445a] disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5" />
              {avatarLoading ? "Uploading…" : avatarImageUrl ? "Change photo" : "Upload photo"}
            </button>
            {avatarImageUrl && (
              <button
                type="button"
                disabled={avatarLoading}
                onClick={removeAvatar}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium text-[#94A3B8] transition-colors hover:bg-[#EF4444]/10 hover:text-[#fca5a5] disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-[#cbd5e1]">Display name</Label>
          <Input
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "name-error" : undefined}
            className={cn("h-11 border-[#253244] bg-[#0B1220]", nameError && "border-[#EF4444]/60")}
          />
          {nameError && (
            <p id="name-error" className="text-xs text-[#fca5a5]">
              {nameError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="email" className="text-[#cbd5e1]">Email</Label>
            {!emailEditable && initialEmail && (
              emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8fe383]">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </span>
              ) : (
                <span className="text-[11px] font-medium text-amber-300">Not verified</span>
              )
            )}
          </div>
          <div className="relative">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!emailEditable && !!initialEmail}
              placeholder={emailEditable ? "Add your email" : undefined}
              className="h-11 border-[#253244] bg-[#0B1220] pr-9 disabled:cursor-default disabled:opacity-100 disabled:text-[#94A3B8]"
            />
            {!emailEditable && initialEmail && (
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#475569]" />
            )}
          </div>
          <p className="text-xs text-[#94A3B8]">
            {emailEditable
              ? "Add a verified email to connect Google/YouTube for posting clips."
              : "Your sign-in email. Contact support to change it."}
          </p>
        </div>
      </div>

      {initialPhone && (
        <div className="space-y-2">
          <Label className="text-[#cbd5e1]">Mobile</Label>
          <Input value={initialPhone} disabled className="h-11 border-[#253244] bg-[#0B1220]" />
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-[#253244] pt-5">
        <button
          type="button"
          onClick={save}
          disabled={loading || !dirty || !!nameError || !trimmedName}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] transition-colors hover:bg-[#62dc53] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-[#8fe383]">
            <BadgeCheck className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {!saved && dirty && !loading && <span className="text-xs text-[#94A3B8]">Unsaved changes</span>}
      </div>
    </div>
  );
}
