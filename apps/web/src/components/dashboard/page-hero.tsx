import type { ReactNode } from "react";

/**
 * Hero banner used at the top of every dashboard page, matching the
 * dashboard overview: glass card, soft glows, faint grid, white label pill,
 * big title with a gradient word, and an optional actions slot.
 */
export function PageHero({
  label,
  title,
  highlight,
  description,
  actions,
}: {
  label: string;
  title: string;
  /** Word(s) shown after the title in a gradient. */
  highlight?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur sm:p-8">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse at top left, black 25%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="section-label-white mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" />
            {label}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {title}
            {highlight && (
              <>
                {" "}
                <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
                  {highlight}
                </span>
              </>
            )}
          </h1>
          {description && <p className="mt-2 max-w-2xl text-white/55">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
