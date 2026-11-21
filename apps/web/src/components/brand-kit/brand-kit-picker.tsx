"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ban, Check, ChevronDown, Crown, Palette, Plus, RefreshCw } from "lucide-react";
import { brandKitsApi, CAPTION_PRESETS, type BrandKit } from "@/lib/brand-kits";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandKitUpgradeModal } from "./brand-kit-upgrade";

/**
 * Brand kit selector for the create screen. Paid users get their kits (the
 * default is preselected once); Starter sees a locked control that opens the
 * upgrade prompt. The server re-checks plan and ownership on submit.
 */
export function BrandKitPicker({
  value,
  onChange,
}: {
  value: BrandKit | null;
  onChange: (kit: BrandKit | null) => void;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  const [presets, setPresets] = useState<BrandKit[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [loading, setLoading] = useState(false);
  const pickedDefault = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const e = await brandKitsApi.entitlement();
      setAllowed(e.allowed);
      if (!e.allowed) return;
      setLoadError(null);
      // Templates and own kits load independently, so one failing doesn't hide the other.
      const [pr, own] = await Promise.allSettled([brandKitsApi.presets(), brandKitsApi.list()]);
      const presetList = pr.status === "fulfilled" ? pr.value : [];
      const ownList = own.status === "fulfilled" ? own.value.items : [];
      setPresets(presetList);
      setKits(ownList);
      if (own.status === "rejected") setLoadError("Couldn't load your brand kits. Try Refresh.");
      // Keep the selection fresh (renamed/edited) or drop it if deleted.
      if (value) onChange([...ownList, ...presetList].find((k) => k.id === value.id) ?? null);
      if (!pickedDefault.current && !value) {
        pickedDefault.current = true;
        const def = ownList.find((k) => k.is_default);
        if (def) onChange(def);
      }
    } catch {
      setAllowed((a) => a ?? false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const locked = allowed === false;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (locked ? setUpgrade(true) : setOpen((o) => !o))}
        className="flex w-full items-center gap-3 rounded-xl border border-[#253244] bg-[#0A111B] px-4 py-3 text-left transition-colors hover:border-[#35445a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#54D045]/15">
          <Palette className="h-5 w-5 text-[#54D045]" aria-hidden />
        </span>
        <span className="text-sm font-medium text-[#F8FAFC]">Brand kit</span>
        {locked && (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-px text-[10px] font-semibold uppercase text-amber-300">
            <Crown className="h-3 w-3" aria-hidden /> Pro
          </span>
        )}
        <span className="ml-auto truncate text-sm text-[#94A3B8]">{locked ? "Upgrade to unlock" : value?.name ?? "No brand kit"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#64748B] transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <p className="mt-2 text-xs text-[#64748B]">Your Brand Kit sets the look of your video, including your logo, intro, outro, and caption style.</p>

      {open && (
        <div className="absolute left-0 right-0 top-[64px] z-40 rounded-2xl border border-[#253244] bg-[#101824] p-3 shadow-2xl" role="listbox" aria-label="Brand kits">
          {loadError && (
            <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300" role="alert">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {loadError}
            </p>
          )}
          <div className="grid max-h-[380px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            <KitOption selected={!value} onClick={() => { onChange(null); setOpen(false); }}>
              <div className="flex h-16 items-center justify-center rounded-lg bg-[#0A111B]">
                <Ban className="h-5 w-5 text-[#64748B]" aria-hidden />
              </div>
              <p className="mt-1.5 truncate text-xs font-medium text-[#cbd5e1]">No brand kit</p>
            </KitOption>
            {[...(kits ?? []), ...presets].map((k) => (
              <KitOption key={k.id} selected={value?.id === k.id} onClick={() => { onChange(k); setOpen(false); }}>
                <div className="flex h-16 items-center justify-between gap-2 overflow-hidden rounded-lg px-2.5" style={{ background: k.colors.background }}>
                  {k.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={k.logo_url} alt="" className="h-8 w-8 object-contain" />
                  ) : (
                    <span
                      className="text-[11px] font-black uppercase leading-[1.05]"
                      style={{ color: k.captions?.highlight_color ?? k.colors.primary, fontFamily: "Montserrat, Inter, sans-serif" }}
                    >
                      Choose<br /><span style={{ color: k.captions?.color ?? k.colors.text }}>a style</span>
                    </span>
                  )}
                  <span className="flex gap-0.5">
                    {(["text", "primary", "accent", "secondary"] as const).map((c) => (
                      <span key={c} className="h-3 w-3 rounded-[2px] border border-white/10" style={{ background: k.colors[c] }} />
                    ))}
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1 truncate text-xs font-medium text-[#F8FAFC]">
                  {k.name}
                  {k.is_default && <span className="rounded bg-[#54D045]/15 px-1 text-[9px] font-semibold uppercase text-[#a6ec9c]">Default</span>}
                  {k.id.startsWith("preset:") && <span className="rounded bg-white/10 px-1 text-[9px] font-semibold uppercase text-white/60">Template</span>}
                </p>
                <p className="truncate text-[10px] text-[#64748B]">{CAPTION_PRESETS.find((p) => p.id === k.captions?.preset)?.label ?? "Custom captions"}</p>
              </KitOption>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-[#253244] pt-3">
            <Link href="/brand-kit?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.1]">
              <Plus className="h-3.5 w-3.5" /> New brand kit
            </Link>
            <button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[#94A3B8] hover:text-white">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
            </button>
          </div>
        </div>
      )}

      <BrandKitUpgradeModal open={upgrade} onClose={() => setUpgrade(false)} />
    </div>
  );
}

function KitOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "relative rounded-xl border p-2 text-left transition-colors",
        selected ? "border-[#54D045]/60 bg-[#54D045]/[0.06]" : "border-[#253244] hover:border-[#35445a]",
      )}
    >
      {selected && <Check className="absolute right-2 top-2 h-4 w-4 text-[#54D045]" aria-hidden />}
      {children}
    </button>
  );
}
