"use client";

import { BookOpen, HelpCircle, Star, MessageSquare, Lightbulb, Youtube, TrendingUp } from "lucide-react";
import { NavMegaMenu } from "./nav-mega-menu";

const RESOURCES = [
  {
    icon: BookOpen,
    label: "Blog",
    desc: "Tips, tutorials & creator growth strategies",
    href: "/blog",
  },
  {
    icon: HelpCircle,
    label: "FAQ",
    desc: "Common questions answered",
    href: "/faq",
  },
  {
    icon: Youtube,
    label: "Video Tutorials",
    desc: "Step-by-step guides to get the most out of AutoClipr",
    href: "/tutorials",
    badge: "New",
  },
  {
    icon: TrendingUp,
    label: "Creator Success Stories",
    desc: "Real results from real creators",
    href: "/success-stories",
  },
  {
    icon: Lightbulb,
    label: "How it Works",
    desc: "See how AutoClipr clips, captions & exports",
    href: "/#how-it-works",
  },
  {
    icon: MessageSquare,
    label: "Changelog",
    desc: "What's new — latest features & fixes",
    href: "/changelog",
  },
  {
    icon: Star,
    label: "Affiliate Program",
    desc: "Earn 30% recurring commission",
    href: "/affiliate",
    badge: "Earn",
  },
];

export function ResourcesDropdown() {
  return <NavMegaMenu label="Resources" align="right" sections={[{ title: "Resources", items: RESOURCES }]} />;
}
