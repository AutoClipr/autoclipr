"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Download, LayoutGrid, List, Loader2, Minus, SearchX, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Clip } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { downloadFile, sanitizeFilename, sleep } from "@/lib/download";
import { ClipCard, clipDuration, clipScore } from "@/components/dashboard/clip-card";
import { ClipPlayerModal } from "@/components/dashboard/clip-player-modal";
import { PostClipModal } from "@/components/dashboard/post-clip-modal";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

type SortKey = "score" | "newest" | "oldest" | "longest" | "shortest";
type FilterKey = "all" | "selected" | "top" | "posted" | "unposted" | "processing";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "score", label: "Viral score: highest first" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "shortest", label: "Duration: shortest first" },
  { value: "longest", label: "Duration: longest first" },
];

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: "all", label: "All clips" },
  { value: "selected", label: "Selected clips" },
  { value: "posted", label: "Published clips" },
  { value: "unposted", label: "Unpublished clips" },
  { value: "top", label: "Top picks (75+)" },
  { value: "processing", label: "Processing" },
];

type ClipsListProps = {
  clips: Clip[];
  /** Total clips on the server (for pagination). */
  total?: number;
  /** Album view: only this video's clips (also used when loading more). */
  videoId?: string;
};

export function ClipsList({ clips: initialClips, total: initialTotal, videoId }: ClipsListProps) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [clips, setClips] = useState(initialClips);
  const [total, setTotal] = useState(initialTotal ?? initialClips.length);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [filterBy, setFilterBy] = useState<FilterKey>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [postClip, setPostClip] = useState<Clip | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Sync when the server re-renders with fresh data (e.g. after router.refresh).
  useEffect(() => {
    setClips(initialClips);
    setTotal(initialTotal ?? initialClips.length);
    setPage(1);
  }, [initialClips, initialTotal]);

  // Auto-refresh while any publication is pending so status syncs after posting.
  const hasPending = clips.some((c) =>
    c.publications?.some((p) => p.status === "pending" || p.status === "processing"),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!hasPending) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => router.refresh(), 5_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasPending, router]);

  const downloadableIds = useMemo(
    () => new Set(clips.filter((c) => c.status === "completed" && c.download_url).map((c) => c.id)),
    [clips],
  );

  const visibleClips = useMemo(() => {
    const score = (c: Clip) => clipScore(c) ?? -1;
    let list = clips;
    if (filterBy === "selected") list = list.filter((c) => selected.has(c.id));
    else if (filterBy === "top") list = list.filter((c) => score(c) >= 75);
    else if (filterBy === "posted") list = list.filter((c) => c.publications?.some((p) => p.status === "posted"));
    else if (filterBy === "unposted") list = list.filter((c) => !c.publications?.some((p) => p.status === "posted"));
    else if (filterBy === "processing") list = list.filter((c) => c.status !== "completed");

    const time = (c: Clip) => new Date(c.created_at ?? 0).getTime();
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return time(b) - time(a);
        case "oldest":
          return time(a) - time(b);
        case "longest":
          return clipDuration(b) - clipDuration(a);
        case "shortest":
          return clipDuration(a) - clipDuration(b);
        default:
          return score(b) - score(a);
      }
    });
  }, [clips, sortBy, filterBy, selected]);

  // The player walks the visible (sorted, filtered) clips that can play.
  const playable = useMemo(() => visibleClips.filter((c) => c.status === "completed" && c.download_url), [visibleClips]);
  const playerIndex = playerId ? playable.findIndex((c) => c.id === playerId) : -1;
  const openPlayer = useCallback((id: string) => setPlayerId(id), []);
  const openPost = useCallback((clip: Clip) => setPostClip(clip), []);

  async function downloadOne(clip: Clip) {
    if (!clip.download_url) return;
    setDownloadingId(clip.id);
    try {
      await downloadFile(clip.download_url, `${sanitizeFilename(clip.title)}.mp4`);
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  const topPickId = useMemo(() => {
    let best: Clip | null = null;
    for (const c of clips) {
      if (c.status !== "completed") continue;
      const s = clipScore(c);
      if (s == null) continue;
      if (!best || s > (clipScore(best) ?? -1)) best = c;
    }
    return best?.id ?? null;
  }, [clips]);

  const visibleIds = visibleClips.map((c) => c.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;
  const selectedDownloadable = [...selected].filter((id) => downloadableIds.has(id)).length;
  const busy = bulkLoading || deleteLoading;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }

  const toggleOne = useCallback((clipId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(clipId);
      else next.delete(clipId);
      return next;
    });
  }, []);

  const removeFromList = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setClips((prev) => prev.filter((c) => !idSet.has(c.id)));
    setTotal((t) => Math.max(0, t - ids.length));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const next = page + 1;
      const res = await apiFetch<Clip[]>(`/api/v1/clips?page=${next}&limit=${PAGE_SIZE}${videoId ? `&video_id=${videoId}` : ""}`, { token });
      if (!res.success || !res.data) {
        toast.error("Couldn't load more clips. Please try again.");
        return;
      }
      setClips((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...res.data!.filter((c) => !seen.has(c.id))];
      });
      if (res.meta?.total != null) setTotal(res.meta.total);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }

  async function bulkDownload() {
    const ids = [...selected].filter((id) => downloadableIds.has(id));
    if (!ids.length) return;

    setBulkLoading(true);
    const toastId = toast.loading(`Preparing ${ids.length} clip${ids.length === 1 ? "" : "s"}…`);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await apiFetch<{
        items: Array<{ id: string; title: string; download_url?: string | null }>;
      }>("/api/v1/clips/bulk-download", {
        method: "POST",
        token,
        body: JSON.stringify({ clip_ids: ids }),
      });

      if (!res.success || !res.data?.items?.length) {
        toast.error(res.error?.message ?? "Download failed.", { id: toastId });
        return;
      }

      for (const item of res.data.items) {
        if (!item.download_url) continue;
        await downloadFile(item.download_url, `${sanitizeFilename(item.title)}.mp4`);
        await sleep(400);
      }
      toast.success(`Downloaded ${res.data.items.length} clip${res.data.items.length === 1 ? "" : "s"}`, { id: toastId });
    } finally {
      setBulkLoading(false);
    }
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;

    const ok = await confirm({
      title: `Delete ${ids.length} clip${ids.length === 1 ? "" : "s"}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    setDeleteLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await apiFetch<{ deleted_ids: string[] }>("/api/v1/clips/bulk-delete", {
        method: "POST",
        token,
        body: JSON.stringify({ clip_ids: ids }),
      });

      if (!res.success || !res.data?.deleted_ids?.length) {
        toast.error(res.error?.message ?? "Failed to delete clips.");
        return;
      }

      removeFromList(res.data.deleted_ids);
      toast.success(`Deleted ${res.data.deleted_ids.length} clip${res.data.deleted_ids.length === 1 ? "" : "s"}`);
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  }

  const deleteOne = useCallback(
    async (clipId: string) => {
      const ok = await confirm({
        title: "Delete clip?",
        description: "This clip will be permanently deleted. This cannot be undone.",
        confirmLabel: "Delete",
      });
      if (!ok) return;

      const token = await getAccessToken();
      if (!token) return;

      const res = await apiFetch<{ deleted: boolean; id: string }>(`/api/v1/clips/${clipId}`, {
        method: "DELETE",
        token,
      });

      if (!res.success) {
        toast.error(res.error?.message ?? "Failed to delete clip.");
        return;
      }

      removeFromList([clipId]);
      toast.success("Clip deleted");
      router.refresh();
    },
    [confirm, removeFromList, router],
  );

  const hasMore = clips.length < total;

  return (
    <>
      {dialog}
      <div className="space-y-4">
        {/* Toolbar */}
        <div
          className={cn(
            "sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl border p-2 backdrop-blur-xl transition-colors duration-200",
            someSelected ? "border-[#54D045]/35 bg-[#0f1a14]/90" : "border-[#253244] bg-[#0B1220]/85",
          )}
        >
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-[#cbd5e1] transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border",
                allSelected || someSelected ? "border-[#54D045] bg-[#54D045] text-[#070B12]" : "border-[#475569]",
              )}
            >
              {allSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : someSelected ? <Minus className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          {someSelected ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-1 text-xs font-semibold text-[#a6ec9c]">{selected.size} selected</span>
              <button
                type="button"
                onClick={bulkDownload}
                disabled={selectedDownloadable === 0 || busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#54D045] px-3 text-xs font-semibold text-[#070B12] transition-colors hover:bg-[#62dc53] disabled:opacity-50"
              >
                {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download{selectedDownloadable ? ` (${selectedDownloadable})` : ""}
              </button>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#EF4444]/35 px-3 text-xs font-semibold text-[#fca5a5] transition-colors hover:bg-[#EF4444]/10 disabled:opacity-50"
              >
                {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete ({selected.size})
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                aria-label="Clear selection"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/[0.05] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <span className="px-1 text-xs text-[#94A3B8]">
              {visibleClips.length === clips.length
                ? `${total} clip${total === 1 ? "" : "s"}`
                : `${visibleClips.length} of ${clips.length} shown`}
            </span>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select label="Sort" value={sortBy} options={SORTS} onChange={setSortBy} />
            <Select label="Filter" value={filterBy} options={FILTERS} onChange={setFilterBy} />
            <div className="inline-flex h-9 rounded-lg border border-[#253244] bg-[#101824] p-0.5" role="radiogroup" aria-label="View">
              {([["grid", LayoutGrid], ["list", List]] as const).map(([v, Icon]) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} aria-label={`${v} view`} onClick={() => setView(v)}
                  className={cn("flex w-8 items-center justify-center rounded-md transition-colors", view === v ? "bg-[#253244] text-white" : "text-[#94A3B8] hover:text-white")}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        {visibleClips.length > 0 ? (
          <div className={cn(view === "grid" ? "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" : "grid gap-3 lg:grid-cols-2")}>
            {visibleClips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                selectable
                selected={selected.has(clip.id)}
                onSelectChange={toggleOne}
                onDelete={deleteOne}
                topPick={clip.id === topPickId}
                onOpen={openPlayer}
                onPost={openPost}
                layout={view}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#253244] px-6 py-14 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#253244] bg-[#101824]">
              <SearchX className="h-5 w-5 text-[#94A3B8]" />
            </span>
            <p className="font-medium text-[#F8FAFC]">No clips match this filter</p>
            <p className="mt-1 text-sm text-[#94A3B8]">Try a different filter to see more of your clips.</p>
            <button
              type="button"
              onClick={() => setFilterBy("all")}
              className="mt-5 h-9 rounded-lg border border-[#253244] px-4 text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.05]"
            >
              Clear filters
            </button>
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#253244] bg-[#101824] px-5 text-sm font-medium text-[#F8FAFC] transition-colors hover:border-[#35445a] disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              {loadingMore ? "Loading…" : `Load more (${total - clips.length} left)`}
            </button>
          </div>
        )}
      </div>

      {playerIndex >= 0 && (
        <ClipPlayerModal
          clips={playable}
          index={playerIndex}
          onIndexChange={(i) => setPlayerId(playable[i]?.id ?? null)}
          onClose={() => setPlayerId(null)}
          onPost={(clip) => {
            // Hand over to the publish dialog (it sits below the player).
            setPlayerId(null);
            setPostClip(clip);
          }}
          onDownload={(clip) => void downloadOne(clip)}
          downloadingId={downloadingId}
        />
      )}
      {postClip && <PostClipModal clip={postClip} open onClose={() => setPostClip(null)} />}
    </>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="relative inline-flex h-9 items-center rounded-lg border border-[#253244] bg-[#101824] pl-3 pr-7 text-xs transition-colors focus-within:border-[#54D045]/50 hover:border-[#35445a]">
      <span className="mr-1.5 hidden text-[#94A3B8] sm:inline">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={label}
        className="cursor-pointer appearance-none bg-transparent font-medium text-[#F8FAFC] outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#101824]">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#94A3B8]" />
    </label>
  );
}
