import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = { title: "Log in", robots: PRIVATE_ROBOTS };

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-3xl bg-white/5" />}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthShell>
  );
}
