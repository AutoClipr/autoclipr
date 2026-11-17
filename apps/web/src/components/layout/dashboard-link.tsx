"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header "Dashboard" button — hidden while already on the dashboard. */
export function DashboardLink() {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;

  return (
    <Link
      href="/dashboard"
      className="hidden rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 md:inline-flex"
    >
      Dashboard
    </Link>
  );
}
