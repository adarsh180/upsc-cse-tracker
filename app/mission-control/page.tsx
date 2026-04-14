import { MissionControlPanel } from "@/components/ai/mission-control-panel";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getMissionControlSnapshot } from "@/lib/mission-control";

export default async function MissionControlPage() {
  await requireSession();
  const snapshot = await getMissionControlSnapshot();

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Mission Control"
        title="Opt-in agentic execution for your preparation."
        description="Launch the planning agent only when you want a serious intervention. It reads your live tracker data, builds a structured mission, drafts a daily command, and creates todos that stay connected to the rest of the product."
        actions={
          <>
            <div className="pill">Manual launch only</div>
            <div className="pill">Mission + daily command + todo sync</div>
          </>
        }
      />

      <MissionControlPanel
        activeMission={snapshot.activeMission}
        missions={snapshot.missions}
        stats={snapshot.stats}
      />
    </main>
  );
}
