import { format } from "date-fns";
import { Activity, BrainCircuit, ChartColumnBig, Orbit } from "lucide-react";

import { AreaTrendChart, TrendChart } from "@/components/charts/analytics-charts";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary, getPerformanceSummary } from "@/lib/dashboard";

export default async function DeepAnalyticsPage() {
  await requireSession();

  const [summary, performance] = await Promise.all([
    getDashboardSummary(),
    getPerformanceSummary(),
  ]);

  const scoreCurve = performance.tests.map((test) => ({
    label: format(test.testDate, "dd MMM"),
    value: Number(((test.score / Math.max(test.totalMarks, 1)) * 100).toFixed(1)),
  }));

  const disciplineCurve = performance.dailyLogs.map((day) => ({
    label: format(day.logDate, "dd MMM"),
    value: day.disciplineScore,
    secondary: day.completion,
  }));

  const moodCurve = performance.moods.map((mood) => ({
    label: format(mood.moodDate, "dd MMM"),
    value: mood.focus,
    secondary: mood.stress,
  }));

  const subjectHours = Object.values(
    performance.studyLogs.reduce<Record<string, { label: string; value: number }>>((acc, log) => {
      const key = log.studyNode?.title ?? "General";
      acc[key] = {
        label: key,
        value: Number(((acc[key]?.value ?? 0) + log.hours).toFixed(1)),
      };
      return acc;
    }, {}),
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <main className="page-shell">
      <section className="glass panel">
        <div className="eyebrow">Deep Analytics</div>
        <h1 className="display" style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", margin: "14px 0 10px" }}>
          Read the pattern, not just the number.
        </h1>
        <p className="muted" style={{ maxWidth: 860, lineHeight: 1.8 }}>
          This page is meant to feel like a real analytics desk. It combines score movement,
          discipline, completion, study hour distribution and mood pressure so you can judge
          whether the preparation system is actually compounding.
        </p>
      </section>

      <section className="section-stack">
        <div className="grid grid-4">
          {summary.metrics.map((metric) => (
            <article key={metric.label} className="glass panel metric-card">
              <div className="muted">{metric.label}</div>
              <div className="display metric-value">{metric.value}</div>
              <div className="muted">{metric.hint}</div>
            </article>
          ))}
        </div>

        <div className="command-grid">
          <article className="glass panel span-8">
            <div className="panel-title-row">
              <div>
                <div className="eyebrow">Score curve</div>
                <div className="display" style={{ fontSize: "2rem", marginTop: 8 }}>Tests over time</div>
              </div>
              <div className="pill">
                <ChartColumnBig size={14} />
                Performance
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <AreaTrendChart data={scoreCurve} color="#5ea1ff" />
            </div>
          </article>

          <article className="glass panel span-4">
            <div className="eyebrow">Interpretation</div>
            <div className="metric-stack" style={{ marginTop: 16 }}>
              <div className="glass" style={{ borderRadius: 20, padding: 16 }}>
                <div className="pill"><Activity size={14} /> Discipline</div>
                <div className="muted" style={{ marginTop: 12, lineHeight: 1.7 }}>
                  The dashboard keeps daily discipline and completion together because good hours without completion can become self-deception.
                </div>
              </div>
              <div className="glass" style={{ borderRadius: 20, padding: 16 }}>
                <div className="pill"><Orbit size={14} /> Mood pressure</div>
                <div className="muted" style={{ marginTop: 12, lineHeight: 1.7 }}>
                  Focus rising while stress rises too usually means you are forcing output instead of building a sustainable loop.
                </div>
              </div>
              <div className="glass" style={{ borderRadius: 20, padding: 16 }}>
                <div className="pill"><BrainCircuit size={14} /> AI usage</div>
                <div className="muted" style={{ marginTop: 12, lineHeight: 1.7 }}>
                  Ask UPSC Guru when any curve breaks sharply. That is where mentoring is more useful than generic advice.
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="grid grid-2">
          <article className="glass panel">
            <div className="eyebrow">Discipline vs completion</div>
            <div style={{ marginTop: 12 }}>
              <TrendChart data={disciplineCurve} secondaryKey="secondary" color="#65f0b5" secondaryColor="#ffcc75" />
            </div>
          </article>

          <article className="glass panel">
            <div className="eyebrow">Focus vs stress</div>
            <div style={{ marginTop: 12 }}>
              <TrendChart data={moodCurve} secondaryKey="secondary" color="#54d2ff" secondaryColor="#ff8aa1" />
            </div>
          </article>
        </div>

        <article className="glass panel">
          <div className="eyebrow">Study distribution</div>
          <div className="grid grid-4" style={{ marginTop: 16 }}>
            {subjectHours.length ? (
              subjectHours.map((subject) => (
                <div key={subject.label} className="glass" style={{ borderRadius: 22, padding: 16 }}>
                  <div className="muted">{subject.label}</div>
                  <div className="display" style={{ fontSize: "2rem", marginTop: 10 }}>
                    {subject.value}h
                  </div>
                </div>
              ))
            ) : (
              <div className="muted">No subject study hours have been logged yet.</div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
