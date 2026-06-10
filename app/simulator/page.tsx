import { Timer } from "lucide-react";

import { PrelimsSimulator } from "@/components/ai/prelims-simulator";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  await requireSession();

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Prelims Simulator"
        title="Timed mocks built from your mistakes."
        description="Every paper is generated from your logged weak topics, revision debt and stored PYQs — then saved back into your test analytics."
        glyph="essay"
        actions={
          <div className="pill">
            <Timer size={14} />
            UPSC pace · negative marking
          </div>
        }
      />
      <section className="db-section">
        <PrelimsSimulator />
      </section>
    </main>
  );
}
