"use client";

import { FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Sparkles, Target } from "lucide-react";

import { MissionTodoBoard } from "@/components/ai/mission-todo-board";
import type { TodoTaskItem } from "@/lib/mission-control";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED";

function computeStats(tasks: TodoTaskItem[]) {
  return {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === "TODO").length,
    inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    done: tasks.filter((task) => task.status === "DONE").length,
  };
}

export function TodoWorkspace({
  tasks: initialTasks,
  studyAreas,
}: {
  tasks: TodoTaskItem[];
  studyAreas: Array<{ id: string; slug: string; title: string }>;
  stats: { total: number; todo: number; inProgress: number; done: number };
}) {
  const [tasks, setTasks] = useState<TodoTaskItem[]>(initialTasks);
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);
  const [composerPending, startComposerTransition] = useTransition();
  const [boardPending, startBoardTransition] = useTransition();
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const stats = useMemo(() => computeStats(tasks), [tasks]);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;

    const linkedStudyNodeId = String(formData.get("linkedStudyNodeId") ?? "").trim();
    const linkedStudyNode = studyAreas.find((area) => area.id === linkedStudyNodeId) ?? null;
    const tempId = `temp-${Date.now()}`;
    const optimisticTask: TodoTaskItem = {
      id: tempId,
      title,
      detail: String(formData.get("detail") ?? "").trim() || null,
      rationale: "Added manually from the Todo workspace.",
      taskType: String(formData.get("taskType") ?? "PLANNING"),
      status: "TODO",
      priority: String(formData.get("priority") ?? "MEDIUM"),
      energyBand: String(formData.get("energyBand") ?? "MEDIUM"),
      dueLabel: String(formData.get("dueLabel") ?? "").trim() || "This week",
      estimatedMinutes: Number(formData.get("estimatedMinutes") ?? 0) || null,
      checklist: [],
      mission: {
        id: "manual-temp",
        title: "Manual Todo Inbox",
        urgency: "MEDIUM",
        launchedAt: new Date().toISOString(),
      },
      linkedStudyNode: linkedStudyNode
        ? { id: linkedStudyNode.id, slug: linkedStudyNode.slug, title: linkedStudyNode.title }
        : null,
      updatedAt: new Date().toISOString(),
    };

    setError("");
    setTasks((current) => [optimisticTask, ...current]);
    form.reset();

    startComposerTransition(async () => {
      try {
        const response = await fetch("/api/agent/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            detail: optimisticTask.detail,
            taskType: optimisticTask.taskType,
            priority: optimisticTask.priority,
            energyBand: optimisticTask.energyBand,
            estimatedMinutes: optimisticTask.estimatedMinutes,
            dueLabel: optimisticTask.dueLabel,
            linkedStudyNodeId: linkedStudyNodeId || null,
          }),
        });

        if (!response.ok) {
          throw new Error("Could not create the task.");
        }

        const createdTask = (await response.json()) as TodoTaskItem;
        setTasks((current) =>
          current.map((task) => (task.id === tempId ? createdTask : task)),
        );
      } catch (caughtError) {
        setTasks((current) => current.filter((task) => task.id !== tempId));
        setError((caughtError as Error).message);
      }
    });
  }

  function handleStatusChange(taskId: string, status: TaskStatus) {
    const previous = tasks;
    setError("");
    setPendingTaskIds((current) => [...current, taskId]);
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, status, updatedAt: new Date().toISOString() } : task,
      ),
    );

    startBoardTransition(async () => {
      try {
        const response = await fetch(`/api/agent/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          throw new Error("Could not update the task.");
        }

        const updatedTask = (await response.json()) as TodoTaskItem;
        setTasks((current) =>
          current.map((task) => (task.id === taskId ? updatedTask : task)),
        );
      } catch (caughtError) {
        setTasks(previous);
        setError((caughtError as Error).message);
      } finally {
        setPendingTaskIds((current) => current.filter((id) => id !== taskId));
      }
    });
  }

  return (
    <section className="section-stack">
      <div className="command-grid">
        <article className="glass panel span-4 todo-composer-card">
          <div className="pill">
            <Plus size={14} />
            Manual task entry
          </div>
          <div className="display" style={{ fontSize: "2rem", marginTop: 16 }}>
            Add a task yourself.
          </div>
          <p className="muted" style={{ marginTop: 10, lineHeight: 1.8 }}>
            Use this even when Mission Control is idle. Manual tasks go into the same board and stay connected to your tracker.
          </p>

          <form
            ref={formRef}
            className="todo-composer-form"
            onSubmit={handleCreateTask}
            suppressHydrationWarning
          >
            <input className="field" name="title" placeholder="Task title" required suppressHydrationWarning />
            <textarea
              className="textarea todo-composer-textarea"
              name="detail"
              placeholder="Optional notes, target chapter, or exact execution instruction"
              suppressHydrationWarning
            />
            <div className="grid grid-2" style={{ gap: 10 }}>
              <select className="select" name="taskType" defaultValue="PLANNING" suppressHydrationWarning>
                <option value="PLANNING">Planning</option>
                <option value="REVISION">Revision</option>
                <option value="PRACTICE">Practice</option>
                <option value="TEST">Test</option>
                <option value="ESSAY">Essay</option>
                <option value="RECOVERY">Recovery</option>
                <option value="ANALYSIS">Analysis</option>
              </select>
              <select className="select" name="priority" defaultValue="MEDIUM" suppressHydrationWarning>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <select className="select" name="energyBand" defaultValue="MEDIUM" suppressHydrationWarning>
                <option value="MEDIUM">Medium Energy</option>
                <option value="DEEP">Deep Work</option>
                <option value="LIGHT">Light Work</option>
              </select>
              <input className="field" type="number" min="10" max="240" step="5" name="estimatedMinutes" placeholder="Minutes" suppressHydrationWarning />
            </div>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <input className="field" name="dueLabel" placeholder="Today / Tomorrow / This week" defaultValue="This week" suppressHydrationWarning />
              <select className="select" name="linkedStudyNodeId" defaultValue="" suppressHydrationWarning>
                <option value="">No linked study area</option>
                {studyAreas.map((area) => (
                  <option key={area.id} value={area.id}>{area.title}</option>
                ))}
              </select>
            </div>
            <button className="button todo-composer-submit" type="submit" disabled={composerPending} suppressHydrationWarning>
              <Plus size={16} />
              {composerPending ? "Adding..." : "Add Todo"}
            </button>
          </form>
        </article>

        <article className="glass panel glass-strong span-8 todo-summary-card">
          <div className="todo-summary-top">
            <div>
              <div className="eyebrow">Execution Board</div>
              <div className="display" style={{ fontSize: "2.2rem", marginTop: 10 }}>
                One place for agent tasks and manual tasks.
              </div>
              <p className="muted" style={{ marginTop: 10, maxWidth: 760, lineHeight: 1.82 }}>
                The board should help you move, not impress you. Add your own todos, run a mission when needed,
                and track both in the same workspace.
              </p>
            </div>
            <div className="todo-summary-pills">
              <div className="pill">
                <Sparkles size={13} />
                Agent tasks when launched
              </div>
              <div className="pill">
                <Target size={13} />
                Manual tasks anytime
              </div>
            </div>
          </div>

          <div className="todo-stat-strip">
            <div className="todo-stat-block">
              <span>Total</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="todo-stat-block">
              <span>Ready</span>
              <strong>{stats.todo}</strong>
            </div>
            <div className="todo-stat-block">
              <span>In Progress</span>
              <strong>{stats.inProgress}</strong>
            </div>
            <div className="todo-stat-block">
              <span>Done</span>
              <strong>{stats.done}</strong>
            </div>
          </div>

          {error ? <div className="todo-error-banner">{error}</div> : null}
          {boardPending ? <div className="todo-sync-chip">Syncing changes...</div> : null}
        </article>
      </div>

      <MissionTodoBoard
        tasks={tasks}
        pendingTaskIds={pendingTaskIds}
        onStatusChange={handleStatusChange}
      />
    </section>
  );
}
