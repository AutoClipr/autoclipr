"use client";

import Link from "next/link";
import { Scissors, FileVideo, Maximize2, FileArchive, Image, Music, Film, Info, Captions, Type } from "lucide-react";
import { NavMegaMenu } from "./nav-mega-menu";

const TOOLS = [
  {
    category: "Video Editing",
    items: [
      { icon: Scissors, label: "Video Slicer", desc: "Cut 15s, 30s, 45s, 60s clips in bulk", href: "/tools/video-slicer" },
      { icon: Maximize2, label: "Aspect Ratio Converter", desc: "16:9 → 9:16 · 1:1 for Shorts & Reels", href: "/tools/aspect-ratio-converter" },
      { icon: FileArchive, label: "Video Compressor", desc: "Reduce file size without quality loss", href: "/tools/video-compressor" },
      { icon: Film, label: "GIF Generator", desc: "Create GIFs from any video segment", href: "/tools/gif-generator" },
    ],
  },
  {
    category: "Convert & Extract",
    items: [
      { icon: FileVideo, label: "Format Converter", desc: "MP4 ↔ MOV · MP4 → WebM", href: "/tools/format-converter" },
      { icon: Music, label: "Audio Extractor", desc: "Export MP3 or WAV from any video", href: "/tools/audio-extractor" },
      { icon: Image, label: "Thumbnail Extractor", desc: "Grab frames as PNG at any timestamp", href: "/tools/thumbnail-extractor" },
    ],
  },
  {
    category: "Captions & Info",
    items: [
      { icon: Captions, label: "Caption Generator", desc: "Auto-generate transcripts for free", href: "/tools/caption-generator" },
      { icon: Type, label: "Caption Templates", desc: "Simple white caption styles", href: "/tools/caption-templates" },
      { icon: Info, label: "Video Metadata Viewer", desc: "Duration · FPS · Codec · Bitrate", href: "/tools/video-metadata" },
    ],
  },
];

export function FreeToolsDropdown() {
  return (
    <NavMegaMenu
      label="Free Tools"
      sections={TOOLS.map((g) => ({ title: g.category, items: g.items }))}
      footer={(close) => (
        <Link
          href="/tools"
          onClick={close}
          className="text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          View all free tools →
        </Link>
      )}
    />
  );
}
