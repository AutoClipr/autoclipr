"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";
import {
  ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Eye, Loader2, Search, TrendingUp, Users, Video, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types & config ────────────────────────────────────────────────────── */

type Sort = "rank" | "subscribers" | "views" | "videos";

export type CreatorEntry = {
  channelId: string;
  handle: string | null;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  country: string | null;
  category: string;
  subscribers: number | null;
  views: number | null;
  videos: number | null;
  publishedAt: string | null;
  globalRank: number | null;
  categoryRank: number | null;
  position: number;
};

type Leaderboard = {
  items: CreatorEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  trackedChannels: number;
  categories: { name: string; count: number }[];
  lastRefreshedAt: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const PAGE_SIZE = 20;
/** Row index (within the table) the promo CTA is inserted before. */
const INLINE_CTA_AT = 7;
/** Shown even before data arrives; real counts come from the API. */
const DEFAULT_CATEGORIES = ["Entertainment", "Music", "Kids", "Technology", "Sports", "News"];

const SORTS: { key: Sort; label: string; icon: typeof Users }[] = [
  { key: "rank", label: "Rank", icon: TrendingUp },
  { key: "subscribers", label: "Subscribers", icon: Users },
  { key: "views", label: "Views", icon: Eye },
  { key: "videos", label: "Videos", icon: Video },
];

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function fmt(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function flag(code: string | null): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return [...code.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

export const channelHref = (c: Pick<CreatorEntry, "name" | "channelId">) =>
  `/top-creators/${encodeURIComponent(c.name.toLowerCase().replace(/\s+/g, "-"))}?id=${c.channelId}`;

const youtubeUrl = (c: Pick<CreatorEntry, "handle" | "channelId">) =>
  c.handle ? `https://www.youtube.com/${c.handle}` : `https://www.youtube.com/channel/${c.channelId}`;

function Highlight({ text, q }: { text: string; q: string }) {
  const needle = q.trim().replace(/^@/, "");
  const i = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-[#54D045]/25 px-0.5 text-[#F8FAFC]">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

const GRADS = ["from-[#54D045] to-[#35D6E8]", "from-violet-500 to-purple-500", "from-orange-500 to-red-500", "from-blue-500 to-indigo-500", "from-pink-500 to-rose-500"];

function Avatar({ name, src, className }: { name: string; src: string | null; className: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={cn(className, "shrink-0 rounded-full border border-white/10 object-cover")}
      />
    );
  }
  return (
    <div aria-hidden className={cn(className, "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white", GRADS[name.charCodeAt(0) % GRADS.length])}>
      {name.charAt(0)}
    </div>
  );
}

/* ─── Podium ────────────────────────────────────────────────────────────── */

const PODIUM = [
  { ring: "from-yellow-300 to-amber-500", glow: "bg-yellow-400/25", badge: "from-yellow-300 to-amber-500 text-black", card: "border-yellow-400/25 lg:-translate-y-5", label: "Gold" },
  { ring: "from-slate-200 to-slate-400", glow: "bg-slate-300/15", badge: "from-slate-200 to-slate-400 text-black", card: "border-[#253244]", label: "Silver" },
  { ring: "from-orange-300 to-orange-600", glow: "bg-orange-500/20", badge: "from-orange-300 to-orange-600 text-white", card: "border-[#253244]", label: "Bronze" },
];

function PodiumCard({ c, place, q, onOpen }: { c: CreatorEntry; place: number; q: string; onOpen: (c: CreatorEntry, from: string) => void }) {
  const st = PODIUM[place];
  return (
    <button
      type="button"
      onClick={() => onOpen(c, "podium")}
      aria-label={`${c.name}, position ${c.position}. View channel details`}
      className={cn(
        "group relative flex w-full flex-col items-center overflow-hidden rounded-3xl border bg-[#101824]/80 px-5 pb-6 pt-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#54D045]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60",
        st.card,
      )}
    >
      <span className={cn("pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl", st.glow)} />
      <span title={st.label} className={cn("absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-extrabold shadow-lg", st.badge)}>
        {c.position}
      </span>
      <span className={cn("relative rounded-full bg-gradient-to-br p-[3px]", st.ring)}>
        <Avatar name={c.name} src={c.avatarUrl} className={place === 0 ? "h-24 w-24 text-3xl" : "h-20 w-20 text-2xl"} />
      </span>
      <span className="relative mt-4 text-lg font-bold text-[#F8FAFC]"><Highlight text={c.name} q={q} /></span>
      <span className="relative text-xs text-[#94A3B8]">{[flag(c.country), c.category].filter(Boolean).join(" · ")}</span>
      <span className="relative mt-4 text-3xl font-extrabold tabular-nums tracking-tight text-[#F8FAFC]">{fmt(c.subscribers)}</span>
      <span className="relative text-[11px] uppercase tracking-widest text-[#64748B]">{c.subscribers == null ? "subscribers hidden" : "subscribers"}</span>
      <span className="relative mt-4 flex w-full justify-center gap-8 border-t border-[#253244] pt-4 text-sm">
        <span><span className="block font-semibold tabular-nums text-[#F8FAFC]">{fmt(c.views)}</span><span className="text-[10px] text-[#64748B]">views</span></span>
        <span><span className="block font-semibold tabular-nums text-[#F8FAFC]">{fmt(c.videos)}</span><span className="text-[10px] text-[#64748B]">videos</span></span>
      </span>
    </button>
  );
}

/* ─── Detail drawer ─────────────────────────────────────────────────────── */

function CreatorDrawer({ c, onClose }: { c: CreatorEntry; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const stats = [
    { label: "Subscribers", value: c.subscribers == null ? "Hidden" : fmt(c.subscribers) },
    { label: "Total views", value: fmt(c.views) },
    { label: "Videos", value: fmt(c.videos) },
    { label: "Global rank", value: c.globalRank ? `#${c.globalRank}` : "—" },
  ];

  return (
    <div className="fixed inset-0 z-[130] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="creator-drawer-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[#253244] bg-[#0B1220] p-6 shadow-2xl">
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close details" className="absolute right-4 top-4 rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/[0.06] hover:text-[#F8FAFC]">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-4 pr-8">
          <Avatar name={c.name} src={c.avatarUrl} className="h-16 w-16 text-xl" />
          <div className="min-w-0">
            <h2 id="creator-drawer-title" className="truncate text-xl font-bold text-[#F8FAFC]">{c.name}</h2>
            <p className="truncate text-sm text-[#94A3B8]">{[c.handle, c.category, flag(c.country) && `${flag(c.country)} ${c.country}`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[#253244] bg-[#101824] p-3">
              <p className="text-lg font-semibold tabular-nums text-[#F8FAFC]">{s.value}</p>
              <p className="text-xs text-[#94A3B8]">{s.label}</p>
            </div>
          ))}
        </div>

        {c.publishedAt && (
          <p className="mt-4 text-sm text-[#94A3B8]">
            On YouTube since {new Date(c.publishedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        )}
        {c.description && <p className="mt-4 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-[#cbd5e1]">{c.description}</p>}

        <div className="mt-auto space-y-2.5 pt-8">
          <Link
            href="/create"
            onClick={() => track("creator_clip_cta_clicked", { channel_id: c.channelId })}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#54D045] text-sm font-semibold text-[#070B12] transition-colors hover:bg-[#62dc53]"
          >
            Create shorts from this creator&apos;s videos <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-center text-[11px] text-[#64748B]">You choose the video and paste its link. Only clip content you have the rights to use.</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href={channelHref(c)} className="flex h-10 items-center justify-center rounded-xl border border-[#253244] text-sm text-[#F8FAFC] hover:bg-white/[0.04]">
              Full stats
            </Link>
            <a
              href={youtubeUrl(c)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("creator_channel_opened", { channel_id: c.channelId })}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#253244] text-sm text-[#F8FAFC] hover:bg-white/[0.04]"
            >
              YouTube <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export function TopCreatorsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const initialSort = (SORTS.some((s) => s.key === params.get("sort")) ? params.get("sort") : "rank") as Sort;
  const [sort, setSort] = useState<Sort>(initialSort);
  const [category, setCategory] = useState<string>(params.get("category") ?? "All");
  const [input, setInput] = useState(params.get("q") ?? "");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [page, setPage] = useState(Math.max(1, Number(params.get("page")) || 1));
  const [data, setData] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<CreatorEntry | null>(null);
  const cache = useRef(new Map<string, Leaderboard>());
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => { track("top_creators_page_view"); }, []);

  // Debounce typing → query.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = input.trim();
      if (next === q) return;
      setQ(next);
      setPage(1);
      if (next.length >= 2) track("creator_search", { length: next.length });
    }, 300);
    return () => clearTimeout(t);
  }, [input, q]);

  // Keep shareable state in the URL (canonical stays /top-creators).
  useEffect(() => {
    const sp = new URLSearchParams();
    if (sort !== "rank") sp.set("sort", sort);
    if (category !== "All") sp.set("category", category);
    if (q) sp.set("q", q);
    if (page > 1) sp.set("page", String(page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [sort, category, q, page, pathname, router]);

  // Fetch the current view (memoised per query, aborted when superseded).
  useEffect(() => {
    const sp = new URLSearchParams({ sort, page: String(page), pageSize: String(PAGE_SIZE) });
    if (category !== "All") sp.set("category", category);
    if (q) sp.set("q", q);
    const key = sp.toString();
    const hit = cache.current.get(key);
    if (hit) { setData(hit); setLoading(false); setError(false); return; }

    const ctrl = new AbortController();
    setLoading(true);
    fetch(`${API_URL}/api/v1/creators?${key}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { data?: Leaderboard }) => {
        if (!body.data) throw new Error("empty");
        cache.current.set(key, body.data);
        setData(body.data);
        setError(false);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(true);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [sort, category, q, page]);

  const openCreator = useCallback((c: CreatorEntry, from: string) => {
    track("creator_card_clicked", { channel_id: c.channelId, from });
    setOpen(c);
  }, []);

  const categories = useMemo(() => {
    const counts = new Map((data?.categories ?? []).map((c) => [c.name, c.count]));
    const names = [...DEFAULT_CATEGORIES, ...[...counts.keys()].filter((n) => !DEFAULT_CATEGORIES.includes(n))];
    return [{ name: "All", count: data?.trackedChannels }, ...names.map((n) => ({ name: n, count: counts.get(n) ?? (data ? 0 : undefined) }))];
  }, [data]);

  const items = data?.items ?? [];
  // Podium only on the first page of an unsearched view with enough results.
  const showPodium = page === 1 && !q && items.length >= 3;
  const podium = showPodium ? items.slice(0, 3) : [];
  const rows = items.slice(podium.length);

  const goPage = (p: number) => {
    setPage(p);
    track("leaderboard_pagination", { page: p });
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sortLabel = sort === "rank" || sort === "subscribers" ? "subscribers" : sort;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B12] pt-2">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-48 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[#54D045]/[0.08] blur-[130px]" />
        <div className="absolute right-0 top-40 h-[300px] w-[400px] rounded-full bg-[#35D6E8]/[0.05] blur-[120px]" />
        <div
          className="absolute inset-x-0 top-0 h-[560px] opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at top, black 20%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6">
        {/* ── Hero ── */}
        <header className="text-center">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#253244] bg-[#101824]/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#cbd5e1]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#54D045] shadow-[0_0_6px_2px_rgba(84,208,69,0.6)]" />
            Live stats · Refreshed daily
          </p>
          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-extrabold tracking-tight text-[#F8FAFC] sm:text-6xl lg:text-7xl">
            Top YouTube creators{" "}
            <span className="bg-gradient-to-r from-[#54D045] to-[#35D6E8] bg-clip-text text-transparent">by subscribers</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#94A3B8] sm:text-lg">
            Discover the world&apos;s leading YouTube creators. Explore channel rankings, views, uploads, and category trends. Find inspiration for your next viral short with AutoClipr.
          </p>
          <p className="mt-3 text-xs text-[#64748B]" aria-live="polite">
            {data
              ? `${data.trackedChannels} tracked channels · ${data.lastRefreshedAt ? `last updated ${ago(data.lastRefreshedAt)}` : "first refresh pending"}`
              : " "}
          </p>

          <div className="relative mx-auto mt-7 max-w-xl" role="search">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <label htmlFor="creator-search" className="sr-only">Find a YouTube channel</label>
            <input
              id="creator-search"
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Find a YouTube channel..."
              autoComplete="off"
              className="w-full rounded-2xl border border-[#253244] bg-[#0A111B] py-3.5 pl-11 pr-11 text-sm text-[#F8FAFC] outline-none transition placeholder:text-[#64748B] focus:border-[#54D045]/50 focus:ring-2 focus:ring-[#54D045]/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {loading && input.trim() !== q ? (
              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#54D045]" />
            ) : input ? (
              <button type="button" onClick={() => { setInput(""); setQ(""); setPage(1); }} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#64748B] hover:text-[#F8FAFC]">
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <p className="mt-2 text-center text-[11px] text-[#64748B]">Search by channel name, @handle or channel ID</p>
          </div>
        </header>

        {/* ── Controls ── */}
        <div className="mt-12 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div role="tablist" aria-label="Rank by" className="flex w-max items-center gap-1 rounded-full border border-[#253244] bg-[#101824]/80 p-1">
              {SORTS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={sort === key}
                  onClick={() => { if (sort === key) return; setSort(key); setPage(1); track("creator_sort_changed", { sort: key }); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                    sort === key ? "bg-[#F8FAFC] text-[#070B12] shadow" : "text-[#94A3B8] hover:text-[#F8FAFC]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 xl:pb-0" aria-label="Category">
            {categories.map((c) => (
              <button
                key={c.name}
                aria-pressed={category === c.name}
                onClick={() => { if (category === c.name) return; setCategory(c.name); setPage(1); track("creator_category_selected", { category: c.name }); }}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  category === c.name ? "border-[#54D045]/50 bg-[#54D045]/15 text-[#bdf5b4]" : "border-[#253244] text-[#94A3B8] hover:text-[#F8FAFC]",
                )}
              >
                {c.name}
                {c.count != null && <span className="ml-1.5 text-[11px] tabular-nums opacity-60">{c.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── States ── */}
        {error && !data && (
          <div className="mt-14 rounded-2xl border border-[#253244] bg-[#101824] p-8 text-center" role="alert">
            <p className="font-semibold text-[#F8FAFC]">Rankings are temporarily unavailable.</p>
            <p className="mt-1 text-sm text-[#94A3B8]">Please try again in a moment.</p>
          </div>
        )}
        {!data && loading && (
          <div className="mt-14 grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Loading rankings">
            {[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-3xl border border-[#253244] bg-[#101824]/60" />)}
          </div>
        )}

        <div className={cn("transition-opacity", loading && data && "opacity-60")}>
          {/* ── Podium ── */}
          {podium.length === 3 && (
            <div className="mt-14 grid gap-4 sm:grid-cols-3 lg:items-end">
              <div className="sm:order-2"><PodiumCard c={podium[0]} place={0} q={q} onOpen={openCreator} /></div>
              <div className="sm:order-1"><PodiumCard c={podium[1]} place={1} q={q} onOpen={openCreator} /></div>
              <div className="sm:order-3"><PodiumCard c={podium[2]} place={2} q={q} onOpen={openCreator} /></div>
            </div>
          )}

          {/* ── Table ── */}
          {rows.length > 0 && (
            <div ref={tableRef} className="mt-8 scroll-mt-24 overflow-hidden rounded-3xl border border-[#253244] bg-[#101824]/70">
              <div className="hidden grid-cols-[64px_1fr_110px_110px_90px_36px] items-center gap-3 border-b border-[#253244] px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#64748B] sm:grid">
                <div>#</div>
                <div>Channel</div>
                <div className="text-right">Subscribers</div>
                <div className="text-right">Views</div>
                <div className="text-right">Videos</div>
                <div><span className="sr-only">Action</span></div>
              </div>
              <ul className="divide-y divide-[#253244]/60">
                {rows.map((c, i) => (
                  <li key={c.channelId}>
                    {i === INLINE_CTA_AT && page === 1 && (
                      <div className="flex flex-col gap-3 bg-gradient-to-r from-[#54D045]/[0.10] to-[#35D6E8]/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-[#F8FAFC]">See a creator you want to beat?</p>
                          <p className="text-sm text-[#94A3B8]">Clip their best moments — start in 30 seconds.</p>
                        </div>
                        <Link
                          href="/register"
                          className="group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#54D045] px-4 py-2 text-sm font-semibold text-[#070B12] transition-colors hover:bg-[#62dc53]"
                        >
                          Start free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openCreator(c, "table")}
                      aria-label={`${c.name}, position ${c.position}. View channel details`}
                      className="group grid w-full grid-cols-[44px_1fr_auto_20px] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:bg-white/[0.05] sm:grid-cols-[64px_1fr_110px_110px_90px_36px] sm:px-5"
                    >
                      <span className="text-sm font-semibold tabular-nums text-[#64748B] group-hover:text-[#F8FAFC]">
                        #{c.position}
                        {sort !== "rank" && sort !== "subscribers" && c.globalRank && (
                          <span className="block text-[10px] font-normal text-[#475569]" title="Global rank by subscribers">G#{c.globalRank}</span>
                        )}
                      </span>
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={c.name} src={c.avatarUrl} className="h-11 w-11" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[#F8FAFC]"><Highlight text={c.name} q={q} /></span>
                          <span className="block truncate text-xs text-[#94A3B8]">{[flag(c.country), c.category].filter(Boolean).join(" · ")}</span>
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums text-[#F8FAFC]">{fmt(sort === "views" ? c.views : sort === "videos" ? c.videos : c.subscribers)}</span>
                        <span className="text-[10px] text-[#64748B] sm:hidden">{sortLabel === "subscribers" ? "subs" : sortLabel}</span>
                      </span>
                      <span className={cn("hidden text-right tabular-nums sm:block", sort === "views" ? "font-semibold text-[#F8FAFC]" : "text-[#cbd5e1]")}>{fmt(c.views)}</span>
                      <span className={cn("hidden text-right tabular-nums sm:block", sort === "videos" ? "font-semibold text-[#F8FAFC]" : "text-[#cbd5e1]")}>{fmt(c.videos)}</span>
                      <span className="flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-[#475569] transition-all group-hover:bg-[#54D045]/15 group-hover:text-[#54D045]">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="border-t border-[#253244] px-5 py-2.5 text-[11px] text-[#64748B]">
                “—” means YouTube doesn&apos;t publish that figure for the channel.{" "}
                {sort === "rank" ? "Ranked by subscribers." : `Sorted by ${sortLabel}; G# is the global subscriber rank.`}
              </p>
            </div>
          )}

          {/* ── Empty ── */}
          {data && data.total === 0 && (
            <div className="mt-14 rounded-2xl border border-[#253244] bg-[#101824] p-8 text-center">
              <p className="font-semibold text-[#F8FAFC]">
                {q ? <>No tracked channels match &ldquo;{q}&rdquo;{category !== "All" && <> in {category}</>}.</> : <>No channels in {category} yet.</>}
              </p>
              <p className="mt-1 text-sm text-[#94A3B8]">This leaderboard covers {data.trackedChannels} tracked channels.</p>
              {q.length >= 3 && (
                <Link href={`/top-creators/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, "-"))}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#54D045] hover:underline">
                  Look up &ldquo;{q}&rdquo; on YouTube <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}

          {/* ── Pagination ── */}
          {data && data.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between gap-3 text-sm" aria-label="Leaderboard pages">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goPage(page - 1)}
                className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#253244] px-3 text-[#F8FAFC] disabled:opacity-40 hover:enabled:bg-white/[0.04]"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="tabular-nums text-[#94A3B8]">Page {data.page} of {data.totalPages}</span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => goPage(page + 1)}
                className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#253244] px-3 text-[#F8FAFC] disabled:opacity-40 hover:enabled:bg-white/[0.04]"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>

        {/* ── Closing card ── */}
        <section className="relative mt-16 overflow-hidden rounded-3xl border border-[#253244] bg-[#101824]/70 p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-[600px] -translate-x-1/2 rounded-full bg-[#54D045]/20 blur-3xl" aria-hidden />
          <div className="relative">
            <h2 className="text-balance text-2xl font-bold tracking-tight text-[#F8FAFC] sm:text-4xl">Your turn to climb the rankings</h2>
            <p className="mx-auto mt-3 max-w-lg text-[#94A3B8]">Auto-clip your best moments, add captions, and publish across platforms — in minutes.</p>
            <Link
              href="/register"
              className="group mt-7 inline-flex items-center gap-2 rounded-full bg-[#54D045] px-6 py-3 text-sm font-semibold text-[#070B12] transition-colors hover:bg-[#62dc53]"
            >
              Start clipping free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </div>

      {open && <CreatorDrawer c={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
