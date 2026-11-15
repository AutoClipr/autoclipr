import type { Metadata } from "next";
import Link from "next/link";
import { BlogIndex } from "@/components/blog/blog-index";
import { BlogIndexJsonLd } from "@/components/seo/json-ld";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Blog — Video Clipping & Creator Growth",
  description:
    "Tips on repurposing YouTube, TikTok, and podcast content with AI. Guides for Shorts, Reels, captions, and viral clip workflows.",
  path: "/blog",
  keywords: [
    "video clipping blog",
    "YouTube repurposing tips",
    "TikTok creator guides",
    "AI video marketing",
  ],
});

export default function BlogPage() {
  const posts = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <div className="relative isolate overflow-hidden px-4 pb-24 pt-24 sm:px-6">
      {/* Glow + faint grid */}
      <div className="pointer-events-none absolute inset-0 -z-10">
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
      <BlogIndexJsonLd posts={posts} />
      <div className="mx-auto max-w-5xl text-center">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-white/45">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span aria-current="page">Blog</span>
        </nav>
        <p className="section-label-white mx-auto mb-6">AutoClipr Blog</p>
        <h1 className="mx-auto max-w-3xl text-balance text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
          Grow with{" "}
          <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
            short-form video
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55">
          Guides on repurposing long videos, AI captions, and multi-platform clip workflows.
        </p>
      </div>
      <div className="mx-auto mt-16 max-w-5xl">
        <BlogIndex posts={posts} />
      </div>
    </div>
  );
}
