import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { HomePageJsonLd } from "@/components/seo/json-ld";
import { DEFAULT_KEYWORDS, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Auto Clip Videos — AI Clipper for Viral Shorts",
  description:
    "AutoClipr is the AI clipping tool that turns long videos into AI clips and Shorts. It finds viral moments, adds captions, and exports TikTok, Reels and Shorts. Free to start.",
  path: "/",
  keywords: [
    "auto clip", "auto clipper", "autoclip", "automatic video clipping",
    "ai video clipper", "auto clips generator", "automatic clipping",
    "clipper ai", "youtube to shorts", "viral clip maker",
    "tiktok clip generator", "instagram reels maker",
    // Shared product keywords (clips, AI clips, AI editing tool, AI shorts, …)
    ...DEFAULT_KEYWORDS,
  ].filter((k, i, all) => all.findIndex((x) => x.toLowerCase() === k.toLowerCase()) === i),
});
import { AiModels } from "@/components/landing/ai-models";
import { WorkflowAutomation } from "@/components/landing/workflow-automation";
import { CTA } from "@/components/landing/cta";
import { PlatformMarquee } from "@/components/landing/platform-marquee";
import { CreatorsMarquee } from "@/components/landing/creators-marquee";
import { CreatorWinTicker } from "@/components/layout/creator-win-ticker";
import { PublishDirectly } from "@/components/landing/publish-directly";

export default function HomePage() {
  return (
    <>
      <HomePageJsonLd />
      <CreatorWinTicker />
      <Hero />
      <CreatorsMarquee />
      <PlatformMarquee />
      <AiModels />
      <WorkflowAutomation />
      <PublishDirectly />
      <CTA />
    </>
  );
}
