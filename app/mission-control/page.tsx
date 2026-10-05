import { MissionControlPanel } from "@/components/ai/mission-control-panel";
import { requireSession } from "@/lib/auth";
import { getMissionControlSnapshot } from "@/lib/mission-control";
import { PageIntro } from "@/components/ui/sections";

export default async function MissionControlPage() {
  await requireSession();
  const snapshot = await getMissionControlSnapshot();

  return (
    <main className="page-shell editorial-page editorial-mission-control su-page su-legacy pg-mission">
      <PageIntro
        eyebrow="Mission Control"
        title="Plan, then act"
        description="Launch a deliberate planning pass with the agent, then send what it proposes into your daily goals and todo board."
        glyph="guru"
      />
      <MissionControlPanel
        activeMission={snapshot.activeMission}
        missions={snapshot.missions}
        stats={snapshot.stats}
      />
    </main>
  );
}
