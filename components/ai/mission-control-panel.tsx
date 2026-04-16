import Link from "next/link";
import {
  activateMissionAction,
  applyMissionDailyLogAction,
  deleteMissionHistoryAction,
  launchMissionControlAction,
} from "@/app/actions";
import { MissionView } from "@/lib/mission-control";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Layers3,
  Radar,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";

function priorityTone(priority: string) {
  if (priority === "CRITICAL") return "var(--danger)";
  if (priority === "HIGH") return "var(--gold)";
  if (priority === "MEDIUM") return "var(--physics)";
  return "var(--text-muted)";
}

function statusTone(status: string) {
  if (status === "DONE" || status === "COMPLETED") return "var(--botany)";
  if (status === "IN_PROGRESS" || status === "ACTIVE") return "var(--gold)";
  if (status === "APPLIED") return "var(--physics)";
  if (status === "SKIPPED") return "var(--text-muted)";
  return "var(--rose-bright)";
}

function MissionMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BrainCircuit;
}) {
  return (
    <div className="mission-glass-stat">
      <div className="mission-glass-stat-top">
        <span className="mission-glass-icon">
          <Icon size={15} />
        </span>
        <span className="mission-glass-label">{label}</span>
      </div>
      <div className="display mission-glass-value">{value}</div>
    </div>
  );
}

export function MissionControlPanel({
  activeMission,
  missions,
  stats,
}: {
  activeMission: MissionView | null;
  missions: MissionView[];
  stats: {
    totalMissions: number;
    openTasks: number;
    completedToday: number;
    trackedAreas: number;
  };
}) {
  const history = missions.filter((mission) => mission.id !== activeMission?.id);

  return (
    <section className="section-stack mission-control-redesign">
      <section className="mission-control-top">
        <article className="glass panel mission-control-launch">
          <div className="mission-control-launch-copy">
            <div className="eyebrow">Mission Console</div>
            <div className="display mission-control-hero-title">Minimal command. Precise execution.</div>
            <p className="mission-control-hero-copy">
              Keep the agentic layer deliberate. One clear instruction creates a tracker-backed mission without disturbing your existing study flow.
            </p>
            <div className="mission-control-quiet-note">
              <Bot size={14} />
              Manual trigger only. No hidden background runs.
            </div>
          </div>

          <form action={launchMissionControlAction} className="mission-control-launch-form">
            <div className="mission-control-input-shell">
              <div className="mission-control-input-label">Launch brief</div>
              <textarea
                className="textarea mission-control-textarea"
                name="goal"
                placeholder="Build a 7-day recovery mission for my weakest GS area. Create a strict 48-hour mock rescue plan. Turn my current backlog into a controlled execution sprint."
              />
            </div>
            <div className="mission-control-launch-actions">
              <button className="button" type="submit">
                <Sparkles size={16} />
                Launch Mission
              </button>
              <Link href="/todo" className="button-secondary">
                Open Todo Board
                <ArrowRight size={15} />
              </Link>
            </div>
          </form>
        </article>

        <article className="glass panel glass-strong mission-control-pulse">
          <div className="mission-control-pulse-head">
            <div>
              <div className="eyebrow">Execution Pulse</div>
              <div className="display mission-control-pulse-title">Quiet system, hard outputs</div>
            </div>
            <div className="mission-control-orb" />
          </div>

          <div className="mission-control-metrics">
            <MissionMetric label="Launches" value={String(stats.totalMissions)} icon={BrainCircuit} />
            <MissionMetric label="Open todos" value={String(stats.openTasks)} icon={ClipboardCheck} />
            <MissionMetric label="Done today" value={String(stats.completedToday)} icon={CheckCircle2} />
            <MissionMetric label="Tracked areas" value={String(stats.trackedAreas)} icon={Radar} />
          </div>
        </article>
      </section>

      {activeMission ? (
        <article className="glass panel glass-strong mission-control-active">
          <div className="mission-control-active-top">
            <div className="mission-control-active-copy">
              <div className="eyebrow">Active Mission</div>
              <div className="display mission-control-active-title">{activeMission.title}</div>
              <p className="mission-control-active-summary">{activeMission.summary}</p>
            </div>

            <div className="mission-control-chip-rail">
              <div className="pill" style={{ color: statusTone(activeMission.status) }}>
                <Clock3 size={13} />
                {activeMission.status}
              </div>
              {activeMission.urgency ? (
                <div className="pill" style={{ color: priorityTone(activeMission.urgency) }}>
                  <Target size={13} />
                  {activeMission.urgency}
                </div>
              ) : null}
              {activeMission.executionWindow ? (
                <div className="pill">
                  <Clock3 size={13} />
                  {activeMission.executionWindow}
                </div>
              ) : null}
              <div className="pill">
                <Layers3 size={13} />
                {activeMission.tasks.length} tasks
              </div>
            </div>
          </div>

          <div className="mission-control-active-grid">
            <div className="mission-control-column">
              <div className="mission-control-block">
                <div className="mission-control-block-head">
                  <span className="mission-glass-icon">
                    <Target size={14} />
                  </span>
                  <span>Why now</span>
                </div>
                <div className="mission-control-why-grid">
                  {activeMission.whyNow.map((reason) => (
                    <div key={reason} className="mission-control-why-card">
                      {reason}
                    </div>
                  ))}
                </div>
              </div>

              {activeMission.todayPlan ? (
                <div className="mission-control-block mission-control-command-block">
                  <div className="mission-control-block-head">
                    <span className="mission-glass-icon">
                      <Sparkles size={14} />
                    </span>
                    <span>Daily command</span>
                  </div>
                  <div className="mission-control-command-grid">
                    <div className="mission-control-command-item">
                      <span>Primary outcome</span>
                      <strong>{activeMission.todayPlan.primaryOutcome}</strong>
                    </div>
                    <div className="mission-control-command-item">
                      <span>Hours target</span>
                      <strong>{activeMission.todayPlan.hoursTarget}h</strong>
                    </div>
                    <div className="mission-control-command-note">{activeMission.todayPlan.checkpointStrategy}</div>
                    <div className="mission-control-command-note soft">{activeMission.todayPlan.shutdownRule}</div>
                  </div>
                </div>
              ) : null}

              {activeMission.plannerNotes ? (
                <div className="mission-control-block">
                  <div className="mission-control-block-head">
                    <span className="mission-glass-icon">
                      <BrainCircuit size={14} />
                    </span>
                    <span>Planner notes</span>
                  </div>
                  <div className="mission-control-note-card">{activeMission.plannerNotes}</div>
                </div>
              ) : null}
            </div>

            <div className="mission-control-column">
              <div className="mission-control-side-stack">
                <div className="mission-control-action-card">
                  <div className="mission-control-block-head">
                    <span className="mission-glass-icon">
                      <ClipboardCheck size={14} />
                    </span>
                    <span>Live actions</span>
                  </div>
                  <div className="mission-control-action-stack">
                    <form action={activateMissionAction}>
                      <input type="hidden" name="missionId" value={activeMission.id} />
                      <button className="button-secondary mission-full-btn" type="submit">
                        Mark as Current Mission
                      </button>
                    </form>
                    <form action={applyMissionDailyLogAction}>
                      <input type="hidden" name="missionId" value={activeMission.id} />
                      <button className="button mission-full-btn" type="submit">
                        Apply Daily Command to Goals
                      </button>
                    </form>
                    <Link href="/todo" className="button-secondary mission-full-btn">
                      Open Todo Execution Board
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>

                {activeMission.risks.length ? (
                  <div className="mission-control-alert-card danger">
                    <div className="mission-control-block-head">
                      <span className="mission-glass-icon">
                        <ShieldAlert size={14} />
                      </span>
                      <span>Risk alerts</span>
                    </div>
                    <div className="mission-control-list">
                      {activeMission.risks.map((risk) => (
                        <div key={risk}>{risk}</div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeMission.followUps.length ? (
                  <div className="mission-control-alert-card">
                    <div className="mission-control-block-head">
                      <span className="mission-glass-icon">
                        <ArrowRight size={14} />
                      </span>
                      <span>Follow-ups</span>
                    </div>
                    <div className="mission-control-list">
                      {activeMission.followUps.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mission-control-tasks">
            <div className="mission-control-tasks-head">
              <div>
                <div className="mission-control-block-head">
                  <span className="mission-glass-icon">
                    <Layers3 size={14} />
                  </span>
                  <span>Generated tasks</span>
                </div>
                <div className="muted mission-control-tasks-copy">
                  The agent prepares the board, but execution stays under your control.
                </div>
              </div>
              <Link href="/todo" className="pill">
                View full board
              </Link>
            </div>

            <div className="mission-control-task-grid">
              {activeMission.tasks.slice(0, 6).map((task) => (
                <div key={task.id} className="mission-control-task-card">
                  <div className="mission-control-task-top">
                    <div className="pill" style={{ color: priorityTone(task.priority), borderColor: `${priorityTone(task.priority)}33` }}>
                      {task.priority}
                    </div>
                    <div className="pill" style={{ color: statusTone(task.status) }}>
                      {task.status}
                    </div>
                  </div>
                  <div className="mission-control-task-title">{task.title}</div>
                  <div className="mission-control-task-detail">{task.detail}</div>
                  <div className="mission-control-task-meta">
                    <span>{task.taskType}</span>
                    {task.estimatedMinutes ? <span>{task.estimatedMinutes} min</span> : null}
                    {task.linkedStudyNode ? <span>{task.linkedStudyNode.title}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      ) : (
        <article className="glass panel mission-control-empty">
          <div className="mission-control-empty-art" />
          <div className="display mission-control-empty-title">No mission launched yet</div>
          <p className="mission-control-empty-copy">
            Your tracker, Guru, and analytics stay active as usual. Mission Control only steps in when you ask for a structured intervention.
          </p>
        </article>
      )}

      <article className="glass panel mission-control-history">
        <div className="mission-control-history-head">
          <div>
            <div className="eyebrow">Mission History</div>
            <div className="display mission-control-history-title">Previous launches</div>
          </div>
          <Link href="/todo" className="pill">
            Open all todos
          </Link>
        </div>

        <div className="mission-control-history-grid">
          {history.length ? (
            history.map((mission) => (
              <div key={mission.id} className="mission-control-history-card">
                <div className="mission-control-history-top">
                  <div className="mission-control-history-copyblock">
                    <div className="mission-control-history-name">{mission.title}</div>
                    <div className="mission-control-history-copy">{mission.summary ?? mission.goal ?? "No summary available."}</div>
                  </div>
                  <div className="pill" style={{ color: statusTone(mission.status) }}>
                    {mission.status}
                  </div>
                </div>

                <div className="mission-control-history-meta">
                  <span>{new Date(mission.launchedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                  <span>{mission.tasks.length} tasks</span>
                  {mission.model ? <span>{mission.model}</span> : null}
                  <form action={deleteMissionHistoryAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="missionId" value={mission.id} />
                    <button type="submit" className="mission-control-delete-btn" aria-label="Delete history">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <div className="muted">No mission history yet.</div>
          )}
        </div>
      </article>
    </section>
  );
}
