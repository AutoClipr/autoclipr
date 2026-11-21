"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CAPTION_PRESETS, brandKitsApi, type BrandKit } from "@/lib/brand-kits";
import { cn } from "@/lib/utils";
import { BrandKitEditor } from "./brand-kit-editor";
import { BrandPreview, Swatches } from "./brand-preview";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function BrandKitManager({ startNew = false }: { startNew?: boolean }) {
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  const [limit, setLimit] = useState(0);
  const [editing, setEditing] = useState<BrandKit | "new" | null>(startNew ? "new" : null);
  const [toDelete, setToDelete] = useState<BrandKit | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await brandKitsApi.list();
      setKits(res.items);
      setLimit(res.limit);
    } catch (e) {
      toast.error((e as Error).message);
      setKits([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const atLimit = kits != null && kits.length >= limit;

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
      <div className="space-y-5">
        <header>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">BRAND KIT</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#F8FAFC]">{editing === "new" ? "Create brand kit" : `Edit ${editing.name}`}</h1>
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
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">BRAND KIT</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[#F8FAFC]">Your Brand Kits</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#94A3B8]">
            Create and manage your brand identity. Apply consistent logos, colours, typography, and captions to every video you create.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={() => (atLimit ? toast.error(`Your plan includes up to ${limit} brand kits. Delete one or upgrade for more.`) : setEditing("new"))}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]"
          >
            <Plus className="h-4 w-4" /> Create New Brand Kit
          </button>
          {kits && <span className="text-xs text-[#64748B]">{kits.length} of {limit} used</span>}
        </div>
      </header>

      {kits == null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl border border-[#253244] bg-[#101824]" />)}
        </div>
      ) : kits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#253244] bg-[#101824] p-10 text-center">
          <p className="text-lg font-semibold text-[#F8FAFC]">No brand kits yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#94A3B8]">Add your logo, colours and caption style once — then apply them to any video in one click.</p>
          <button type="button" onClick={() => setEditing("new")} className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]">
            <Plus className="h-4 w-4" /> Create your first brand kit
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kits.map((k) => (
            <li key={k.id} className={cn("flex flex-col overflow-hidden rounded-2xl border bg-[#101824]", k.is_default ? "border-[#54D045]/50" : "border-[#253244]")}>
              <div className="flex gap-4 p-4">
                <BrandPreview captions={k.captions} colors={k.colors} logo={k.logo} logoUrl={k.logo_url} captionFont={k.typography?.caption_font} className="w-24 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {k.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={k.logo_url} alt="" className="h-7 w-7 rounded-md bg-white/5 object-contain" />
                    )}
                    <p className="truncate font-semibold text-[#F8FAFC]">{k.name}</p>
                  </div>
                  {k.is_default && <span className="mt-1.5 inline-block rounded-md bg-[#54D045]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a6ec9c]">Default</span>}
                  <Swatches colors={k.colors} className="mt-3" />
                  <p className="mt-3 text-xs text-[#94A3B8]">Captions: {CAPTION_PRESETS.find((p) => p.id === k.captions?.preset)?.label ?? "Custom"}</p>
                  <p className="text-xs text-[#94A3B8]">Intro {k.intro_enabled ? "on" : "off"} · Outro {k.outro_enabled ? "on" : "off"}</p>
                  <p className="mt-1 text-[11px] text-[#64748B]">Updated {fmt(k.updated_at)}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center gap-1 border-t border-[#253244] p-2">
                <IconBtn label="Edit" onClick={() => setEditing(k)}><Pencil className="h-4 w-4" /></IconBtn>
                <IconBtn label="Duplicate" disabled={busy === k.id || atLimit} onClick={() => act(k.id, () => brandKitsApi.duplicate(k.id), "Brand kit duplicated.")}><Copy className="h-4 w-4" /></IconBtn>
                {!k.is_default && (
                  <IconBtn label="Set as default" disabled={busy === k.id} onClick={() => act(k.id, () => brandKitsApi.setDefault(k.id), `${k.name} is now your default.`)}><Star className="h-4 w-4" /></IconBtn>
                )}
                <IconBtn label="Delete" className="ml-auto hover:text-red-300" onClick={() => setToDelete(k)}><Trash2 className="h-4 w-4" /></IconBtn>
              </div>
            </li>
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

function IconBtn({ label, onClick, disabled, className, children }: { label: string; onClick: () => void; disabled?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#94A3B8] hover:bg-white/[0.04] hover:text-white disabled:opacity-40", className)}>
      {children}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}
