"use client";

import {
  BarChart3,
  CalendarDays,
  Captions,
  Crop,
  Flame,
  MonitorPlay,
  Radio,
  Scissors,
  Send,
  Sparkles,
} from "lucide-react";
import { NavMegaMenu, type MegaMenuItem } from "./nav-mega-menu";

/**
 * Everything AutoClipr does, shown as a mega-menu grid. The five carousel
 * features link to `/#feature-<slide>` — the landing carousel listens for that
 * hash, opens the slide and scrolls to it.
 */
export const FEATURE_LINKS: MegaMenuItem[] = [
  { label: "AI clipping", desc: "Turn one long video into scored, ready-to-post clips", href: "/#feature-clipping", icon: Scissors },
  { label: "AI captions", desc: "Word-by-word captions in viral styles, 6 languages", href: "/#feature-captions", icon: Captions },
  { label: "Auto reframe", desc: "Landscape to 9:16 with the speaker kept in frame", href: "/#feature-reframe", icon: Crop },
  { label: "Channel monitoring", desc: "New uploads clipped automatically — no clicks", href: "/#feature-monitor", icon: Radio },
  { label: "Auto-publish", desc: "Post to YouTube Shorts and Instagram Reels in 1 click", href: "/#feature-publish", icon: Send },
  { label: "Social scheduler", desc: "Schedule your clips to post across platforms at the best times", href: "/#feature-publish", icon: CalendarDays, badge: "Soon" },
  { label: "Viral score", desc: "See how likely a clip is to take off before you post", href: "/#feature-clipping", icon: Flame },
  { label: "AI Shorts creator", desc: "Create Shorts with AI — included on the Business plan", href: "/pricing", icon: Sparkles },
  { label: "Analytics", desc: "Performance tracking for your clips on the Business plan", href: "/pricing", icon: BarChart3 },
  { label: "HD & 4K export", desc: "Export 1080×1920 up to 4K, ready for any platform", href: "/pricing", icon: MonitorPlay },
];

export function FeaturesDropdown() {
  return <NavMegaMenu label="Features" align="left" width={720} sections={[{ title: "Features", items: FEATURE_LINKS }]} />;
}
