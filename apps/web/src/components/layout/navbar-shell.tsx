"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky header frame. Clear over the top of the page, then a blurred dark
 * background and a thin bottom line once the page scrolls, so the links stay
 * readable over the hero videos.
 */
export function NavbarShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-[100] transition-[background-color,backdrop-filter,box-shadow] duration-300",
        scrolled ? "bg-[#030014]/80 shadow-lg shadow-black/20 backdrop-blur-2xl" : "bg-transparent",
      )}
    >
      {/* Thin line under the navbar, only once scrolled */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-px bg-white/[0.07] transition-opacity duration-300",
          scrolled ? "opacity-100" : "opacity-0",
        )}
      />
      {children}
    </header>
  );
}
