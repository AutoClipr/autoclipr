import type { Metadata } from "next";
import Link from "next/link";
import {
  Scissors, FileVideo, Maximize2, FileArchive, ImageIcon,
  Music, Film, Info, Captions, Type, ArrowRight, Zap,
  ShieldCheck, Globe, Crop, Mic,
} from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { ConverterVisual, ReframeVisual, SlicerVisual } from "./tools-visuals";

export const metadata: Metadata = pageMetadata({
  title: "Free Online Video Tools — No Upload, 100% Private",
  description:
    "Free browser-based video tools powered by FFmpeg. Video slicer, compressor, format converter, audio extractor, caption generator, GIF maker, thumbnail extractor and more. No upload required.",
  path: "/tools",
  keywords: [
    "free video tools", "online video editor", "browser video tools",
    "no upload video tools", "ffmpeg online", "free video converter",
    "free video compressor", "caption generator", "gif maker", "audio extractor",
  ],
});

const TOOLS = [
  {
    icon: Scissors,
    label: "Video Slicer",
    desc: "Cut 15s, 30s, 45s, 60s clips in bulk",
    href: "/tools/video-slicer",
    badge: "Popular",
    color: "emerald",
    gradient: "from-emerald-500/20 to-teal-500/10",
    border: "hover:border-emerald-500/40",
    iconBg: "bg-emerald-500/15 group-hover:bg-emerald-500/25",
    iconColor: "text-emerald-400",
    tag: "Trim · Multi-segment · Fade",
  },
  {
    icon: FileVideo,
    label: "Format Converter",
    desc: "Convert between any video format instantly",
    href: "/tools/format-converter",
    badge: null,
    color: "violet",
    gradient: "from-violet-500/20 to-fuchsia-500/10",
    border: "hover:border-violet-500/40",
    iconBg: "bg-violet-500/15 group-hover:bg-violet-500/25",
    iconColor: "text-violet-400",
    tag: "MP4 · WebM · MOV · GIF · MP3",
  },
  {
    icon: Maximize2,
    label: "Aspect Ratio Converter",
    desc: "Reframe for Shorts, Reels & Stories",
    href: "/tools/aspect-ratio-converter",
    badge: "Popular",
    color: "sky",
    gradient: "from-sky-500/20 to-blue-500/10",
    border: "hover:border-sky-500/40",
    iconBg: "bg-sky-500/15 group-hover:bg-sky-500/25",
    iconColor: "text-sky-400",
    tag: "16:9 · 9:16 · 1:1 · 4:3",
  },
  {
    icon: FileArchive,
    label: "Video Compressor",
    desc: "Reduce file size without quality loss",
    href: "/tools/video-compressor",
    badge: null,
    color: "orange",
    gradient: "from-orange-500/20 to-amber-500/10",
    border: "hover:border-orange-500/40",
    iconBg: "bg-orange-500/15 group-hover:bg-orange-500/25",
    iconColor: "text-orange-400",
    tag: "H.264 · H.265 · VP9",
  },
  {
    icon: ImageIcon,
    label: "Thumbnail Extractor",
    desc: "Grab frames as PNG at any timestamp",
    href: "/tools/thumbnail-extractor",
    badge: null,
    color: "pink",
    gradient: "from-pink-500/20 to-rose-500/10",
    border: "hover:border-pink-500/40",
    iconBg: "bg-pink-500/15 group-hover:bg-pink-500/25",
    iconColor: "text-pink-400",
    tag: "PNG · JPEG · Any timestamp",
  },
  {
    icon: Music,
    label: "Audio Extractor",
    desc: "Export MP3 or WAV from any video",
    href: "/tools/audio-extractor",
    badge: null,
    color: "cyan",
    gradient: "from-cyan-500/20 to-teal-500/10",
    border: "hover:border-cyan-500/40",
    iconBg: "bg-cyan-500/15 group-hover:bg-cyan-500/25",
    iconColor: "text-cyan-400",
    tag: "MP3 · WAV · M4A · OGG",
  },
  {
    icon: Film,
    label: "GIF Generator",
    desc: "Create GIFs from any video segment",
    href: "/tools/gif-generator",
    badge: null,
    color: "yellow",
    gradient: "from-yellow-500/20 to-amber-500/10",
    border: "hover:border-yellow-500/40",
    iconBg: "bg-yellow-500/15 group-hover:bg-yellow-500/25",
    iconColor: "text-yellow-400",
    tag: "Looped · Custom FPS · Scale",
  },
  {
    icon: Info,
    label: "Video Metadata Viewer",
    desc: "Inspect codec, bitrate, FPS and more",
    href: "/tools/video-metadata",
    badge: null,
    color: "slate",
    gradient: "from-slate-500/20 to-zinc-500/10",
    border: "hover:border-slate-400/40",
    iconBg: "bg-slate-500/15 group-hover:bg-slate-500/25",
    iconColor: "text-slate-400",
    tag: "Duration · FPS · Codec · Bitrate",
  },
  {
    icon: Mic,
    label: "Audio to Text",
    desc: "Extract the spoken text from audio or video",
    href: "/tools/audio-to-text",
    badge: "AI",
    color: "teal",
    gradient: "from-teal-500/20 to-emerald-500/10",
    border: "hover:border-teal-500/40",
    iconBg: "bg-teal-500/15 group-hover:bg-teal-500/25",
    iconColor: "text-teal-300",
    tag: "Whisper · TXT · SRT · 99 languages",
  },
  {
    icon: Captions,
    label: "Caption Generator",
    desc: "Auto-generate transcripts for free",
    href: "/tools/caption-generator",
    badge: "AI",
    color: "indigo",
    gradient: "from-indigo-500/20 to-purple-500/10",
    border: "hover:border-indigo-500/40",
    iconBg: "bg-indigo-500/15 group-hover:bg-indigo-500/25",
    iconColor: "text-indigo-400",
    tag: "Whisper · SRT · VTT · TXT",
  },
  {
    icon: Type,
    label: "Caption Templates",
    desc: "Stylish caption overlays for social",
    href: "/tools/caption-templates",
    badge: null,
    color: "rose",
    gradient: "from-rose-500/20 to-pink-500/10",
    border: "hover:border-rose-500/40",
    iconBg: "bg-rose-500/15 group-hover:bg-rose-500/25",
    iconColor: "text-rose-400",
    tag: "Bold · Minimal · Karaoke",
  },
];

const STATS = [
  { icon: <ShieldCheck className="h-4 w-4" />, label: "100% Private", sub: "Nothing leaves your browser" },
  { icon: <Globe       className="h-4 w-4" />, label: "No Upload",    sub: "Powered by WebAssembly" },
  { icon: <Zap         className="h-4 w-4" />, label: "No Signup",    sub: "Free forever, no account" },
];

export default function ToolsPage() {
  return (
    <>
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Free Online Video Tools by AutoClipr",
      description: "Browser-based video tools — no upload, 100% private, powered by FFmpeg.",
      url: "https://autoclipr.com/tools",
      numberOfItems: 10,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Video Slicer",           url: "https://autoclipr.com/tools/video-slicer" },
        { "@type": "ListItem", position: 2, name: "Format Converter",       url: "https://autoclipr.com/tools/format-converter" },
        { "@type": "ListItem", position: 3, name: "Aspect Ratio Converter", url: "https://autoclipr.com/tools/aspect-ratio-converter" },
        { "@type": "ListItem", position: 4, name: "Audio Extractor",        url: "https://autoclipr.com/tools/audio-extractor" },
        { "@type": "ListItem", position: 5, name: "Caption Generator",      url: "https://autoclipr.com/tools/caption-generator" },
        { "@type": "ListItem", position: 6, name: "Caption Templates",      url: "https://autoclipr.com/tools/caption-templates" },
        { "@type": "ListItem", position: 7, name: "Video Compressor",       url: "https://autoclipr.com/tools/video-compressor" },
        { "@type": "ListItem", position: 8, name: "Thumbnail Extractor",    url: "https://autoclipr.com/tools/thumbnail-extractor" },
        { "@type": "ListItem", position: 9, name: "Video Metadata Viewer",  url: "https://autoclipr.com/tools/video-metadata" },
        { "@type": "ListItem", position: 10, name: "GIF Generator",         url: "https://autoclipr.com/tools/gif-generator" },
        { "@type": "ListItem", position: 11, name: "Audio to Text",         url: "https://autoclipr.com/tools/audio-to-text" },
      ],
    }} />
    <div className="relative min-h-screen overflow-hidden bg-[#07080f]">
      {/* Ambient glow + faint grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[620px] w-[1000px] -translate-x-1/2 rounded-full bg-emerald-500/[0.08] blur-[130px]" />
        <div className="absolute top-[35%] -left-40 h-[420px] w-[420px] rounded-full bg-violet-500/[0.06] blur-[110px]" />
        <div className="absolute top-[35%] -right-40 h-[420px] w-[420px] rounded-full bg-orange-500/[0.05] blur-[110px]" />
        <div
          className="absolute inset-x-0 top-0 h-[520px] opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at top, black 20%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6">
        {/* ── Header ── */}
        <div className="mb-14 text-center">
          <p className="section-label-white mb-6">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" />
            100% free · No signup
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Free video tools,{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
              right in your browser
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/55">
            Slice, convert, compress and caption videos without uploading a thing. No accounts, no cost — ever.
          </p>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {STATS.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  {s.icon}
                </span>
                <span className="font-semibold text-white">{s.label}</span>
                <span className="hidden text-white/40 sm:inline">· {s.sub}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Featured tools: bento with live previews ── */}
        <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-2">
          <FeaturedCard
            href={TOOLS[0].href}
            icon={<Scissors className="h-5 w-5" />}
            title={TOOLS[0].label}
            badge="Most popular"
            desc={TOOLS[0].desc}
            accent="emerald"
            className="lg:row-span-2"
            visual={<SlicerVisual />}
          />
          <FeaturedCard
            href={TOOLS[1].href}
            icon={<FileVideo className="h-5 w-5" />}
            title={TOOLS[1].label}
            badge="New"
            desc={TOOLS[1].desc}
            accent="violet"
            visual={<ConverterVisual />}
          />
          <FeaturedCard
            href={TOOLS[2].href}
            icon={<Crop className="h-5 w-5" />}
            title={TOOLS[2].label}
            badge="New"
            desc={TOOLS[2].desc}
            accent="orange"
            visual={<ReframeVisual />}
          />
        </div>

        {/* ── All tools ── */}
        <div className="mb-6 mt-16 flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">All tools</h2>
          <p className="text-sm text-white/40">{TOOLS.length} tools · all free</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.slice(3).map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className={`group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.04] ${tool.border}`}
              >
                <div
                  className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${tool.gradient} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
                />
                <span
                  className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] ${tool.iconBg} ${tool.iconColor} transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{tool.label}</p>
                    {tool.badge && (
                      <span className="rounded bg-white/10 px-1.5 py-px text-[10px] font-medium text-white/80">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-snug text-white/50">{tool.desc}</p>
                  <p className={`mt-3 text-[11px] font-medium ${tool.iconColor} opacity-70`}>{tool.tag}</p>
                </div>
                <ArrowRight className="relative mt-1 h-4 w-4 shrink-0 text-white/30 transition-all group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            );
          })}
        </div>

        {/* ── Closing card ── */}
        <div className="relative mt-16 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-balance text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Want the clipping done for you?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white/55">
              AutoClipr finds the best moments, captions them and reframes to 9:16 automatically.
            </p>
            <Link
              href="/register"
              className="group mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              Try AutoClipr free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

const ACCENTS = {
  emerald: { glow: "bg-emerald-500/20", tile: "bg-emerald-500/15 text-emerald-300", badge: "bg-emerald-500/20 text-emerald-300", hover: "hover:border-emerald-400/40", link: "text-emerald-300" },
  violet: { glow: "bg-violet-500/20", tile: "bg-violet-500/15 text-violet-300", badge: "bg-violet-500/20 text-violet-300", hover: "hover:border-violet-400/40", link: "text-violet-300" },
  orange: { glow: "bg-orange-500/20", tile: "bg-orange-500/15 text-orange-300", badge: "bg-orange-500/20 text-orange-300", hover: "hover:border-orange-400/40", link: "text-orange-300" },
} as const;

function FeaturedCard({
  href,
  icon,
  title,
  badge,
  desc,
  accent,
  visual,
  className = "",
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  badge: string;
  desc: string;
  accent: keyof typeof ACCENTS;
  visual: React.ReactNode;
  className?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 sm:p-7 ${a.hover} ${className}`}
    >
      <div className={`pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full ${a.glow} opacity-70 blur-3xl transition-opacity duration-500 group-hover:opacity-100`} />
      <div className="relative flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] ${a.tile}`}>{icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-white">{title}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${a.badge}`}>{badge}</span>
          </div>
          <p className="text-sm text-white/50">{desc}</p>
        </div>
      </div>
      <div className="relative flex flex-1 items-center py-6">{visual}</div>
      <span className={`relative inline-flex items-center gap-1.5 text-sm font-semibold ${a.link} transition-all group-hover:gap-2.5`}>
        Open tool <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
