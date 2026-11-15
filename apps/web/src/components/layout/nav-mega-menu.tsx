"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MegaMenuItem = {
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export type MegaMenuSection = {
  title: string;
  items: MegaMenuItem[];
};

/**
 * Shared navbar dropdown in the mega-menu style: a wide dark panel, grey
 * section labels, and items with a rounded icon tile, bold title, optional
 * badge and a one-line description.
 *
 * One section → its items flow in a 3-column grid. Several sections → one
 * column per section.
 */
export function NavMegaMenu({
  label,
  sections,
  align = "center",
  width = 760,
  footer,
}: {
  label: string;
  sections: MegaMenuSection[];
  /** Where the panel sits relative to the button. */
  align?: "left" | "center" | "right";
  width?: number;
  footer?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = () => setOpen(false);

  function handleMouseEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  const single = sections.length === 1;

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className={cn(
          "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors",
          open ? "bg-white/[0.06] text-white" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )}
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        // pt-3 bridges the gap so moving the mouse down doesn't close the menu
        <div
          className={cn(
            "absolute top-full pt-3",
            align === "left" && "-left-24",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "right" && "right-0",
          )}
        >
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#17181c]/95 p-6 shadow-2xl shadow-black/60 backdrop-blur-xl"
            style={{ width }}
          >
            <div className={cn("grid gap-x-6 gap-y-6", !single && "grid-cols-3")}>
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="mb-4 text-sm text-white/45">{section.title}</p>
                  <div className={cn("grid gap-y-5", single && "grid-cols-3 gap-x-6")}>
                    {section.items.map((item) => (
                      <MenuItem key={item.label + item.href} item={item} onSelect={close} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {footer && <div className="mt-5 border-t border-white/[0.06] pt-4">{footer(close)}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ item, onSelect }: { item: MegaMenuItem; onSelect: () => void }) {
  const Icon = item.icon;
  const body = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.07] text-white transition-colors group-hover:bg-white/[0.12]">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white">{item.label}</span>
          {item.badge && (
            <span className="rounded bg-white/10 px-1.5 py-px text-[10px] font-medium text-white/80">{item.badge}</span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-white/45">{item.desc}</span>
      </span>
    </>
  );
  const className = "group -m-2 flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.04]";

  // Hash links (/#feature-…) use a plain <a> so the browser fires `hashchange`
  // when already on the landing page; everything else uses client routing.
  return item.href.includes("#") ? (
    <a href={item.href} onClick={onSelect} className={className}>
      {body}
    </a>
  ) : (
    <Link href={item.href} onClick={onSelect} className={className}>
      {body}
    </Link>
  );
}
