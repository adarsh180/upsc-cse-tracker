import Link from "next/link";
import {
  activateMissionAction,
  applyMissionDailyLogAction,
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
  Sparkles,
  Target,
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
  return (
    <section className="section-stack">
      <div className="command-grid">
        <article className="glass panel span-8 mission-launch-card">
          <div className="mission-hero-shell">
            <div>
              <div className="pill">
                <Bot size={14} />
                Agent is manual only
              </div>
              <div className="display mission-hero-title">
                Launch a mission only when you want intervention.
              </div>
              <p className="muted mission-hero-copy">
                This is your on-demand planning layer. It stays dormant until you launch it,
                then reads the tracker, drafts a hard execution brief, and turns it into actionable todos.
              </p>
              <div className="mission-value-strip">
                <div className="mission-value-card">
                  <strong>Reads live data</strong>
                  <span>tests, goals, mood, revision, essays</span>
                </div>
                <div className="mission-value-card">
                  <strong>Builds a mission</strong>
                  <span>summary, why-now, risks, daily command</span>
                </div>
                <div className="mission-value-card">
                  <strong>Feeds the board</strong>
                  <span>todos land in the shared execution workspace</span>
                </div>
              </div>
            </div>

            <form action={launchMissionControlAction} className="mission-launch-form mission-launch-form-hero" suppressHydrationWarning>
              <div className="mission-launch-form-head">
                <div className="mission-section-label">Launch brief</div>
                <div className="muted">One sharp instruction is enough.</div>
              </div>
              <textarea
                className="textarea mission-launch-textarea"
                name="goal"
                placeholder="Build a 48-hour rescue plan before my next mock. Fix my weakest prelims area. Prepare a strict 7-day revision sprint."
                suppressHydrationWarning
              />
              <div className="mission-launch-actions">
                <button className="button" type="submit" suppressHydrationWarning>
                  <Sparkles size={16} />
                  Launch Mission
                </button>
                <div className="pill">
                  <Target size={14} />
                  Manual trigger only
                </div>
              </div>
            </form>
          </div>
        </article>

        <article className="glass panel glass-strong span-4 mission-ops-card">
          <div className="eyebrow">Execution Pulse</div>
          <div className="mission-stat-grid">
            {[
              { label: "Mission launches", value: String(stats.totalMissions), icon: BrainCircuit },
              { label: "Open todos", value: String(stats.openTasks), icon: ClipboardCheck },
              { label: "Done today", value: String(stats.completedToday), icon: CheckCircle2 },
              { label: "Tracked areas", value: String(stats.trackedAreas), icon: Radar },
            ].map((item) => (
              <div key={item.label} className="mission-stat-cell">
                <div className="mission-stat-icon">
                  <item.icon size={16} />
                </div>
                <div className="display mission-stat-value">{item.value}</div>
                <div className="muted mission-stat-label">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="mission-ops-note">
            The agentic layer stays opt-in. Nothing launches on page load, route change, or idle time.
          </div>
        </article>
      </div>

      {activeMission ? (
        <article className="glass panel glass-strong mission-active-card">
          <div className="panel-title-row">
            <div>
              <div className="eyebrow">Active Mission</div>
              <div className="display" style={{ fontSize: "2.25rem", marginTop: 10 }}>
                {activeMission.title}
              </div>
              <p className="muted mission-summary-copy">{activeMission.summary}</p>
            </div>
            <div className="mission-badge-stack">
              <div className="pill" style={{ color: statusTone(activeMission.status) }}>
                <Clock3 size={13} />
                {activeMission.status}
              </div>
              {activeMission.urgency ? (
                <div className="pill" style={{ color: priorityTone(activeMission.urgency) }}>
                  <Target size={13} />
                  {activeMission.urgency} urgency
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

          <div className="mission-active-grid">
            <div className="mission-active-column">
              <div className="mission-section-label">Why now</div>
              <div className="mission-chip-grid">
                {activeMission.whyNow.map((reason) => (
                  <div key={reason} className="mission-chip-card">
                    {reason}
                  </div>
                ))}
              </div>

              {activeMission.todayPlan ? (
                <div className="mission-daily-command">
                  <div className="mission-section-label">Daily command</div>
                  <div className="mission-command-shell">
                    <div className="mission-command-row">
                      <span>Primary outcome</span>
                      <strong>{activeMission.todayPlan.primaryOutcome}</strong>
                    </div>
                    <div className="mission-command-row">
                      <span>Hours target</span>
                      <strong>{activeMission.todayPlan.hoursTarget}h</strong>
                    </div>
                    <div className="mission-command-note">
                      {activeMission.todayPlan.checkpointStrategy}
                    </div>
                    <div className="mission-command-note mission-command-note-soft">
                      {activeMission.todayPlan.shutdownRule}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeMission.plannerNotes ? (
                <div className="mission-callout">
                  <div className="mission-section-label">Planner notes</div>
                  <div className="mission-list">
                    <div>{activeMission.plannerNotes}</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mission-active-column">
              <div className="mission-section-label">Live actions</div>
              <div className="mission-action-stack">
                <form action={activateMissionAction} suppressHydrationWarning>
                  <input type="hidden" name="missionId" value={activeMission.id} suppressHydrationWarning />
                  <button className="button-secondary mission-full-btn" type="submit" suppressHydrationWarning>
                    Mark This As My Current Mission
                  </button>
                </form>
                <form action={applyMissionDailyLogAction} suppressHydrationWarning>
                  <input type="hidden" name="missionId" value={activeMission.id} suppressHydrationWarning />
                  <button className="button mission-full-btn" type="submit" suppressHydrationWarning>
                    Apply Daily Command To Goals
                  </button>
                </form>
                <Link href="/todo" className="button-secondary mission-full-btn">
                  Open Todo Execution Board
                  <ArrowRight size={16} />
                </Link>
              </div>

              {activeMission.risks.length ? (
                <div className="mission-callout danger">
                  <div className="mission-section-label">Risk alerts</div>
                  <div className="mission-list">
                    {activeMission.risks.map((risk) => (
                      <div key={risk}>{risk}</div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeMission.followUps.length ? (
                <div className="mission-callout">
                  <div className="mission-section-label">Follow-ups</div>
                  <div className="mission-list">
                    {activeMission.followUps.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mission-task-preview">
            <div className="panel-title-row">
              <div>
                <div className="mission-section-label">Generated tasks</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  The agent creates tracker-backed tasks, but you still decide what to execute.
                </div>
              </div>
              <Link href="/todo" className="pill">
                View full board
              </Link>
            </div>

            <div className="mission-task-grid">
              {activeMission.tasks.slice(0, 6).map((task) => (
                <div key={task.id} className="mission-task-card">
                  <div className="mission-task-top">
                    <div
                      className="pill"
                      style={{ color: priorityTone(task.priority), borderColor: `${priorityTone(task.priority)}33` }}
                    >
                      {task.priority}
                    </div>
                    <div className="pill" style={{ color: statusTone(task.status) }}>
                      {task.status}
                    </div>
                  </div>
                  <div className="mission-task-title">{task.title}</div>
                  <div className="muted mission-task-detail">{task.detail}</div>
                  <div className="mission-task-meta">
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
        <article className="glass panel mission-empty-card">
          <div className="mission-empty-orb" />
          <div className="display" style={{ fontSize: "2rem" }}>
            No mission has been launched yet.
          </div>
          <p className="muted" style={{ maxWidth: 760, lineHeight: 1.8 }}>
            Your Guru, analytics, and dashboard stay available as usual. Mission Control only comes alive when you
            explicitly ask it to create a structured intervention.
          </p>
        </article>
      )}

      <article className="glass panel">
        <div className="panel-title-row">
          <div>
            <div className="eyebrow">Mission History</div>
            <div className="display" style={{ fontSize: "2rem", marginTop: 8 }}>
              Previous launches
            </div>
          </div>
          <Link href="/todo" className="pill">
            Open all todos
          </Link>
        </div>
        <div className="mission-history-grid">
          {missions.length ? (
            missions.map((mission) => (
              <div key={mission.id} className="mission-history-card">
                <div className="mission-history-top">
                  <div className="mission-history-title">{mission.title}</div>
                  <div className="pill" style={{ color: statusTone(mission.status) }}>
                    {mission.status}
                  </div>
                </div>
                <div className="muted mission-history-copy">{mission.summary ?? mission.goal ?? "No summary available."}</div>
                <div className="mission-history-meta">
                  <span>{new Date(mission.launchedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                  <span>{mission.tasks.length} tasks</span>
                  {mission.model ? <span>{mission.model}</span> : null}
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
