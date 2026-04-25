import { format } from "date-fns";
import Link from "next/link";
import { ArrowRight, Award, BrainCircuit, Clock3, FileCheck2, Gauge } from "lucide-react";

import { TestPerformanceChart } from "@/components/charts/analytics-charts";
import { PageIntro } from "@/components/ui/sections";
import { TestsClient } from "@/components/ui/tests-client";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

function percent(score: number, total: number) {
  return Number(((score / Math.max(total, 1)) * 100).toFixed(1));
}

function accuracy(correct: number | null, attempted: number | null) {
  if (!correct || !attempted) return 0;
  return Number(((correct / Math.max(attempted, 1)) * 100).toFixed(1));
}

export default async function TestsPage() {
  await requireSession();

  const [tests, subjects] = await Promise.all([
    db.testRecord.findMany({
      orderBy: { testDate: "asc" },
      include: { studyNode: true },
    }),
    db.studyNode.findMany({
      where: { type: "SUBJECT" },
      orderBy: { title: "asc" },
    }),
  ]);

  const chartData = tests.map((test) => ({
    label: format(test.testDate, "dd MMM"),
    title: test.title,
    scorePct: percent(test.score, test.totalMarks),
    accuracy: accuracy(test.correctQuestions, test.attemptedQuestions),
    percentile: Number(test.percentile ?? 0),
    score: test.score,
    totalMarks: test.totalMarks,
    attempted: test.attemptedQuestions ?? 0,
    correct: test.correctQuestions ?? 0,
    timeMinutes: test.timeMinutes ?? 0,
  }));

  const latestTest = tests.at(-1);
  const bestTest = tests.reduce<typeof tests[number] | null>((best, test) => {
    if (!best) return test;
    return percent(test.score, test.totalMarks) > percent(best.score, best.totalMarks) ? test : best;
  }, null);
  const averageScore = tests.length
    ? Number((tests.reduce((sum, test) => sum + percent(test.score, test.totalMarks), 0) / tests.length).toFixed(1))
    : 0;
  const averageAccuracy = tests.length
    ? Math.round(tests.reduce((sum, test) => sum + accuracy(test.correctQuestions, test.attemptedQuestions), 0) / tests.length)
    : 0;
  const totalMinutes = tests.reduce((sum, test) => sum + (test.timeMinutes ?? 0), 0);
  const latestPct = latestTest ? percent(latestTest.score, latestTest.totalMarks) : 0;
  const bestPct = bestTest ? percent(bestTest.score, bestTest.totalMarks) : 0;

  return (
    <main className="page-shell tests-page">
      <PageIntro
        eyebrow="Test Tracker"
        title="Mock evidence, cleaned up."
        description="Scores, accuracy, time and subject patterns in one sharp testing cockpit."
        glyph="tests"
      />

      <section className="section-stack tests-redesign-stack">
        <section className="tests-metric-grid">
          {[
            { label: "Tests", value: tests.length, hint: "records", icon: FileCheck2, tone: "var(--physics)" },
            { label: "Average", value: `${averageScore}%`, hint: "score", icon: Gauge, tone: "var(--gold)" },
            { label: "Accuracy", value: `${averageAccuracy}%`, hint: "attempt quality", icon: Award, tone: "var(--botany)" },
            { label: "Time", value: `${Math.round(totalMinutes / 60)}h`, hint: "mock hours", icon: Clock3, tone: "var(--lotus-bright)" },
          ].map((metric) => (
            <article key={metric.label} className="glass panel tests-metric-card">
              <div className="tests-metric-icon" style={{ color: metric.tone }}>
                <metric.icon size={17} />
              </div>
              <span>{metric.label}</span>
              <strong style={{ color: metric.tone }}>{metric.value}</strong>
              <em>{metric.hint}</em>
            </article>
          ))}
        </section>

        <section className="tests-top-grid">
          <article className="glass panel tests-chart-panel">
            <div className="tests-panel-head">
              <div>
                <div className="eyebrow">Performance curve</div>
                <div className="display tests-panel-title">Score, accuracy, percentile</div>
              </div>
              <div className="pill">{chartData.length} points</div>
            </div>
            <TestPerformanceChart data={chartData} />
          </article>

          <article className="glass panel tests-diagnostic-panel">
            <div className="tests-panel-head">
              <div>
                <div className="eyebrow">Latest test</div>
                <div className="display tests-panel-title">{latestTest?.title ?? "No test yet"}</div>
              </div>
              <div className="pill">{latestPct}%</div>
            </div>
            <div className="tests-diagnostic-score">
              <div>
                <span>Latest score</span>
                <strong>{latestTest ? `${latestTest.score}/${latestTest.totalMarks}` : "0/0"}</strong>
              </div>
              <div>
                <span>Best score</span>
                <strong>{bestTest ? `${bestPct}%` : "0%"}</strong>
              </div>
            </div>
            <div className="tests-diagnostic-list">
              {latestTest ? (
                [
                  ["Stage", latestTest.examStage],
                  ["Type", latestTest.testType.replaceAll("_", " ")],
                  ["Subject", latestTest.studyNode?.title ?? "General"],
                  ["Accuracy", `${accuracy(latestTest.correctQuestions, latestTest.attemptedQuestions)}%`],
                  ["Time", `${latestTest.timeMinutes ?? 0} min`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))
              ) : (
                <div className="muted">Add your first test to build the diagnostic panel.</div>
              )}
            </div>
          </article>
        </section>

        <TestsClient
          tests={tests.map((test) => ({
            ...test,
            studyNode: test.studyNode ? { id: test.studyNode.id, title: test.studyNode.title } : null,
          }))}
          subjects={subjects.map((subject) => ({ id: subject.id, title: subject.title }))}
        />

        <Link href="/tests/error-analysis" className="glass panel tests-error-entry-card">
          <div>
            <div className="pill"><BrainCircuit size={13} />Method and Error Analysis</div>
            <div className="display tests-error-entry-title">Open question-wise error lab.</div>
            <p className="muted tests-error-entry-copy">
              Create a test, set its question count, log every question, and generate AI reports for repeated mistakes, recovery signals and next-test correction.
            </p>
          </div>
          <div className="tests-error-entry-action">
            Start logging <ArrowRight size={16} />
          </div>
        </Link>
      </section>
    </main>
  );
}
