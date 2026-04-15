"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CheckCheck, CircleDashed, Clock3, PauseCircle, PlayCircle } from "lucide-react";

import type { TodoTaskItem } from "@/lib/mission-control";

function statusTone(status: string) {
  if (status === "DONE") return "var(--botany)";
  if (status === "IN_PROGRESS") return "var(--gold)";
  if (status === "SKIPPED") return "var(--text-muted)";
  return "var(--physics)";
}

function priorityTone(priority: string) {
  if (priority === "CRITICAL") return "var(--danger)";
  if (priority === "HIGH") return "var(--gold)";
  if (priority === "MEDIUM") return "var(--physics)";
  return "var(--text-muted)";
}

export function MissionTodoBoard({
  tasks,
  pendingTaskIds,
  onStatusChange,
}: {
  tasks: TodoTaskItem[];
  pendingTaskIds: string[];
  onStatusChange: (taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED") => void;
}) {
  const columns = useMemo(
    () => [
      { key: "TODO", label: "Ready", icon: CircleDashed },
      { key: "IN_PROGRESS", label: "In Progress", icon: PlayCircle },
      { key: "DONE", label: "Done", icon: CheckCheck },
      { key: "SKIPPED", label: "Skipped", icon: PauseCircle },
    ],
    [],
  );

  return (
    <div className="todo-columns">
      {columns.map((column) => {
        const items = tasks.filter((task) => task.status === column.key);
        const toneClass =
          column.key === "TODO"
            ? "ready"
            : column.key === "IN_PROGRESS"
              ? "active"
              : column.key === "DONE"
                ? "done"
                : "skipped";

        return (
          <article key={column.key} className={`glass panel todo-column-card ${toneClass}`}>
            <div className="todo-column-head">
              <div className="todo-column-heading">
                <div className="todo-column-icon">
                  <column.icon size={15} />
                </div>
                <div>
                  <div className="todo-column-label">{column.label}</div>
                  <div className="todo-column-subtitle">Execution lane</div>
                </div>
              </div>
              <div className="todo-column-count">{items.length}</div>
            </div>

            <div className="todo-column-stack">
              {items.length ? (
                items.map((task) => {
                  const isPending = pendingTaskIds.includes(task.id);

                  return (
                    <div
                      key={task.id}
                      className={`todo-task-card ${isPending ? "is-pending" : ""}`}
                    >
                      <div className="todo-task-top">
                        <div className="todo-task-title">{task.title}</div>
                        <div className="pill" style={{ color: statusTone(task.status) }}>
                          {task.status}
                        </div>
                      </div>
                      {task.detail ? <div className="muted todo-task-copy">{task.detail}</div> : null}

                      <div className="todo-badge-row">
                        <div className="pill" style={{ color: priorityTone(task.priority) }}>
                          {task.priority}
                        </div>
                        <div className="pill">{task.taskType}</div>
                        {task.energyBand ? <div className="pill">{task.energyBand}</div> : null}
                      </div>

                      <div className="todo-meta-grid">
                        {task.estimatedMinutes ? (
                          <div className="todo-meta-cell">
                            <Clock3 size={13} />
                            {task.estimatedMinutes} min
                          </div>
                        ) : null}
                        {task.dueLabel ? <div className="todo-meta-cell">{task.dueLabel}</div> : null}
                        {task.linkedStudyNode ? (
                          <Link href={`/study/${task.linkedStudyNode.slug}`} className="todo-meta-cell todo-link-cell">
                            {task.linkedStudyNode.title}
                            <ArrowRight size={12} />
                          </Link>
                        ) : null}
                      </div>

                      <div className="todo-mission-tag">
                        <span>{task.mission.title}</span>
                        <span>{new Date(task.updatedAt).toLocaleDateString("en-IN")}</span>
                      </div>

                      {task.rationale ? (
                        <div className="todo-rationale">
                          <strong>Why this exists</strong>
                          <span>{task.rationale}</span>
                        </div>
                      ) : null}

                      {task.checklist.length ? (
                        <div className="todo-checklist">
                          {task.checklist.map((item) => (
                            <div key={item} className="todo-checkline">
                              <span className="todo-check-dot" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="todo-action-grid">
                        {task.status !== "TODO" ? (
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => onStatusChange(task.id, "TODO")}
                            disabled={isPending}
                          >
                            <CircleDashed size={14} />
                            Reset
                          </button>
                        ) : null}
                        {task.status !== "IN_PROGRESS" ? (
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                            disabled={isPending}
                          >
                            <PlayCircle size={14} />
                            Start
                          </button>
                        ) : null}
                        {task.status !== "DONE" ? (
                          <button
                            className="button"
                            type="button"
                            onClick={() => onStatusChange(task.id, "DONE")}
                            disabled={isPending}
                          >
                            <CheckCheck size={14} />
                            Done
                          </button>
                        ) : null}
                        {task.status !== "SKIPPED" ? (
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => onStatusChange(task.id, "SKIPPED")}
                            disabled={isPending}
                          >
                            <PauseCircle size={14} />
                            Skip
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="todo-empty-copy">No tasks in this column right now.</div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
