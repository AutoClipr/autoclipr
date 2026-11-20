"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

/** Broadcast so opening one menu closes the others. */
const OPEN_EVENT = "autoclipr:megamenu-open";
const CLOSE_DELAY_MS = 150;

/**
 * Shared navbar dropdown in the mega-menu style: a wide dark panel, grey
 * section labels, and items with a rounded icon tile, bold title, optional
 * badge and a one-line description.
 *
 * One section → its items flow in a 3-column grid. Several sections → one
 * column per section.
 *
 * Opens on hover (with a short close delay and a padded bridge so the pointer
 * can travel into the panel) and on click / Enter / Space. Closes on outside
 * click, Escape, route change, or when another menu opens.
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
  const id = useId();
  const panelId = `${id}-panel`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const show = useCallback(() => {
    cancelClose();
    setOpen(true);
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  }, [id]);

  const close = useCallback(() => {
    cancelClose();
    setOpen(false);
  }, []);

  // Only one menu at a time.
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [id]);

  // Outside click + Escape while open.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Close on navigation.
  useEffect(() => close(), [pathname, close]);
  useEffect(() => cancelClose, []);

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      show();
      requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`#${CSS.escape(panelId)} a`)?.focus());
    }
  };

  // Arrow keys move between items inside the panel.
  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const links = [...(e.currentTarget.querySelectorAll<HTMLElement>("a"))];
    const i = links.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    links[(i + (e.key === "ArrowDown" ? 1 : links.length - 1)) % links.length]?.focus();
  };

  const single = sections.length === 1;

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        cancelClose();
        closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) close();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        onClick={() => (open ? close() : show())}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#54D045]/60",
          open ? "bg-white/[0.06] text-[#F8FAFC]" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )}
      >
        {label}
        <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
      </button>

      {/* Always mounted so it can fade out; pt-3 bridges the gap to the panel. */}
      <div
        className={cn(
          "absolute top-full z-[70] pt-3 transition-[opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none",
          align === "left" && "-left-24",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "right" && "right-0",
          open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-1 opacity-0",
        )}
      >
        <div
          id={panelId}
          role="region"
          aria-label={label}
          onKeyDown={onPanelKey}
          className="rounded-2xl border border-[#2A2D35] bg-[#17191F] p-6 shadow-2xl shadow-black/60"
          style={{ width: `min(${width}px, calc(100vw - 2rem))` }}
        >
          <div className={cn("grid gap-x-6 gap-y-6", !single && "grid-cols-3")}>
            {sections.map((section) => (
              <div key={section.title}>
                <p className="mb-4 text-sm text-[#92949D]">{section.title}</p>
                <ul className={cn("grid gap-y-5", single && "grid-cols-3 gap-x-6")}>
                  {section.items.map((item) => (
                    <li key={item.label + item.href}>
                      <MenuItem item={item} onSelect={close} tabbable={open} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {footer && <div className="mt-5 border-t border-[#2A2D35] pt-4">{footer(close)}</div>}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ item, onSelect, tabbable }: { item: MegaMenuItem; onSelect: () => void; tabbable: boolean }) {
  const Icon = item.icon;
  const body = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.07] text-[#F8FAFC] transition-colors group-hover:bg-white/[0.14] group-focus-visible:bg-white/[0.14]">
        <Icon aria-hidden className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[#F8FAFC]">{item.label}</span>
          {item.badge && (
            <span className="rounded bg-white/10 px-1.5 py-px text-[10px] font-medium text-white/80">{item.badge}</span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-[#92949D]">{item.desc}</span>
      </span>
    </>
  );
  const className =
    "group -m-2 flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-[#22262E] focus:outline-none focus-visible:bg-[#22262E] focus-visible:ring-2 focus-visible:ring-[#54D045]/50";
  const tabIndex = tabbable ? undefined : -1;

  // Hash links (/#feature-…) use a plain <a> so the browser fires `hashchange`
  // when already on the landing page; everything else uses client routing.
  return item.href.includes("#") ? (
    <a href={item.href} onClick={onSelect} className={className} tabIndex={tabIndex}>
      {body}
    </a>
  ) : (
    <Link href={item.href} onClick={onSelect} className={className} tabIndex={tabIndex}>
      {body}
    </Link>
  );
}
