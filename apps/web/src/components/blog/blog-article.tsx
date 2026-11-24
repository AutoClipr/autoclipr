import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPostDate, type BlogPost } from "@/lib/blog-posts";

export function BlogArticle({ post }: { post: BlogPost }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
      <Link
        href="/blog"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to blog
      </Link>

      <header>
        <p className="text-sm text-muted-foreground">
          {post.updatedAt ? (
            <>
              Updated <time dateTime={post.updatedAt}>{formatPostDate(post.updatedAt)}</time>
              <span className="mx-2">·</span>
              Originally published <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
            </>
          ) : (
            <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
          )}
          <span className="mx-2">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {post.readMinutes} min read
          </span>
        </p>
        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{post.description}</p>
      </header>

      <div className="prose prose-invert mt-12 max-w-none prose-headings:font-semibold prose-p:text-muted-foreground prose-p:leading-relaxed">
        {post.sections.map((section, i) => (
          <section key={i} className="mb-10">
            {section.heading && (
              <h2 className="mb-4 text-2xl text-foreground">{section.heading}</h2>
            )}
            {section.paragraphs.map((p, j) => (
              <p key={j} className="mb-4">
                <RichText text={p} />
              </p>
            ))}
          </section>
        ))}
      </div>

      {post.faqs && post.faqs.length > 0 && (
        <section className="mt-4 border-t border-white/10 pt-10" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mb-6 text-2xl font-semibold text-foreground">Frequently asked questions</h2>
          <div className="space-y-3">
            {post.faqs.map((f) => (
              <details key={f.q} className="group rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 open:bg-white/[0.05]">
                <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-medium">{f.q}</h3>
                    <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-muted-foreground"><RichText text={f.a} /></p>
              </details>
            ))}
          </div>
        </section>
      )}

      {post.relatedTools && post.relatedTools.length > 0 && (
        <div className="mt-12 border-t border-white/10 pt-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Tools mentioned in this post</h2>
          <div className="flex flex-wrap gap-2">
            {post.relatedTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-emerald-500/40 hover:text-foreground"
              >
                {tool.label} →
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-16 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Try AutoClipr free</h2>
        <p className="mt-2 text-muted-foreground">
          Paste a YouTube link and get viral clips with AI captions in minutes.
        </p>
        <Button variant="gradient" className="mt-6" asChild>
          <Link href="/register">Start free trial</Link>
        </Button>
      </div>
    </article>
  );
}

/** Paragraph text with internal links written as [label](/path). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)]*\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[([^\]]+)\]\((\/[^)]*)\)$/.exec(part);
        return m ? (
          <Link key={i} href={m[2]} className="font-medium text-emerald-400 underline-offset-4 hover:underline">
            {m[1]}
          </Link>
        ) : (
          part
        );
      })}
    </>
  );
}
