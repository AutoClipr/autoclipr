"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Users, Eye, Video, ArrowRight, ChevronRight } from "lucide-react";
import { ChannelSearchBar } from "@/components/top-creators/channel-search-bar";
import { cn } from "@/lib/utils";

// Static metadata (rank, niche, country flag) — real stats/thumbnails come from YouTube API
const CREATORS_META = [
  { rank: 1, name: "MrBeast",          niche: "Entertainment", country: "🇺🇸", tier: "gold"   },
  { rank: 2, name: "T-Series",          niche: "Music",         country: "🇮🇳", tier: "silver" },
  { rank: 3, name: "Cocomelon",         niche: "Kids",          country: "🇺🇸", tier: "bronze" },
  { rank: 4, name: "SET India",         niche: "Entertainment", country: "🇮🇳" },
  { rank: 5, name: "Vlad and Niki",     niche: "Kids",          country: "🇺🇸" },
  { rank: 6, name: "Stokes Twins",      niche: "Entertainment", country: "🇺🇸" },
  { rank: 7, name: "Kids Diana Show",   niche: "Kids",          country: "🇺🇦" },
  { rank: 8, name: "Like Nastya",       niche: "Kids",          country: "🇷🇺" },
  { rank: 9, name: "Zee Music Company", niche: "Music",         country: "🇮🇳" },
  { rank: 10, name: "5-Minute Crafts",  niche: "Lifestyle",     country: "🇨🇾" },
  { rank: 11, name: "BLACKPINK",        niche: "Music",         country: "🇰🇷" },
  { rank: 12, name: "Justin Bieber",    niche: "Music",         country: "🇨🇦" },
  { rank: 13, name: "Mark Rober",       niche: "Technology",    country: "🇺🇸" },
  { rank: 14, name: "Dude Perfect",     niche: "Sports",        country: "🇺🇸" },
  { rank: 15, name: "Nicki Minaj",      niche: "Music",         country: "🇹🇹" },
  { rank: 16, name: "Shakira",          niche: "Music",         country: "🇨🇴" },
  { rank: 17, name: "ABP NEWS",         niche: "News",          country: "🇮🇳" },
  { rank: 18, name: "BeatboxJCOP",      niche: "Entertainment", country: "🇲🇽" },
  { rank: 19, name: "Toys and Colors",  niche: "Kids",          country: "🇺🇸" },
  { rank: 20, name: "Alan's Universe",  niche: "Entertainment", country: "🇵🇭" },
];

type YTLive = { name: string; thumbnail: string; subs: string; views: string; videos: string; country: string };
type Creator = typeof CREATORS_META[number] & { thumbnail?: string; subs: string; views: string; videos: string };

const CATEGORIES = ["Entertainment", "Music", "Kids", "Technology", "Sports", "Lifestyle", "News"];
const SORT_OPTIONS = [
  { key: "rank", label: "Rank", icon: TrendingUp },
  { key: "subs", label: "Subscribers", icon: Users },
  { key: "views", label: "Views", icon: Eye },
  { key: "videos", label: "Videos", icon: Video },
];

/** "526.0M" / "146.97B" / "1.0K" / "—" → a number for sorting. */
function parseStat(v: string): number {
  const m = /^([\d.]+)\s*([KMB])?$/i.exec(v.trim());
  if (!m) return -1;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase() as "K" | "M" | "B"] ?? 1;
  return parseFloat(m[1]) * mult;
}

const GRAD_COLORS = [
  "from-emerald-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-orange-500 to-red-500",
  "from-blue-500 to-indigo-500",
  "from-pink-500 to-rose-500",
];

function Avatar({ name, thumbnail, size = "h-11 w-11" }: { name: string; thumbnail?: string; size?: string }) {
  if (thumbnail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumbnail} alt={name} className={cn(size, "shrink-0 rounded-full border border-white/10 object-cover shadow-lg")} />
    );
  }
  const color = GRAD_COLORS[name.charCodeAt(0) % GRAD_COLORS.length];
  return (
    <div className={cn(size, `flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${color} font-bold text-white shadow-lg`)}>
      {name.charAt(0)}
    </div>
  );
}

const channelHref = (name: string) => `/top-creators/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"))}`;

// Merge static meta with live YouTube data
function buildCreators(liveMap: Record<string, YTLive>): Creator[] {
  return CREATORS_META.map((m) => {
    const live = liveMap[m.name];
    return {
      ...m,
      thumbnail: live?.thumbnail ?? "",
      subs: live?.subs ?? "—",
      views: live?.views ?? "—",
      videos: live?.videos ?? "—",
    };
  });
}

/* ─── Podium (top 3 of the current view) ────────────────────────────────── */

const PODIUM_STYLE = [
  { ring: "from-yellow-300 to-amber-500", glow: "bg-yellow-400/25", badge: "bg-gradient-to-br from-yellow-300 to-amber-500 text-black", lift: "lg:-translate-y-6" },
  { ring: "from-slate-200 to-slate-400", glow: "bg-slate-300/15", badge: "bg-gradient-to-br from-slate-200 to-slate-400 text-black", lift: "" },
  { ring: "from-orange-300 to-orange-600", glow: "bg-orange-500/20", badge: "bg-gradient-to-br from-orange-300 to-orange-600 text-white", lift: "" },
];

function PodiumCard({ creator, place }: { creator: Creator; place: number }) {
  const st = PODIUM_STYLE[place];
  return (
    <Link
      href={channelHref(creator.name)}
      className={cn(
        "group relative flex flex-col items-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-5 pb-6 pt-8 text-center backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-white/20",
        st.lift,
      )}
    >
      <div className={cn("pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl", st.glow)} />
      <span className={cn("absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold shadow-lg", st.badge)}>
        {place + 1}
      </span>
      <div className={cn("relative rounded-full bg-gradient-to-br p-[3px]", st.ring)}>
        <Avatar name={creator.name} thumbnail={creator.thumbnail} size="h-20 w-20 text-2xl" />
      </div>
      <p className="relative mt-4 text-lg font-bold text-white">{creator.name}</p>
      <p className="relative text-xs text-white/45">{creator.country} · {creator.niche}</p>
      <p className="relative mt-4 text-3xl font-extrabold tracking-tight text-white">{creator.subs}</p>
      <p className="relative text-[11px] uppercase tracking-widest text-white/40">subscribers</p>
      <div className="relative mt-4 flex w-full justify-center gap-6 border-t border-white/[0.07] pt-4 text-sm">
        <div>
          <p className="font-semibold text-white">{creator.views}</p>
          <p className="text-[10px] text-white/40">views</p>
        </div>
        <div>
          <p className="font-semibold text-white">{creator.videos}</p>
          <p className="text-[10px] text-white/40">videos</p>
        </div>
      </div>
    </Link>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export function TopCreatorsList() {
  const router = useRouter();
  const [sort, setSort] = useState("rank");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [channelSearch, setChannelSearch] = useState("");
  const [liveMap, setLiveMap] = useState<Record<string, YTLive>>({});

  useEffect(() => {
    fetch("/api/youtube/creators")
      .then((r) => r.json())
      .then((data: YTLive[]) => {
        if (!Array.isArray(data)) return;
        const map: Record<string, YTLive> = {};
        for (const d of data) map[d.name] = d;
        setLiveMap(map);
      })
      .catch(() => {});
  }, []);

  const CREATORS = buildCreators(liveMap);

  const filtered = CREATORS.filter((c) => {
    if (activeCategory && c.niche !== activeCategory) return false;
    if (channelSearch && !c.name.toLowerCase().includes(channelSearch.toLowerCase())) return false;
    return true;
  });

  const sorted =
    sort === "rank"
      ? filtered
      : [...filtered].sort(
          (a, b) =>
            parseStat(b[sort as "subs" | "views" | "videos"]) - parseStat(a[sort as "subs" | "views" | "videos"]),
        );

  // Podium only when there are enough results to fill it.
  const podium = sorted.length >= 3 ? sorted.slice(0, 3) : [];
  const rest = sorted.slice(podium.length);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080f] pt-2">
      {/* Glow + faint grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-emerald-500/[0.09] blur-[130px]" />
        <div
          className="absolute inset-x-0 top-0 h-[560px] opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at top, black 20%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6">
        {/* ── Hero ── */}
        <div className="text-center">
          <p className="section-label-white mb-6">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" />
            Live stats · Refreshed daily
          </p>
          <h1 className="mx-auto max-w-4xl text-balance text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Top YouTube creators{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
              by subscribers
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/55">
            Live rankings with views, uploads and channel stats. Study what the best are doing — then clip it with AutoClipr.
          </p>
          <div className="mx-auto mt-8 max-w-xl text-left">
            <ChannelSearchBar localSearch={channelSearch} onLocalSearchChange={setChannelSearch} />
            {channelSearch && (
              <p className="mt-2 text-center text-xs text-white/40">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &quot;{channelSearch}&quot; in the list
              </p>
            )}
          </div>
        </div>

        {/* ── Controls: sort + category chips ── */}
        <div className="mt-12 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur lg:w-auto">
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all lg:flex-none",
                    sort === opt.key ? "bg-white text-black shadow" : "text-white/55 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:justify-end lg:overflow-visible lg:px-0 lg:pb-0">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                activeCategory === null ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-white/10 text-white/55 hover:text-white",
              )}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(activeCategory === c ? null : c)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  activeCategory === c ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-white/10 text-white/55 hover:text-white",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── Podium ── */}
        {podium.length > 0 && (
          <div className="mt-14 grid gap-4 sm:grid-cols-3 lg:items-end">
            {/* 2nd · 1st · 3rd on wide screens */}
            <div className="sm:order-2"><PodiumCard creator={podium[0]} place={0} /></div>
            <div className="sm:order-1"><PodiumCard creator={podium[1]} place={1} /></div>
            <div className="sm:order-3"><PodiumCard creator={podium[2]} place={2} /></div>
          </div>
        )}

        {/* ── Table ── */}
        {rest.length > 0 && (
          <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] backdrop-blur">
            <div className="hidden grid-cols-[56px_1fr_110px_110px_90px_36px] items-center gap-3 border-b border-white/[0.07] px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-white/40 sm:grid">
              <div>#</div>
              <div>Channel</div>
              <div className="text-right">Subscribers</div>
              <div className="text-right">Views</div>
              <div className="text-right">Videos</div>
              <div />
            </div>

            <div className="divide-y divide-white/[0.05]">
              {rest.map((creator, i) => {
                const place = podium.length + i + 1;
                return (
                  <div key={creator.rank}>
                    {/* Mid-list CTA */}
                    {i === 7 && (
                      <div className="flex flex-col gap-3 bg-gradient-to-r from-emerald-500/[0.12] to-cyan-500/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">See a creator you want to beat?</p>
                          <p className="text-sm text-white/50">Clip their best moments — start in 30 seconds.</p>
                        </div>
                        <Link
                          href="/register"
                          className="group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
                        >
                          Start free
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    )}
                    <div
                      onClick={() => router.push(channelHref(creator.name))}
                      className="group grid cursor-pointer grid-cols-[40px_1fr_auto_20px] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.04] sm:grid-cols-[56px_1fr_110px_110px_90px_36px] sm:px-5"
                    >
                      <span className="text-sm font-semibold text-white/40 group-hover:text-white">#{place}</span>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={creator.name} thumbnail={creator.thumbnail} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{creator.name}</p>
                          <p className="text-xs text-white/40">{creator.country} · {creator.niche}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white">{creator.subs}</p>
                        <p className="text-[10px] text-white/35 sm:hidden">subs</p>
                      </div>
                      <p className="hidden text-right font-semibold text-white/80 sm:block">{creator.views}</p>
                      <p className="hidden text-right font-semibold text-white/80 sm:block">{creator.videos}</p>
                      <span className="flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-white/25 transition-all group-hover:bg-emerald-500/15 group-hover:text-emerald-300">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sorted.length === 0 && (
          <p className="mt-16 text-center text-white/50">No creators match that search.</p>
        )}

        {/* ── Closing card ── */}
        <div className="relative mt-16 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-balance text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Your turn to climb the rankings
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white/55">
              Auto-clip your best moments, add captions, and publish across platforms — in minutes.
            </p>
            <Link
              href="/register"
              className="group mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              Start clipping free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
