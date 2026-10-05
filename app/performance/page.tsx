import type { CSSProperties } from "react";
import { format } from "date-fns";

import { MetricLine } from "@/components/su/metric-line";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getPerformanceSummary } from "@/lib/dashboard";

export const metadata = { title: "Performance · Sacred Attempt" };

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export default async function PerformancePage() {
  await requireSession();

  const summary = await getPerformanceSummary();

  const testSeries = summary.tests.map((test) => ({
    x: format(test.testDate, "dd MMM"),
    values: { score: Number(((test.score / Math.max(test.totalMarks, 1)) * 100).toFixed(1)) },
  }));

  const daySeries = summary.dailyLogs.map((day) => ({
    x: format(day.logDate, "dd MMM"),
    values: {
      hours: day.totalHours,
      discipline: day.disciplineScore || null,
      completion: day.completion || null,
    },
  }));

  const moodSeries = summary.moods.map((entry) => ({
    x: format(entry.moodDate, "dd MMM"),
    values: { focus: entry.focus, stress: entry.stress },
  }));

  const subjectMap = new Map<string, { hours: number; sessions: number }>();
  for (const log of summary.studyLogs) {
    const subject = log.studyNode?.title ?? "Unassigned";
    const current = subjectMap.get(subject) ?? { hours: 0, sessions: 0 };
    current.hours += log.hours;
    current.sessions += 1;
    subjectMap.set(subject, current);
  }
  const subjects = Array.from(subjectMap.entries())
    .map(([subject, value]) => ({ subject, hours: value.hours, sessions: value.sessions }))
    .sort((a, b) => b.hours - a.hours);
  const topHours = subjects[0]?.hours ?? 1;

  const scores = testSeries.map((p) => p.values.score);
  const disciplineLogged = summary.dailyLogs.filter((d) => d.disciplineScore > 0).map((d) => d.disciplineScore);
  const hoursAll = summary.dailyLogs.map((d) => d.totalHours);
  const figures = [
    { label: "Average score", value: scores.length ? avg(scores).toFixed(0) : "—", unit: scores.length ? "%" : "", note: `${scores.length} tests` },
    { label: "Best score", value: scores.length ? Math.max(...scores).toFixed(0) : "—", unit: scores.length ? "%" : "", note: "peak performance" },
    { label: "Discipline", value: disciplineLogged.length ? avg(disciplineLogged).toFixed(0) : "—", unit: "/100", note: `${disciplineLogged.length} scored days` },
    { label: "Hours logged", value: Math.round(hoursAll.reduce((s, h) => s + h, 0)).toLocaleString("en-IN"), unit: "h", note: `${hoursAll.length} days · ${avg(hoursAll).toFixed(1)}h avg` },
    { label: "Focus", value: summary.moods.length ? avg(summary.moods.map((m) => m.focus)).toFixed(1) : "—", unit: "/10", note: `${summary.moods.length} check-ins` },
  ];

  return (
    <main className="page-shell editorial-page editorial-analytics su-page su-legacy pg-performance">
      <PageIntro
        eyebrow="Performance"
        title="The shape of it"
        description="Score, discipline, completion, study volume, subject focus and mood — one signal at a time, each drawn from your logs."
      />

      <div className="su-figs">
        {figures.map((f) => (
          <div className="su-fig" key={f.label}>
            <span className="su-fig-label">{f.label}</span>
            <span className="su-fig-value">{f.value}<small>{f.unit}</small></span>
            <span className="su-fig-note">{f.note}</span>
          </div>
        ))}
      </div>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">01</span>
          <h2>Daily execution</h2>
          <p>Every logged day. Switch between hours, discipline and completion; scrub to read a day.</p>
        </div>
        <MetricLine
          series={daySeries}
          emptyText="Log a day on the Goals page to start this curve."
          metrics={[
            { key: "hours", label: "Hours", suffix: "h", target: { value: 8, label: "8h target" } },
            { key: "discipline", label: "Discipline", max: 100, tone: "good", decimals: 0 },
            { key: "completion", label: "Completion", suffix: "%", max: 100, tone: "warn", decimals: 0 },
          ]}
        />
      </section>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">02</span>
          <h2>Scores</h2>
          <p>Score as a share of maximum marks, test by test.</p>
        </div>
        <MetricLine series={testSeries} emptyText="No tests yet." metrics={[{ key: "score", label: "Score", suffix: "%", max: 100 }]} height={260} />
      </section>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">03</span>
          <h2>Where the hours went</h2>
          <p>Study sessions by subject. Longer bar, more hours.</p>
        </div>
        {subjects.length ? (
          <div className="pf-subjects">
            {subjects.map((s, i) => (
              <div className="pf-row su-reveal" key={s.subject} style={{ "--p": s.hours / topHours, "--i": i } as CSSProperties}>
                <span className="pf-name">{s.subject}</span>
                <span className="pf-bar" aria-hidden="true"><i /></span>
                <span className="pf-num"><b>{s.hours.toFixed(1)}</b>h <small>· {s.sessions} sessions</small></span>
              </div>
            ))}
          </div>
        ) : (
          <div className="su-empty"><strong>No study sessions yet</strong>Record sessions on a subject page.</div>
        )}
      </section>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">04</span>
          <h2>Mind</h2>
          <p>Focus and stress from your mood check-ins.</p>
        </div>
        <MetricLine
          series={moodSeries}
          emptyText="Check in on the Mood page to see this."
          height={240}
          metrics={[
            { key: "focus", label: "Focus", max: 10, tone: "good", decimals: 0 },
            { key: "stress", label: "Stress", max: 10, tone: "bad", decimals: 0 },
          ]}
        />
      </section>
    </main>
  );
}
