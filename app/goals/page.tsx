import { CalendarDays, Flame, Save, Target, Trash2 } from "lucide-react";

import { deleteDailyGoalAction, saveDailyGoalAction } from "@/app/actions";
import { DailyGoalsSignalChart } from "@/components/charts/analytics-charts";
import { ActivityHeatmap } from "@/components/ui/heatmap";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

const IST_TIME_ZONE = "Asia/Kolkata";
const HEATMAP_START_KEY = "2026-04-01";

function formatIstDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";

  return `${year}-${month}-${day}`;
}

function formatIstLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatIstFullDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function GoalsPage() {
  await requireSession();

  const todayKey = formatIstDateKey(new Date());
  const todayLabel = formatIstLabel(new Date());
  const heatmapStartDate = new Date("2026-04-01T00:00:00+05:30");

  const logs = await db.dailyLog.findMany({
    where: {
      logDate: { gte: heatmapStartDate },
    },
    orderBy: { logDate: "desc" },
  });

  const tableLogs = logs.slice(0, 30);
  const recentLogs = logs.slice(0, 7);
  const latestLog = logs[0];
  const sevenDayHours = recentLogs.reduce((sum, log) => sum + log.totalHours, 0);
  const sevenDayQuestions = recentLogs.reduce((sum, log) => sum + log.questionsSolved, 0);
  const avgDiscipline = recentLogs.length
    ? Math.round(recentLogs.reduce((sum, log) => sum + log.disciplineScore, 0) / recentLogs.length)
    : 0;
  const avgCompletion = recentLogs.length
    ? Math.round(recentLogs.reduce((sum, log) => sum + log.completion, 0) / recentLogs.length)
    : 0;

  const heatmapData = logs.map((log) => ({
    date: formatIstDateKey(log.logDate),
    hours: log.totalHours,
    completion: log.completion,
  }));

  const trendData = [...tableLogs].reverse().map((log) => ({
    label: formatIstLabel(log.logDate),
    hours: log.totalHours,
    questions: log.questionsSolved,
    topics: log.topicsStudied,
    discipline: log.disciplineScore,
    completion: log.completion,
  }));

  return (
    <main className="page-shell goals-page">
      <PageIntro
        eyebrow="Daily Goals"
        title="Execution, beautifully measured."
        description="A cleaner command surface for hours, output, discipline, blockers and tomorrow's next move."
        glyph="goals"
      />

      <section className="section-stack goals-redesign-stack">
        <section className="goals-hero-console">
          <article className="glass panel goals-entry-panel">
            <div className="goals-panel-head">
              <div>
                <div className="eyebrow">Today</div>
                <div className="display goals-panel-title">Daily command log</div>
              </div>
              <div className="goals-date-chip">
                <CalendarDays size={14} />
                {todayLabel}
              </div>
            </div>

            <form action={saveDailyGoalAction} className="goals-entry-form">
              <input className="field goals-full" type="date" name="logDate" defaultValue={todayKey} required title="Log Date" />
              <input className="field goals-full" name="primaryFocus" placeholder="Primary focus" required />

              <div className="goals-metric-input-grid">
                <input className="field" type="number" step="0.25" name="totalHours" placeholder="Hours" required />
                <input className="field" type="number" min="0" max="100" name="completion" placeholder="Done %" required />
                <input className="field" type="number" min="0" max="100" name="disciplineScore" placeholder="Discipline" required />
                <input className="field" type="number" min="0" name="questionsSolved" placeholder="Questions" required />
                <input className="field" type="number" min="0" name="topicsStudied" placeholder="Topics" required />
              </div>

              <textarea className="textarea goals-full" name="wins" placeholder="Wins from the day" />
              <textarea className="textarea goals-full" name="blockers" placeholder="Blockers or drift" />
              <textarea className="textarea goals-full" name="tomorrowPlan" placeholder="Tomorrow's first clear action" />

              <button className="button goals-save-button" type="submit">
                <Save size={16} />
                Save execution log
              </button>
            </form>
          </article>

          <div className="goals-signal-column">
            <article className="glass panel goals-snapshot-panel">
              <div className="goals-panel-head">
                <div>
                  <div className="eyebrow">7-day signal</div>
                  <div className="display goals-panel-title">Current rhythm</div>
                </div>
                <div className="pill">
                  <Flame size={14} />
                  Live
                </div>
              </div>

              <div className="goals-snapshot-grid">
                {[
                  { label: "Hours", value: `${sevenDayHours.toFixed(1)}h`, tone: "var(--physics)" },
                  { label: "Questions", value: sevenDayQuestions, tone: "var(--botany)" },
                  { label: "Discipline", value: `${avgDiscipline}/100`, tone: "var(--gold)" },
                  { label: "Completion", value: `${avgCompletion}%`, tone: "var(--rose-bright)" },
                ].map((item) => (
                  <div key={item.label} className="goals-snapshot-card">
                    <span>{item.label}</span>
                    <strong style={{ color: item.tone }}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <ActivityHeatmap data={heatmapData} startDate={HEATMAP_START_KEY} />
          </div>
        </section>

        <section className="goals-analysis-grid">
          <article className="glass panel goals-chart-panel">
            <div className="goals-panel-head">
              <div>
                <div className="eyebrow">Output trend</div>
                <div className="display goals-panel-title">Execution XY signal</div>
              </div>
              <div className="pill">IST synced</div>
            </div>
            <div className="goals-chart-wrap">
              <DailyGoalsSignalChart data={trendData} />
            </div>
          </article>

          <article className="glass panel goals-reflection-panel">
            <div className="goals-panel-head">
              <div>
                <div className="eyebrow">Latest reflection</div>
                <div className="display goals-panel-title">{latestLog ? formatIstFullDate(latestLog.logDate) : "No log yet"}</div>
              </div>
              <div className="pill">
                <Target size={14} />
                Review
              </div>
            </div>

            {latestLog ? (
              <div className="goals-reflection-stack">
                <div>
                  <span>Focus</span>
                  <strong>{latestLog.primaryFocus}</strong>
                </div>
                <div>
                  <span>Wins</span>
                  <p>{latestLog.wins || "No wins written."}</p>
                </div>
                <div>
                  <span>Blockers</span>
                  <p>{latestLog.blockers || "No blockers written."}</p>
                </div>
                <div>
                  <span>Tomorrow</span>
                  <p>{latestLog.tomorrowPlan || "No plan written."}</p>
                </div>
              </div>
            ) : (
              <div className="muted">Save your first daily log to create a reflection trail.</div>
            )}
          </article>
        </section>

        <article className="glass panel goals-history-panel">
          <div className="goals-panel-head">
            <div>
              <div className="eyebrow">History</div>
              <div className="display goals-panel-title">Recent execution ledger</div>
            </div>
            <div className="pill">{tableLogs.length} entries</div>
          </div>

          <div className="table-wrap goals-history-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Focus</th>
                  <th>Hours</th>
                  <th>Questions</th>
                  <th>Topics</th>
                  <th>Done</th>
                  <th>Discipline</th>
                  <th style={{ width: 60 }}>Del</th>
                </tr>
              </thead>
              <tbody>
                {tableLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatIstFullDate(log.logDate)}</td>
                    <td>{log.primaryFocus}</td>
                    <td>{log.totalHours.toFixed(1)}h</td>
                    <td>{log.questionsSolved}</td>
                    <td>{log.topicsStudied}</td>
                    <td>{log.completion}%</td>
                    <td>{log.disciplineScore}/100</td>
                    <td>
                      <form action={deleteDailyGoalAction}>
                        <input type="hidden" name="id" value={log.id} />
                        <button type="submit" className="icon-action-button" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {tableLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">No daily logs yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
