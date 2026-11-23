"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Crown, Film, ImageIcon, MoreHorizontal, Palette, Pencil, Plus, Sparkles, Star, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CAPTION_PRESETS, DEFAULT_COLORS, brandKitsApi, fontCss, fontWeightCss, type BrandKit } from "@/lib/brand-kits";
import { cn } from "@/lib/utils";
import { BrandKitEditor } from "./brand-kit-editor";
import { BrandPreview, Swatches } from "./brand-preview";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function BrandKitManager({ startNew = false }: { startNew?: boolean }) {
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  const [limit, setLimit] = useState(0);
  const [planName, setPlanName] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrandKit | "new" | null>(startNew ? "new" : null);
  const [toDelete, setToDelete] = useState<BrandKit | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [res, ent] = await Promise.all([brandKitsApi.list(), brandKitsApi.entitlement().catch(() => null)]);
      setKits(res.items);
      setLimit(res.limit);
      if (ent) setPlanName(ent.planName);
    } catch (e) {
      toast.error((e as Error).message);
      setKits([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const atLimit = kits != null && kits.length >= limit;
  const defaultKit = kits?.find((k) => k.is_default) ?? null;

  function startCreate() {
    if (atLimit) return toast.error(`Your plan includes up to ${limit} brand kits. Delete one or upgrade for more.`);
    setEditing("new");
  }

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <header className="mx-auto max-w-[1200px]">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#54D045]">BRAND STUDIO</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">{editing === "new" ? "Create brand kit" : `Edit ${editing.name}`}</h1>
        </header>
        <BrandKitEditor
          kit={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-7">
      {/* Header */}
      <header className="relative overflow-hidden rounded-3xl border border-[#263244] bg-gradient-to-br from-[#151F2E] via-[#101827] to-[#050817] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#8B5CF6]/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-10 -bottom-24 h-56 w-56 rounded-full bg-[#54D045]/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#54D045]">BRAND STUDIO</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Your Brand Studio</h1>
            <p className="mt-2 max-w-xl text-sm text-[#9299A8] sm:text-base">
              Manage your visual identity and create consistent branded videos across every platform.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {planName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                <Crown className="h-3.5 w-3.5" aria-hidden /> {planName} plan
              </span>
            )}
            {kits && (
              <span className="rounded-full border border-[#263244] bg-[#101827] px-3 py-1.5 text-xs font-medium tabular-nums text-[#cbd5e1]">
                {kits.length} / {limit} kits used
              </span>
            )}
            <button type="button" onClick={startCreate} disabled={atLimit}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#54D045] px-5 text-sm font-semibold text-[#050817] shadow-[0_10px_30px_-10px_rgba(84,208,69,0.7)] transition-colors hover:bg-[#62dc53] disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" /> Create Brand Kit
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      {kits && kits.length > 0 && (
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat icon={Palette} label="Total brand kits" value={`${kits.length}`} hint={`of ${limit} on your plan`} />
          <Stat icon={Star} label="Default brand kit" value={defaultKit?.name ?? "None"} hint="Preselected when you create clips" />
          <Stat icon={Crown} label="Current plan" value={planName ?? "—"} hint="Brand kits on Creator, Pro & Business" />
        </dl>
      )}

      {kits == null ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading brand kits">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-3xl border border-[#263244] bg-[#101827]">
              <div className="h-48 animate-pulse bg-[#151F2E] motion-reduce:animate-none" />
              <div className="space-y-2 p-5">
                <div className="h-4 w-2/3 animate-pulse rounded bg-[#151F2E]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[#151F2E]" />
              </div>
            </div>
          ))}
        </div>
      ) : kits.length === 0 ? (
        <EmptyState onCreate={startCreate} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {kits.map((k) => (
            <KitCard
              key={k.id}
              kit={k}
              busy={busy === k.id}
              canDuplicate={!atLimit}
              onEdit={() => setEditing(k)}
              onDuplicate={() => act(k.id, () => brandKitsApi.duplicate(k.id), "Brand kit duplicated.")}
              onDefault={() => act(k.id, () => brandKitsApi.setDefault(k.id), `${k.name} is now your default.`)}
              onDelete={() => setToDelete(k)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.name ?? "brand kit"}?`}
        description="Its logo, intro and outro files are removed too (unless another kit uses them). Clips you already made are not affected."
        loading={busy === toDelete?.id}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const k = toDelete!;
          await act(k.id, () => brandKitsApi.remove(k.id), "Brand kit deleted.");
          setToDelete(null);
        }}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Palette; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#263244] bg-[#101827] p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#54D045]/10 ring-1 ring-[#54D045]/25">
        <Icon className="h-5 w-5 text-[#54D045]" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-[#9299A8]">{label}</dt>
        <dd className="truncate text-lg font-semibold text-white">{value}</dd>
        <p className="truncate text-[11px] text-[#64748B]">{hint}</p>
      </div>
    </div>
  );
}

function KitCard({ kit: k, busy, canDuplicate, onEdit, onDuplicate, onDefault, onDelete }: {
  kit: BrandKit; busy: boolean; canDuplicate: boolean;
  onEdit: () => void; onDuplicate: () => void; onDefault: () => void; onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const colors = { ...DEFAULT_COLORS, ...k.colors };
  const caption = CAPTION_PRESETS.find((p) => p.id === k.captions?.preset)?.label ?? "Custom";

  return (
    <li
      className={cn(
        "group flex flex-col overflow-hidden rounded-3xl border bg-[#101827] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-28px_rgba(84,208,69,0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        k.is_default ? "border-[#54D045]/50" : "border-[#263244] hover:border-[#54D045]/40",
      )}
    >
      {/* Brand banner */}
      <button type="button" onClick={onEdit} aria-label={`Edit ${k.name}`} className="relative flex h-48 items-center gap-4 overflow-hidden px-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#54D045]/60"
        style={{ background: `linear-gradient(135deg, ${colors.secondary}, ${colors.background} 60%, ${colors.primary}33)` }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl" style={{ background: `${colors.primary}40` }} aria-hidden />
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
          {k.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.logo_url} alt="" className="h-20 w-20 object-contain" />
          ) : (
            <span className="text-3xl font-black" style={{ color: colors.primary, fontFamily: fontCss(k.typography?.heading_font) }}>{k.name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="relative min-w-0 flex-1">
          <p className="truncate text-xl text-white" style={{ fontFamily: fontCss(k.typography?.heading_font), fontWeight: fontWeightCss(k.typography?.heading_font) }}>{k.name}</p>
          <div className="mt-3 w-20">
            <BrandPreview captions={k.captions} colors={colors} logo={k.logo} logoUrl={k.logo_url} captionFont={k.typography?.caption_font} className="rounded-lg border-white/20 shadow-lg" />
          </div>
        </div>
        {k.is_default && (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#54D045] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#050817]">
            <Check className="h-3 w-3" /> Default
          </span>
        )}
      </button>

      {/* Details */}
      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-2 min-h-[40px] text-sm text-[#9299A8]">{k.description || "No description"}</p>
        <Swatches colors={colors} size="h-5 w-5" className="mt-4" />
        <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
          <Chip icon={ImageIcon} on={!!k.logo_path}>{k.logo_path ? "Logo" : "No logo"}</Chip>
          <Chip icon={Type} on>{caption}</Chip>
          <Chip icon={Film} on={k.intro_enabled}>Intro {k.intro_enabled ? "on" : "off"}</Chip>
          <Chip icon={Film} on={k.outro_enabled}>Outro {k.outro_enabled ? "on" : "off"}</Chip>
        </div>
        <p className="mt-4 text-[11px] text-[#64748B]">Updated {fmt(k.updated_at)}</p>

        <div className="mt-4 flex items-center gap-2 border-t border-[#263244] pt-4">
          <button type="button" onClick={onEdit} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-semibold text-[#050817] hover:bg-white/90">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" onClick={onDuplicate} disabled={busy || !canDuplicate} title={canDuplicate ? "Duplicate" : "Plan limit reached"}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#263244] px-3 text-xs font-medium text-[#cbd5e1] hover:bg-white/[0.04] disabled:opacity-40">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          {!k.is_default && (
            <button type="button" onClick={onDefault} disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#263244] px-3 text-xs font-medium text-[#cbd5e1] hover:bg-white/[0.04] disabled:opacity-40">
              <Star className="h-3.5 w-3.5" /> Set default
            </button>
          )}
          <div ref={menuRef} className="relative ml-auto">
            <button type="button" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="More options"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#263244] text-[#9299A8] hover:text-white">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu && (
              <div role="menu" className="absolute bottom-11 right-0 z-20 w-40 overflow-hidden rounded-xl border border-[#263244] bg-[#151F2E] p-1 shadow-2xl">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onDelete(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Chip({ icon: Icon, on, children }: { icon: typeof Film; on: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium", on ? "border-[#54D045]/25 bg-[#54D045]/10 text-[#a6ec9c]" : "border-[#263244] text-[#9299A8]")}>
      <Icon className="h-3 w-3" aria-hidden /> {children}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const benefits = ["Your logo on every clip", "Captions in your fonts and colours", "Intro and outro added automatically", "Reuse across every video"];
  return (
    <div className="grid items-center gap-8 overflow-hidden rounded-3xl border border-[#263244] bg-gradient-to-br from-[#101827] to-[#050817] p-6 sm:p-10 md:grid-cols-[1fr_260px]">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8B5CF6]/15 px-3 py-1 text-xs font-semibold text-[#c4b5fd]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Brand Studio
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">Build your visual identity.</h2>
        <p className="mt-2 max-w-md text-sm text-[#9299A8] sm:text-base">Create your first Brand Kit and give every video a consistent, professional look.</p>
        <ul className="mt-5 grid gap-2 text-sm text-[#cbd5e1] sm:grid-cols-2">
          {benefits.map((b) => (
            <li key={b} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#54D045]" aria-hidden /> {b}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onCreate} className="mt-7 inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#54D045] px-5 text-sm font-semibold text-[#050817] hover:bg-[#62dc53]">
          <Plus className="h-4 w-4" /> Create Brand Kit
        </button>
      </div>
      <BrandPreview
        captions={{ preset: "bold_highlight", size: 80, max_words: 3 }}
        colors={DEFAULT_COLORS}
        logo={{ position: "top-left", size: 16 }}
        logoUrl={null}
        name="Your brand"
        headingFont="Montserrat Black"
        captionFont="Montserrat Black"
        className="mx-auto max-w-[240px]"
      />
    </div>
  );
}
