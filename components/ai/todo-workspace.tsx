"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  const [refreshing, startRefreshTransition] = useTransition();
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const stats = useMemo(() => computeStats(tasks), [tasks]);

  useEffect(() => {
    let cancelled = false;

    async function refreshBoard() {
      try {
        const response = await fetch("/api/agent/tasks", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const snapshot = (await response.json()) as {
          tasks: TodoTaskItem[];
        };

        if (!cancelled) {
          setTasks(snapshot.tasks);
        }
      } catch {
        // Keep the existing board state if the background refresh fails.
      }
    }

    refreshBoard();
    const interval = window.setInterval(() => {
      startRefreshTransition(async () => {
        await refreshBoard();
      });
    }, 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [startRefreshTransition]);

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

  function handleDeleteTask(taskId: string) {
    const previous = tasks;
    setError("");
    setPendingTaskIds((current) => [...current, taskId]);
    setTasks((current) => current.filter((task) => task.id !== taskId));

    startBoardTransition(async () => {
      try {
        const response = await fetch(`/api/agent/tasks/${taskId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Could not delete the task.");
        }
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
      <div className="todo-hero-layout">
        <article className="glass panel glass-strong">
          <div className="todo-summary-top">
            <div className="todo-summary-copy">
              <div className="display todo-summary-title">
                One board. Four states. No clutter.
              </div>
            </div>
          </div>

          <div className="todo-stat-strip">
            <div className="todo-stat-block total">
              <span>Total</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="todo-stat-block ready">
              <span>Ready</span>
              <strong>{stats.todo}</strong>
            </div>
            <div className="todo-stat-block active">
              <span>In Progress</span>
              <strong>{stats.inProgress}</strong>
            </div>
            <div className="todo-stat-block done">
              <span>Done</span>
              <strong>{stats.done}</strong>
            </div>
          </div>

          <div className="todo-status-row">
            {error ? <div className="todo-error-banner">{error}</div> : <div className="todo-status-note">Manual and agent tasks flow into the same system.</div>}
            {boardPending || refreshing ? <div className="todo-sync-chip">Syncing changes...</div> : null}
          </div>
        </article>

        <article className="glass panel todo-composer-card">
          <div className="todo-composer-head">
            <div>
              <div className="eyebrow">Manual task entry</div>
              <div className="display todo-composer-title">Drop in a sharp next move.</div>
            </div>
            <div className="todo-composer-orb" />
          </div>

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
              <select className="select todo-glass-select" name="taskType" defaultValue="PLANNING" suppressHydrationWarning>
                <option value="PLANNING">Planning</option>
                <option value="REVISION">Revision</option>
                <option value="PRACTICE">Practice</option>
                <option value="TEST">Test</option>
                <option value="ESSAY">Essay</option>
                <option value="RECOVERY">Recovery</option>
                <option value="ANALYSIS">Analysis</option>
              </select>
              <select className="select todo-glass-select" name="priority" defaultValue="MEDIUM" suppressHydrationWarning>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <select className="select todo-glass-select" name="energyBand" defaultValue="MEDIUM" suppressHydrationWarning>
                <option value="MEDIUM">Medium Energy</option>
                <option value="DEEP">Deep Work</option>
                <option value="LIGHT">Light Work</option>
              </select>
              <input className="field" type="number" min="10" max="240" step="5" name="estimatedMinutes" placeholder="Minutes" suppressHydrationWarning />
            </div>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <input className="field" name="dueLabel" placeholder="Today / Tomorrow / This week" defaultValue="This week" suppressHydrationWarning />
              <select className="select todo-glass-select" name="linkedStudyNodeId" defaultValue="" suppressHydrationWarning>
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
      </div>

      <MissionTodoBoard
        tasks={tasks}
        pendingTaskIds={pendingTaskIds}
        onStatusChange={handleStatusChange}
        onDeleteTask={handleDeleteTask}
      />
    </section>
  );
}
