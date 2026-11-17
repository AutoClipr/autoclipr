"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pages with the dashboard sidebar, which already links to the dashboard. */
const APP_PATHS = ["/dashboard", "/create", "/upload", "/channels", "/clips", "/analytics", "/subscription", "/activity", "/settings", "/setup"];

/** Header "Dashboard" button — hidden on app pages that show the sidebar. */
export function DashboardLink() {
  const pathname = usePathname();
  if (APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <Link
      href="/dashboard"
      className="hidden rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 md:inline-flex"
    >
      Dashboard
    </Link>
  );
}
