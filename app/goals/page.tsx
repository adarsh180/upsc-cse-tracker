import { format } from "date-fns";
import { Trash2 } from "lucide-react";

import { saveDailyGoalAction, deleteDailyGoalAction } from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageIntro } from "@/components/ui/sections";
import { ActivityHeatmap } from "@/components/ui/heatmap";
import { TrendChart } from "@/components/charts/analytics-charts";

export default async function GoalsPage() {
  await requireSession();

  const date550DaysAgo = new Date();
  date550DaysAgo.setDate(date550DaysAgo.getDate() - 550);

  const logs = await db.dailyLog.findMany({
    where: {
      logDate: { gte: date550DaysAgo },
    },
    orderBy: { logDate: "desc" },
  });

  const tableLogs = logs.slice(0, 30);
  const heatmapData = logs.map((l) => ({
    date: format(l.logDate, "yyyy-MM-dd"),
    hours: l.totalHours,
    completion: l.completion,
  }));

  const trendData = [...tableLogs].reverse().map((l) => ({
    label: format(l.logDate, "dd MMM"),
    value: l.totalHours,
    questions: l.questionsSolved,
    topics: l.topicsStudied,
  }));

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Daily Goals"
        title="Measure execution, not intention."
        description="Log your primary focus, actual study hours, completion, discipline and reflection so your preparation history stays honest and measurable."
      />

      <section className="section-stack">
        <ActivityHeatmap data={heatmapData} />
        
        <article className="glass panel">
          <div className="eyebrow">Log today</div>
          <form action={saveDailyGoalAction} style={{ marginTop: 16 }}>
            <div className="grid grid-2" style={{ gap: 16, alignItems: "stretch" }}>
              {/* Column 1: Core Metrics */}
              <div className="grid" style={{ gap: 12, alignContent: "start" }}>
                <input className="field" type="date" name="logDate" defaultValue={format(new Date(), "yyyy-MM-dd")} required title="Log Date" />
                <input className="field" name="primaryFocus" placeholder="Primary focus of the day" required />
                <div className="grid grid-3" style={{ gap: 10 }}>
                  <input className="field" type="number" step="0.25" name="totalHours" placeholder="Hours" required />
                  <input className="field" type="number" min="0" max="100" name="completion" placeholder="Done %" required />
                  <input className="field" type="number" min="0" max="100" name="disciplineScore" placeholder="Discipline" required />
                </div>
                <div className="grid grid-2" style={{ gap: 10 }}>
                  <input className="field" type="number" min="0" name="questionsSolved" placeholder="Questions solved" required />
                  <input className="field" type="number" min="0" name="topicsStudied" placeholder="Topics studied" required />
                </div>
                <textarea className="textarea" name="tomorrowPlan" placeholder="Tomorrow plan" style={{ minHeight: 100 }} />
              </div>
              
              {/* Column 2: Reflections */}
              <div className="grid" style={{ gap: 12, display: "flex", flexDirection: "column" }}>
                <textarea className="textarea" name="wins" placeholder="What went well? (Wins)" style={{ minHeight: 100 }} />
                <textarea className="textarea" name="blockers" placeholder="What blocked you? (Blockers)" style={{ minHeight: 100 }} />
                <button className="button" type="submit" style={{ padding: "14px", marginTop: "auto" }}>
                  Save daily goal log
                </button>
              </div>
            </div>
          </form>
        </article>

        <article className="glass panel">
          <div className="eyebrow" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            Execution Output Trend
            <div style={{ display: "flex", gap: 12, fontSize: "0.8rem", fontWeight: 600 }}>
              <span style={{ color: "var(--botany)", display: "flex", alignItems: "center", gap: 6 }}><span style={{width: 8, height: 8, borderRadius: 4, background: "currentColor"}}/>Questions Solved</span>
              <span style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}><span style={{width: 8, height: 8, borderRadius: 4, background: "currentColor"}}/>Topics Studied</span>
              <span style={{ color: "#54d2ff", display: "flex", alignItems: "center", gap: 6 }}><span style={{width: 8, height: 8, borderRadius: 4, background: "currentColor"}}/>Focused Hours</span>
            </div>
          </div>
          <div style={{ marginTop: 24, padding: "0 10px" }}>
            <TrendChart
              data={trendData}
              color="#54d2ff"
              secondaryKey="questions"
              secondaryColor="var(--botany)"
              tertiaryKey="topics"
              tertiaryColor="var(--gold)"
            />
          </div>
        </article>

        <article className="glass panel">
          <div className="eyebrow">Goal log history</div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
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
                    <td style={{ whiteSpace: "nowrap" }}>{format(log.logDate, "dd MMM yyyy")}</td>
                    <td>{log.primaryFocus}</td>
                    <td>{log.totalHours.toFixed(1)}h</td>
                    <td>{log.questionsSolved}</td>
                    <td>{log.topicsStudied}</td>
                    <td>{log.completion}%</td>
                    <td>{log.disciplineScore}/100</td>
                    <td>
                      <form action={deleteDailyGoalAction}>
                        <input type="hidden" name="id" value={log.id} />
                        <button
                          type="submit"
                          style={{
                            background: "rgba(255,80,80,0.1)",
                            border: "1px solid rgba(255,80,80,0.22)",
                            borderRadius: 8,
                            padding: "5px 8px",
                            color: "var(--danger)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {tableLogs.length === 0 && (
                  <tr>
                     <td colSpan={8} className="muted">No daily logs yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
