import { redirect } from "next/navigation";

import { getVaultState } from "@/lib/vault/data";

export const dynamic = "force-dynamic";

/** "Gates" opens the gate you are working on. */
export default async function StageIndex() {
  const { metrics } = await getVaultState();
  redirect(`/vault/stage/${metrics.currentStage}`);
}
