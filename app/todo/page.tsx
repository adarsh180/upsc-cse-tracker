import { TodoWorkspace } from "@/components/ai/todo-workspace";
import { requireSession } from "@/lib/auth";
import { getTodoBoardSnapshot } from "@/lib/mission-control";
import { PageIntro } from "@/components/ui/sections";

export default async function TodoPage() {
  await requireSession();
  const snapshot = await getTodoBoardSnapshot();

  return (
    <main className="page-shell editorial-page editorial-todo su-page su-legacy pg-todo">
      <PageIntro
        eyebrow="Todo Workspace"
        title="Execution board"
        description="Your own tasks and the ones Mission Control sends share one board. Every change saves immediately."
        glyph="goals"
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
