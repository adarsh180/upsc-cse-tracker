import { ForgeNav } from "@/components/vault/forge-nav";
import { requireVault } from "@/lib/vault/auth";

export const dynamic = "force-dynamic";

/** Every arena page sits behind the vault session (the proxy checks too). */
export default async function ArenaLayout({ children }: { children: React.ReactNode }) {
  await requireVault();
  return (
    <>
      <ForgeNav />
      {children}
    </>
  );
}
