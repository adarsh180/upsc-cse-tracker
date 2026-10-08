import Link from "next/link";
import { redirect } from "next/navigation";

import { UnlockForm } from "@/components/vault/unlock-form";
import { ForgeMark } from "@/components/vault/icons";
import { getSession } from "@/lib/auth";
import { hasVaultSession } from "@/lib/vault/auth";

export const dynamic = "force-dynamic";

export default async function VaultUnlockPage() {
  if (!(await getSession())) redirect("/sign-in");
  if (await hasVaultSession()) redirect("/vault");
  return (
    <main className="fg-unlock">
      <div className="fg-unlock-card">
        <span className="fg-unlock-mark">
          <ForgeMark size={34} />
        </span>
        <div>
          <span className="fg-kicker"><i /> PRIVATE · AI-ML VAULT</span>
          <h1>Unlock the Forge</h1>
        </div>
        <p>Re-enter your password to open the AI engineering workspace. The vault stays open for 12 hours on this device, closes when you sign out, and locks for 15 minutes after 5 wrong tries.</p>
        <UnlockForm />
        <Link href="/dashboard" className="fg-unlock-back">← Back to the UPSC desk</Link>
      </div>
    </main>
  );
}
