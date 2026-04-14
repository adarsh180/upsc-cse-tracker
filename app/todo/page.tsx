import { TodoWorkspace } from "@/components/ai/todo-workspace";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getTodoBoardSnapshot } from "@/lib/mission-control";

export default async function TodoPage() {
  await requireSession();
  const snapshot = await getTodoBoardSnapshot();

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Todo Workspace"
        title="Run the work, with or without the agent."
        description="Use this page as your real execution board. Agent-created tasks land here after a mission launch, and you can also add your own manual todos anytime."
        actions={
          <>
            <div className="pill">{snapshot.tasks.length} total tasks</div>
            <div className="pill">{snapshot.missions.length} mission records</div>
          </>
        }
      />

      <TodoWorkspace
        tasks={snapshot.tasks}
        studyAreas={snapshot.studyAreas}
        stats={snapshot.stats}
      />
    </main>
  );
}
