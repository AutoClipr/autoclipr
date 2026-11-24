import type { Metadata } from "next";
import { Suspense } from "react";
import { ExecutiveDashboard } from "@/components/admin/executive-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <Suspense>
      <ExecutiveDashboard />
    </Suspense>
  );
}
