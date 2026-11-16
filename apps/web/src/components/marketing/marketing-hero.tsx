import type { ReactNode } from "react";

/**
 * Centred page hero shared by the smaller marketing pages (contact, feedback,
 * coaching, landing pages, legal). Soft green glow, faint grid, white label
 * pill and a big title whose last part can be a gradient.
 */
export function MarketingHero({
  label,
  title,
  highlight,
  description,
  icon,
  children,
}: {
  label: string;
  title: ReactNode;
  highlight?: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-24">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 0%, rgba(16,185,129,0.18), transparent 70%), radial-gradient(30% 40% at 85% 10%, rgba(139,92,246,0.1), transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at top, black 20%, transparent 65%)",
        }}
        aria-hidden
      />
      <div className="mx-auto max-w-3xl">
        {icon && (
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/25 to-teal-500/10 text-emerald-200 shadow-[0_0_40px_-8px_rgba(16,185,129,0.7)]">
            {icon}
          </div>
        )}
        <p className="section-label-white mx-auto mb-6">{label}</p>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          {title}
          {highlight && (
            <>
              {" "}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                {highlight}
              </span>
            </>
          )}
        </h1>
        {description && (
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/60">{description}</p>
        )}
        {children}
      </div>
    </section>
  );
}
