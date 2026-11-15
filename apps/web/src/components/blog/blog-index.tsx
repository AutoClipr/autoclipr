import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { BlogPost } from "@/lib/blog-posts";

export function BlogIndex({ posts }: { posts: BlogPost[] }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
      {posts.map((post) => (
        <Link
          key={post.slug}
          href={`/blog/${post.slug}`}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
        >
          <p className="text-xs text-muted-foreground">
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readMinutes} min read
            </span>
          </p>
          <h2 className="mt-3 text-xl font-bold leading-snug text-white">{post.title}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {post.description}
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-sm font-semibold text-white transition-colors group-hover:bg-white group-hover:text-black">
            Read article
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}
