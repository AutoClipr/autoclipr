import Link from "next/link";
import { Youtube, Instagram, Linkedin } from "lucide-react";
import { XLogo } from "@/components/landing/feature-showcase";
import { LogoIcon } from "@/components/ui/logo-icon";
import { NewsletterSignup } from "@/components/layout/newsletter-signup";
import { cn } from "@/lib/utils";

// Columns are kept to a similar length so no single one hangs below the rest.
const navColumns = [
  {
    title: "Product",
    links: [
      { href: "/#feature-clipping", label: "Features" },
      { href: "/#how-it-works", label: "How It Works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/coaching", label: "Coaching" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { href: "/youtube-to-tiktok", label: "YouTube to TikTok" },
      { href: "/youtube-to-shorts", label: "YouTube to Shorts" },
      { href: "/youtube-to-instagram-reels", label: "YouTube to Reels" },
      { href: "/podcast-to-clips", label: "Podcast to Clips" },
    ],
  },
  {
    // Four tools only — the full set of 10 lives on /tools, linked at the end.
    title: "Free Tools",
    links: [
      { href: "/tools/video-slicer", label: "Video Slicer" },
      { href: "/tools/video-compressor", label: "Video Compressor" },
      { href: "/tools/caption-generator", label: "Caption Generator" },
      { href: "/tools/gif-generator", label: "GIF Generator" },
      { href: "/tools", label: "All Free Tools →" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/tutorials", label: "Tutorials" },
      { href: "/faq", label: "FAQ" },
      { href: "/success-stories", label: "Success Stories" },
      { href: "/top-creators", label: "Top Creators" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/feedback", label: "Feedback" },
      { href: "/affiliate", label: "Affiliate Program" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/refund-policy", label: "Refund Policy" },
    ],
  },
];

function RedditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-3.5 w-3.5", className)} fill="currentColor" aria-hidden>
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  );
}

const socials = [
  { href: "https://x.com/autocliprai", icon: XLogo, label: "X (Twitter)" },
  { href: "https://www.instagram.com/autoclipr.ai/", icon: Instagram, label: "Instagram" },
  { href: "https://youtube.com/@autoclipr", icon: Youtube, label: "YouTube" },
  { href: "https://www.linkedin.com/in/autoclipr-ai/", icon: Linkedin, label: "LinkedIn" },
  { href: "https://www.reddit.com/user/autoClipr/", icon: RedditIcon, label: "Reddit" },
];

/**
 * Per-platform look for the social buttons: tinted in the brand colour at
 * rest, then a solid brand fill with a matching glow on hover.
 */
const SOCIAL_STYLE: Record<string, string> = {
  "X (Twitter)":
    "text-white bg-white/[0.06] ring-white/15 hover:bg-white hover:text-black hover:shadow-[0_8px_24px_-4px_rgba(255,255,255,0.45)]",
  Instagram:
    "text-pink-400 bg-pink-500/10 ring-pink-500/25 hover:bg-gradient-to-br hover:from-fuchsia-500 hover:via-pink-500 hover:to-orange-400 hover:text-white hover:shadow-[0_8px_24px_-4px_rgba(236,72,153,0.6)]",
  YouTube:
    "text-red-500 bg-red-500/10 ring-red-500/25 hover:bg-red-600 hover:text-white hover:shadow-[0_8px_24px_-4px_rgba(220,38,38,0.6)]",
  LinkedIn:
    "text-sky-400 bg-sky-500/10 ring-sky-500/25 hover:bg-sky-600 hover:text-white hover:shadow-[0_8px_24px_-4px_rgba(2,132,199,0.6)]",
  Reddit:
    "text-orange-500 bg-orange-500/10 ring-orange-500/25 hover:bg-orange-600 hover:text-white hover:shadow-[0_8px_24px_-4px_rgba(234,88,12,0.6)]",
};

const LINK_CLASS =
  "group inline-flex items-center gap-1 text-sm text-white/55 transition-colors hover:text-white";

function FooterLink({ href, label }: { href: string; label: string }) {
  const body = (
    <>
      <span className="transition-transform duration-200 group-hover:translate-x-0.5">{label}</span>
    </>
  );
  // Hash links (e.g. /#feature-clipping) use a plain <a> so the landing
  // carousel's hashchange listener fires on the home page.
  return href.includes("#") ? (
    <a href={href} className={LINK_CLASS}>
      {body}
    </a>
  ) : (
    <Link href={href} className={LINK_CLASS}>
      {body}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-[#05060c]">
      {/* Glows */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px]"
        style={{ background: "radial-gradient(60% 100% at 50% 100%, rgba(16,185,129,0.14), transparent 70%)" }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Newsletter card */}
        <div className="relative mt-14 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur sm:p-8">
          <div
            className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-md">
              <p className="section-label-white mb-3">Newsletter</p>
              <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Get clip tips that actually move views
              </h3>
              <p className="mt-2 text-sm text-white/55">Short-form strategy and product updates. No spam.</p>
            </div>
            <div className="w-full md:max-w-sm">
              <NewsletterSignup />
            </div>
          </div>
        </div>

        {/* Main grid. From xl the brand block takes two of eight tracks; at lg
            it spans its own row so the six nav columns get the full width. */}
        <div className="grid gap-x-6 gap-y-12 py-16 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
          {/* Brand column */}
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-6 xl:col-span-2 xl:pr-6">
            <Link href="/" className="mb-4 inline-flex items-center gap-2.5">
              <LogoIcon size={38} className="rounded-xl shadow-lg shadow-emerald-500/30" />
              <span className="text-xl font-bold text-white">
                Auto<span className="text-emerald-400">Clipr</span>
              </span>
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-white/55 xl:max-w-none">
              Turn long videos into viral shorts with AI. Monitor channels, detect uploads, auto-clip.
            </p>

            <div className="mt-6 flex gap-2.5">
              {socials.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl ring-1 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:rotate-[-6deg] hover:ring-transparent",
                    SOCIAL_STYLE[label],
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {navColumns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-5 text-xs font-semibold uppercase tracking-widest text-white">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <FooterLink href={l.href} label={l.label} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] py-6 sm:flex-row">
          <p className="text-xs text-white/45">
            © {new Date().getFullYear()} AutoClipr · All rights reserved.
            <span className="sr-only"> Operated by Kishan Kumar Maurya.</span>
          </p>
          <div className="flex gap-5">
            <Link href="/privacy" className="text-xs text-white/45 transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="text-xs text-white/45 transition-colors hover:text-white">Terms</Link>
            <Link href="/contact" className="text-xs text-white/45 transition-colors hover:text-white">Contact</Link>
          </div>
        </div>
      </div>

      {/* Giant outlined wordmark, fading into the page */}
      <div className="pointer-events-none relative -mt-2 select-none overflow-hidden" aria-hidden>
        <p
          className="text-center font-black leading-[0.8] tracking-tighter text-transparent"
          style={{
            fontSize: "clamp(4rem, 17vw, 16rem)",
            WebkitTextStroke: "1px rgba(255,255,255,0.12)",
            backgroundImage: "linear-gradient(to bottom, rgba(16,185,129,0.18), transparent 85%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            maskImage: "linear-gradient(to bottom, black 35%, transparent 100%)",
          }}
        >
          AutoClipr
        </p>
      </div>
    </footer>
  );
}
