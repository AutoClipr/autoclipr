import type { Metadata } from "next";
import { SITE_URL, OG_IMAGE_PATH } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Video, Calendar, BadgeCheck, TrendingUp, Eye, Users, DollarSign } from "lucide-react";
import { searchChannel, getTopVideos, formatCount, estimateMonthlyEarnings } from "@/lib/youtube-api";
import { ChannelCharts } from "./channel-charts";
import { CREATOR_RANKS } from "@/lib/top-creators";


type Props = { params: Promise<{ channel: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channel } = await params;
  const name = decodeURIComponent(channel).replace(/-/g, " ");
  const title = `${name} — YouTube Subscribers, Views & Earnings`;
  const description = `Live YouTube stats for ${name}: subscriber count, total views, estimated earnings, top videos and growth charts. Updated daily.`;
  const url = `${SITE_URL}/top-creators/${channel}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      `${name} youtube stats`, `${name} subscribers`, `${name} earnings`,
      "youtube channel stats", "top youtube creators", "youtube analytics",
    ],
    openGraph: {
      type: "website",
      url,
      title: `${title} | AutoClipr`,
      description,
      siteName: "AutoClipr",
      images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | AutoClipr`,
      description,
      images: [OG_IMAGE_PATH],
    },
  };
}

export default async function ChannelPage({ params }: Props) {
  const { channel } = await params;
  const name = decodeURIComponent(channel).replace(/-/g, " ");

  const [channelData, topVideos] = await Promise.all([
    searchChannel(name),
    searchChannel(name).then((ch) => ch ? getTopVideos(ch.id) : []),
  ]);

  const hasKey = !!process.env.YOUTUBE_API_KEY;

  if (!channelData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
          <Users className="h-8 w-8 text-white/30" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          {hasKey ? "Channel not found" : "API key not configured"}
        </h1>
        <p className="text-white/40 max-w-sm">
          {hasKey
            ? `We couldn't find YouTube data for "${name}". Try checking the spelling.`
            : "YOUTUBE_API_KEY is missing from environment variables."}
        </p>
        <Link href="/top-creators" className="mt-2 inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Top Creators
        </Link>
      </div>
    );
  }

  const subs = formatCount(channelData.subscribers);
  const views = formatCount(channelData.views);
  const videos = formatCount(channelData.videoCount);
  const earnings = estimateMonthlyEarnings(channelData.views);
  const yearsOld = Math.floor((Date.now() - new Date(channelData.publishedAt).getTime()) / (365.25 * 24 * 3600 * 1000));

  const countryFlag = channelData.country
    ? [...channelData.country.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("")
    : "";

  const globalRank = CREATOR_RANKS[name.toLowerCase()];
  const rankDisplay = globalRank ? `#${globalRank}` : "—";
  const rankSub = globalRank ? `Top ${globalRank <= 10 ? 10 : 20} Worldwide` : "Not in top 20";

  const STATS = [
    { icon: Users, label: "Subscribers", value: subs, color: "text-emerald-300", tile: "bg-emerald-500/15 text-emerald-300" },
    { icon: Eye, label: "Total views", value: views, color: "text-cyan-300", tile: "bg-cyan-500/15 text-cyan-300" },
    { icon: DollarSign, label: "Est. monthly earnings", value: earnings, sub: "Estimate · ~$3 CPM", color: "text-amber-300", tile: "bg-amber-500/15 text-amber-300" },
    { icon: TrendingUp, label: "Global ranking", value: rankDisplay, sub: rankSub, color: "text-violet-300", tile: "bg-violet-500/15 text-violet-300" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080f]">
      {/* ── Hero with the channel art blurred behind it ── */}
      <div className="relative overflow-hidden">
        {channelData.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channelData.thumbnail}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-30 blur-3xl"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#07080f]/40 via-[#07080f]/70 to-[#07080f]" />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6">
          <Link
            href="/top-creators"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/65 backdrop-blur transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Top creators
          </Link>

          <div className="mt-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
            <div className="relative shrink-0">
              <div className="absolute -inset-3 rounded-full bg-emerald-400/25 blur-2xl" aria-hidden />
              <div className="relative rounded-full bg-gradient-to-br from-emerald-300 via-cyan-300 to-violet-400 p-[3px]">
                {channelData.thumbnail ? (
                  <Image
                    src={channelData.thumbnail}
                    alt={channelData.title}
                    width={112}
                    height={112}
                    className="h-28 w-28 rounded-full border-4 border-[#07080f] object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#07080f] bg-gradient-to-br from-emerald-500 to-cyan-500 text-4xl font-bold text-white">
                    {channelData.title.charAt(0)}
                  </div>
                )}
              </div>
              {globalRank && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-r from-yellow-300 to-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-black shadow-lg">
                  #{globalRank}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="section-label-white mb-3">YouTube stats</p>
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">{channelData.title}</h1>
                <BadgeCheck className="h-7 w-7 shrink-0 text-emerald-400" />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-white/75">
                  <Video className="h-3.5 w-3.5" /> {videos} videos
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-white/75">
                  <Calendar className="h-3.5 w-3.5" /> {yearsOld} years on YouTube
                </span>
                {channelData.country && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-white/75">
                    {countryFlag} {channelData.country}
                  </span>
                )}
                <span className="text-xs text-white/40">
                  Updated {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>

            <Link
              href="/register"
              className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              Clip this channel — free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Stat cards */}
          <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STATS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition-colors hover:border-white/20"
                >
                  <div className="flex items-center gap-2.5 text-sm text-white/60">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.tile}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    {s.label}
                  </div>
                  <p className={`mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl ${s.color}`}>{s.value}</p>
                  {s.sub && <p className="mt-1 text-xs text-white/40">{s.sub}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Charts + videos ── */}
      <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <ChannelCharts
          channelName={channelData.title}
          subscribers={channelData.subscribers}
          totalViews={channelData.views}
          topVideos={topVideos}
        />

        {/* Closing card */}
        <div className="relative mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-balance text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Want to clip {channelData.title}&apos;s best moments?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white/55">
              AutoClipr finds the viral moments, adds captions and publishes everywhere.
            </p>
            <Link
              href="/register"
              className="group mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
