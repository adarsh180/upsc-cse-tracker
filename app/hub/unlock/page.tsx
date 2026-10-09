import { redirect } from "next/navigation";

import { HubUnlockCard } from "@/components/hub/unlock-card";
import { getSession } from "@/lib/auth";
import { hasGateSession } from "@/lib/vault/auth";

export const dynamic = "force-dynamic";

export default async function HubUnlockPage() {
  if (!(await getSession())) redirect("/sign-in");
  if (await hasGateSession("hub")) redirect("/hub");
  return <HubUnlockCard api="/api/hub/unlock" home="/hub" back={{ href: "/dashboard", label: "Back to the UPSC desk" }} />;
}
