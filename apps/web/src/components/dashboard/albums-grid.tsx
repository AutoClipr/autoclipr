"use client";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Clock, Download, Film, FolderOpen, Loader2, MoreHorizontal, Search, SearchX, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, type Clip, type Video } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { deleteVideoWithToast } from "@/lib/delete-video";
import { downloadFile, sanitizeFilename, sleep } from "@/lib/download";
import { useConfirm } from "@/hooks/use-confirm";
import { useGenerateClips } from "@/components/dashboard/generate-clips-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatDuration } from "@/lib/utils";

const PAGE_SIZE = 24;
const NEW_FOR_MS = 48 * 60 * 60 * 1000;
const PROCESSING = new Set(["importing", "uploading", "processing", "analyzing"]);

type AlbumFilter = "all" | "recent" | "processing" | "completed";
type AlbumSort = "newest" | "oldest" | "clips" | "updated";

const FILTERS: { value: AlbumFilter; label: string }[] = [
  { value: "all", label: "All albums" },
  { value: "recent", label: "Recently created" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
];
const SORTS: { value: AlbumSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "clips", label: "Most clips" },
  { value: "updated", label: "Recently updated" },
];

type Album = Video & { updated_at?: string };

/**
 * The user's albums — one per source video — as a searchable grid. Data comes
 * from GET /videos (incl. real clip_count); "Load more" pages through it.
 */
export function AlbumsGrid({
  videos: initialVideos,
  hasMore: initialHasMore,
  planLabel,
}: {
  videos: Album[];
  hasMore: boolean;
  planLabel?: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [videos, setVideos] = useState<Album[]>(initialVideos.filter((v) => v.status !== "failed"));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AlbumFilter>("all");
  const [sort, setSort] = useState<AlbumSort>("newest");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const t = (s?: string) => new Date(s ?? 0).getTime();
    let list = videos;
    if (q) list = list.filter((v) => v.title.toLowerCase().includes(q));
    if (filter === "recent") list = list.filter((v) => Date.now() - t(v.created_at) < NEW_FOR_MS);
    else if (filter === "processing") list = list.filter((v) => PROCESSING.has(v.status));
    else if (filter === "completed") list = list.filter((v) => v.status === "ready");
    return [...list].sort((a, b) => {
      if (sort === "oldest") return t(a.created_at) - t(b.created_at);
      if (sort === "clips") return (b.clip_count ?? 0) - (a.clip_count ?? 0) || t(b.created_at) - t(a.created_at);
      if (sort === "updated") return t(b.updated_at ?? b.created_at) - t(a.updated_at ?? a.created_at);
      return t(b.created_at) - t(a.created_at);
    });
  }, [videos, query, filter, sort]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const next = page + 1;
      const res = await apiFetch<Album[]>(`/api/v1/videos?page=${next}&limit=${PAGE_SIZE}`, { token, skipGlobalLoader: true });
      if (!res.success || !res.data) return void toast.error("Couldn't load more albums. Please try again.");
      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...res.data!.filter((v) => !seen.has(v.id) && v.status !== "failed")];
      });
      setHasMore(!!res.meta?.has_more);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(video: Album) {
    const ok = await confirm({
      title: "Delete album?",
      description: `Delete "${video.title}" and all its clips? This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    if (await deleteVideoWithToast(video.id)) {
      setVideos((prev) => prev.filter((v) => v.id !== video.id));
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="albums-title">
      {dialog}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="albums-title" className="text-lg font-semibold text-white">Your albums</h2>
          <p className="mt-0.5 text-sm text-[#94A3B8]">Every video you&apos;ve processed, with the clips made from it.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#243144] bg-[#0D1623] px-3 py-1 text-xs font-medium text-[#cbd5e1]">
          <FolderOpen className="h-3.5 w-3.5 text-[#54D045]" aria-hidden />
          {videos.length}
          {hasMore ? "+" : ""} album{videos.length === 1 && !hasMore ? "" : "s"}
        </span>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-[#243144] bg-[#0D1623]/80 p-2 sm:flex-row sm:items-center">
        <label className="relative flex h-10 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[#64748B]" aria-hidden />
          <span className="sr-only">Search albums</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search albums by title"
            className="h-10 w-full rounded-xl border border-transparent bg-[#050817]/60 pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#64748B] focus:border-[#54D045]/50"
          />
        </label>
        <div className="flex gap-2">
          <Select label="Filter" value={filter} options={FILTERS} onChange={setFilter} />
          <Select label="Sort" value={sort} options={SORTS} onChange={setSort} />
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#243144] px-6 py-14 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#243144] bg-[#0D1623]">
            <Film className="h-6 w-6 text-[#54D045]" aria-hidden />
          </span>
          <p className="font-semibold text-white">No albums yet</p>
          <p className="mt-1 max-w-sm text-sm text-[#94A3B8]">Process a long video and its clips will be grouped into an album here.</p>
          <Link href="/create" className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#54D045] px-4 text-sm font-semibold text-[#050817] hover:bg-[#62dc53]">
            <Wand2 className="h-4 w-4" /> Create clips
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#243144] px-6 py-12 text-center">
          <SearchX className="mb-3 h-6 w-6 text-[#94A3B8]" aria-hidden />
          <p className="font-medium text-white">No albums match</p>
          <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-4 h-9 rounded-lg border border-[#243144] px-4 text-xs font-medium text-white hover:bg-white/[0.05]">
            Clear search and filters
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((v) => (
            <AlbumCard key={v.id} video={v} planLabel={planLabel} onDelete={remove} />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#243144] bg-[#0D1623] px-5 text-sm font-medium text-white hover:border-[#35445a] disabled:opacity-60">
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} {loadingMore ? "Loading…" : "Load more albums"}
          </button>
        </div>
      )}
    </section>
  );
}

const AlbumCard = memo(function AlbumCard({ video, planLabel, onDelete }: { video: Album; planLabel?: string; onDelete: (v: Album) => void }) {
  const href = `/clips/album/${video.id}`;
  const gen = useGenerateClips(video.id, video.status);
  const [imgOk, setImgOk] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const isNew = Date.now() - new Date(video.created_at).getTime() < NEW_FOR_MS;
  const processing = PROCESSING.has(video.status);
  const clips = video.clip_count ?? 0;

  /** Every completed clip in the album, through the existing bulk-download API. */
  async function downloadAll() {
    setDownloading(true);
    const toastId = toast.loading("Preparing clips…");
    try {
      const token = await getAccessToken();
      if (!token) return;
      const list = await apiFetch<Clip[]>(`/api/v1/clips?limit=100&video_id=${video.id}`, { token, skipGlobalLoader: true });
      const ids = (list.data ?? []).filter((c) => c.video_id === video.id && c.status === "completed").map((c) => c.id);
      if (!ids.length) return void toast.error("No finished clips to download yet.", { id: toastId });
      const res = await apiFetch<{ items: { id: string; title: string; download_url?: string | null }[] }>("/api/v1/clips/bulk-download", {
        method: "POST",
        token,
        body: JSON.stringify({ clip_ids: ids }),
      });
      if (!res.success || !res.data?.items?.length) return void toast.error(res.error?.message ?? "Download failed.", { id: toastId });
      let done = 0;
      for (const item of res.data.items) {
        if (!item.download_url) continue;
        await downloadFile(item.download_url, `${sanitizeFilename(item.title)}.mp4`);
        done++;
        await sleep(400);
      }
      toast.success(`Downloaded ${done} clip${done === 1 ? "" : "s"}`, { id: toastId });
    } catch {
      toast.error("Download failed. Please try again.", { id: toastId });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#243144] bg-[#0D1623] transition-all duration-300 focus-within:border-[#54D045]/50 hover:-translate-y-0.5 hover:border-[#54D045]/50 hover:shadow-[0_20px_44px_-24px_rgba(84,208,69,0.35)] motion-reduce:hover:translate-y-0">
      <Link href={href} aria-label={`Open album ${video.title}`} className="relative block aspect-video overflow-hidden rounded-t-2xl bg-[#050817] focus:outline-none">
        {video.thumbnail_url && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt="" loading="lazy" decoding="async" onError={() => setImgOk(false)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05] motion-reduce:transition-none" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center"><Film className="h-8 w-8 text-[#243144]" aria-hidden /></span>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100" />

        <span className="absolute left-2.5 top-2.5 flex gap-1.5">
          {processing ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold uppercase text-[#050817]">
              <Loader2 className="h-3 w-3 animate-spin" /> Processing
            </span>
          ) : isNew ? (
            <span className="rounded-full bg-[#54D045] px-2 py-0.5 text-[10px] font-bold uppercase text-[#050817]">New</span>
          ) : null}
        </span>
        {planLabel && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">{planLabel}</span>
        )}
        {video.duration_seconds ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur-sm">{formatDuration(video.duration_seconds)}</span>
        ) : null}

        {/* Hover actions */}
        <span className="absolute inset-x-2.5 bottom-2.5 flex justify-end gap-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-3 text-xs font-semibold text-[#050817]">
            Open album <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </span>
      </Link>

      <div className="flex items-start gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white" title={video.title}>
            <Link href={href} className="hover:text-[#8fe383]">{video.title}</Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-[#94A3B8]">
            <Clock className="h-3 w-3" aria-hidden />
            {video.duration_seconds ? formatDuration(video.duration_seconds) : "—"}
            <span>·</span>
            {clips} clip{clips === 1 ? "" : "s"}
            <span>·</span>
            {new Date(video.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </p>
        </div>

        {gen.canGenerate && (
          <button type="button" onClick={() => void gen.generate()} disabled={gen.loading} aria-label="Generate more clips" title="Generate more clips"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#54D045]/35 bg-[#54D045]/10 text-[#a6ec9c] transition-opacity hover:bg-[#54D045]/20 disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {gen.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`More actions for ${video.title}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#243144] text-[#cbd5e1] hover:border-[#35445a] hover:text-white">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href={href}><FolderOpen className="mr-2 h-4 w-4" /> Open album</Link>
            </DropdownMenuItem>
            {gen.canGenerate && (
              <DropdownMenuItem onSelect={() => void gen.generate()}>
                <Wand2 className="mr-2 h-4 w-4" /> Generate more clips
              </DropdownMenuItem>
            )}
            {clips > 0 && (
              <DropdownMenuItem onSelect={() => void downloadAll()} disabled={downloading}>
                <Download className="mr-2 h-4 w-4" /> Download all clips
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDelete(video)} className="text-rose-300 focus:bg-rose-500/10 focus:text-rose-200">
              <Trash2 className="mr-2 h-4 w-4" /> Delete album
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {gen.error && <p className="px-3.5 pb-3 text-xs text-rose-300">{gen.error}</p>}
    </li>
  );
});

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="relative inline-flex h-10 flex-1 items-center rounded-xl border border-[#243144] bg-[#050817]/60 pl-3 pr-8 text-xs sm:flex-none">
      <span className="mr-1.5 text-[#94A3B8]">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}
        className="min-w-0 cursor-pointer appearance-none bg-transparent font-medium text-white outline-none">
        {options.map((o) => <option key={o.value} value={o.value} className="bg-[#0D1623]">{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
    </label>
  );
}
