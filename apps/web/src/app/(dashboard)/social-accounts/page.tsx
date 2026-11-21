import { Suspense } from "react";
import { PlatformConnectionSetup } from "@/components/setup/platform-connection-setup";

export const metadata = { title: "Social accounts" };

/** Connect and manage publishing accounts, inside the dashboard. */
export default function SocialAccountsPage() {
  return (
    <Suspense>
      <PlatformConnectionSetup mode="dashboard" embedded />
    </Suspense>
  );
}
