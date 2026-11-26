import type { Metadata } from "next";
import { Suspense } from "react";
import { RevenueDashboard } from "@/components/admin/revenue-dashboard";

export const metadata: Metadata = { title: "Revenue" };

export default function RevenuePage() {
  return (
    <Suspense>
      <RevenueDashboard />
    </Suspense>
  );
}
