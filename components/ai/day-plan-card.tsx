"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, Sparkles, X } from "lucide-react";

type ProposedTask = {
  title: string;
  detail: string;
  taskType: string;
  priority: string;
  energyBand: string;
  estimatedMinutes: number;
  subject?: string;
};

type DayPlanCardProps = {
  planId: string;
  briefingTitle: string;
  briefingText: string;
  tasks: ProposedTask[];
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#f87171",
  HIGH: "#fbbf24",
  MEDIUM: "#93c5fd",
  LOW: "#a3a3a3",
};

export function DayPlanCard({ planId, briefingTitle, briefingText, tasks }: DayPlanCardProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<boolean[]>(() => tasks.map(() => true));
  const [busy, setBusy] = useState<"approve" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const selectedCount = selected.filter(Boolean).length;
  const totalMinutes = tasks.reduce((sum, task, index) => (selected[index] ? sum + task.estimatedMinutes : sum), 0);

  async function act(action: "approve" | "dismiss") {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch("/api/day-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? {
                action,
                planId,
                taskIndexes: selected.flatMap((isSelected, index) => (isSelected ? [index] : [])),
              }
            : { action, planId },
        ),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error ?? "Request failed");
      setOutcome(
        action === "approve"
          ? `${data.createdCount} task(s) added to your todo board.`
          : "Plan dismissed for today.",
      );
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Request failed");
      setBusy(null);
    }
  }

  if (outcome) {
    return (
      <article className="glass day-plan-approval-card">
        <p style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCheck size={16} style={{ color: "#4ade80" }} />
          {outcome}
        </p>
      </article>
    );
  }

  return (
    <article className="glass day-plan-approval-card">
      <div className="day-plan-head">
        <span className="day-plan-sigil">
          <Sparkles size={16} />
        </span>
        <div>
          <div className="eyebrow">Guru briefing</div>
          <h2 className="day-plan-title">{briefingTitle}</h2>
        </div>
        <span className="pill day-plan-pill">Awaiting your approval</span>
      </div>

      <p className="day-plan-brief">{briefingText}</p>

      <div className="day-plan-task-list">
        {tasks.map((task, index) => (
          <label key={index} className={`day-plan-task ${selected[index] ? "" : "is-muted"}`}>
            <input
              type="checkbox"
              checked={selected[index]}
              onChange={() =>
                setSelected((previous) => previous.map((value, i) => (i === index ? !value : value)))
              }
            />
            <span className="day-plan-task-copy">
              <strong>{task.title}</strong>{" "}
              <span style={{ color: PRIORITY_COLORS[task.priority] ?? "inherit", fontSize: 11, fontWeight: 700 }}>
                {task.priority}
              </span>{" "}
              <span className="day-plan-task-meta">
                {task.taskType} - ~{task.estimatedMinutes}m{task.subject ? ` - ${task.subject}` : ""}
              </span>
              <br />
              <span className="day-plan-task-detail">{task.detail}</span>
            </span>
          </label>
        ))}
      </div>

      {error ? <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>{error}</p> : null}

      <div className="day-plan-actions">
        <button
          type="button"
          className="button"
          disabled={busy !== null || selectedCount === 0}
          onClick={() => act("approve")}
          style={{ minHeight: 38 }}
        >
          {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
          Approve {selectedCount}/{tasks.length} tasks
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={busy !== null}
          onClick={() => act("dismiss")}
          style={{ minHeight: 38 }}
        >
          <X size={14} />
          Not today
        </button>
        <span className="day-plan-hours">~ {Math.round((totalMinutes / 60) * 10) / 10}h planned</span>
      </div>
    </article>
  );
}
