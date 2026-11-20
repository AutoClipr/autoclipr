import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { TopCreatorsList } from "./top-creators-list";

export const metadata: Metadata = pageMetadata({
  title: "Top YouTube Creators – Global Creator Rankings",
  description:
    "Explore top YouTube creators by subscribers, views, and video uploads. Discover leading channels across entertainment, music, technology, sports, and more with AutoClipr.",
  path: "/top-creators",
  keywords: [
    "top youtube creators", "most subscribed youtube channels", "youtube leaderboard",
    "youtube channel rankings", "biggest youtube channels", "youtube stats", "creator rankings",
  ],
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Top YouTube Creators – Global Creator Rankings",
  url: `${SITE_URL}/top-creators`,
  description:
    "Leaderboard of tracked YouTube channels ranked by subscribers, views and video uploads, refreshed daily from the YouTube Data API.",
  isPartOf: { "@type": "WebSite", name: "AutoClipr", url: SITE_URL },
};

export default function TopCreatorsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Suspense>
        <TopCreatorsList />
      </Suspense>
    </>
  );
}
