import { MissionControlPanel } from "@/components/ai/mission-control-panel";
import { requireSession } from "@/lib/auth";
import { getMissionControlSnapshot } from "@/lib/mission-control";
import { PageIntro } from "@/components/ui/sections";

export default async function MissionControlPage() {
  await requireSession();
  const snapshot = await getMissionControlSnapshot();

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Mission Control"
        title="Agentic Execution"
        description="The agent reads live data to build and execute missions."
      />
      <MissionControlPanel
        activeMission={snapshot.activeMission}
        missions={snapshot.missions}
        stats={snapshot.stats}
      />
    </main>
  );
}
