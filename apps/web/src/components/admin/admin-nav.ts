import {
  Activity, BarChart2, Bell, Bot, ClipboardList, CreditCard, DollarSign, Globe, LayoutDashboard, Link2,
  Mail, Settings, ShieldCheck, Ticket, Trophy, Users, Video, XCircle, type LucideIcon,
} from "lucide-react";

export type AdminNavItem = { href: string; icon: LucideIcon; label: string; keywords?: string };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

/** Admin navigation, grouped. Every admin route is listed once. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "Dashboard", keywords: "home executive kpi" },
      { href: "/admin/analytics", icon: BarChart2, label: "Analytics", keywords: "charts trends" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/admin/users", icon: Users, label: "Users", keywords: "customers signups accounts" },
      { href: "/admin/revenue", icon: DollarSign, label: "Revenue", keywords: "mrr arr transactions" },
      { href: "/admin/subscriptions", icon: CreditCard, label: "Subscriptions", keywords: "plans churn" },
      { href: "/admin/coupons", icon: Ticket, label: "Coupons", keywords: "discounts promo" },
      { href: "/admin/affiliates", icon: Link2, label: "Affiliates", keywords: "referrals" },
      { href: "/admin/campaigns", icon: Mail, label: "Campaigns", keywords: "email marketing" },
      { href: "/admin/countries", icon: Globe, label: "Countries", keywords: "geo regions" },
    ],
  },
  {
    label: "AI Intelligence",
    items: [
      { href: "/admin/ai-usage", icon: Bot, label: "AI Usage", keywords: "hooks captions credits" },
      { href: "/admin/videos", icon: Video, label: "Videos & Clips", keywords: "content storage" },
      { href: "/admin/top-creators", icon: Trophy, label: "Top Creators", keywords: "youtube channels" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/system", icon: Activity, label: "System Health", keywords: "queue jobs cpu memory" },
      { href: "/admin/errors", icon: XCircle, label: "Errors", keywords: "failures logs" },
      { href: "/admin/notifications", icon: Bell, label: "Notifications", keywords: "alerts" },
      { href: "/admin/audit-logs", icon: ClipboardList, label: "Audit Logs", keywords: "history actions" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/settings", icon: Settings, label: "Settings", keywords: "config" },
      { href: "/admin/team", icon: ShieldCheck, label: "Admin Team", keywords: "roles permissions" },
    ],
  },
];

export const isActivePath = (pathname: string, href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(href));
