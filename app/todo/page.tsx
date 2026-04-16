import { TodoWorkspace } from "@/components/ai/todo-workspace";
import { requireSession } from "@/lib/auth";
import { getTodoBoardSnapshot } from "@/lib/mission-control";
import { PageIntro } from "@/components/ui/sections";

export default async function TodoPage() {
  await requireSession();
  const snapshot = await getTodoBoardSnapshot();

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Todo Workspace"
        title="Execution Board"
        description="Manage your mission tasks and manual todos."
        actions={
          <>
            <div className="pill">{snapshot.tasks.length} tasks</div>
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
