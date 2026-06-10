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
      <article className="glass" style={{ padding: "18px 22px", borderRadius: 16 }}>
        <p style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCheck size={16} style={{ color: "#4ade80" }} />
          {outcome}
        </p>
      </article>
    );
  }

  return (
    <article
      className="glass"
      style={{
        padding: "22px 24px",
        borderRadius: 18,
        border: "1px solid color-mix(in srgb, var(--gold-bright, #d4af37) 35%, transparent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Sparkles size={16} style={{ color: "var(--gold-bright, #d4af37)" }} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>{briefingTitle}</span>
        <span className="pill" style={{ marginLeft: "auto", fontSize: 11 }}>
          Awaiting your approval
        </span>
      </div>
      <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6, marginBottom: 16 }}>{briefingText}</p>

      <div style={{ display: "grid", gap: 8 }}>
        {tasks.map((task, index) => (
          <label
            key={index}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 12,
              cursor: "pointer",
              background: "color-mix(in srgb, currentColor 4%, transparent)",
              opacity: selected[index] ? 1 : 0.5,
            }}
          >
            <input
              type="checkbox"
              checked={selected[index]}
              onChange={() =>
                setSelected((previous) => previous.map((value, i) => (i === index ? !value : value)))
              }
              style={{ marginTop: 3 }}
            />
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>
              <strong>{task.title}</strong>{" "}
              <span style={{ color: PRIORITY_COLORS[task.priority] ?? "inherit", fontSize: 11, fontWeight: 700 }}>
                {task.priority}
              </span>{" "}
              <span style={{ opacity: 0.6, fontSize: 11 }}>
                {task.taskType} · ~{task.estimatedMinutes}m{task.subject ? ` · ${task.subject}` : ""}
              </span>
              <br />
              <span style={{ opacity: 0.75 }}>{task.detail}</span>
            </span>
          </label>
        ))}
      </div>

      {error ? <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className="button-primary"
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
        <span style={{ fontSize: 12, opacity: 0.6 }}>≈ {Math.round((totalMinutes / 60) * 10) / 10}h planned</span>
      </div>
    </article>
  );
}
