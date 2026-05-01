import { format } from "date-fns";
import Link from "next/link";
import { ArrowRight, Award, BrainCircuit, Clock3, Crosshair, FileCheck2, Gauge, Target } from "lucide-react";

import { TestMetricTrendChart } from "@/components/charts/analytics-charts";
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

function precision(correct: number | null, incorrect: number | null, attempted: number | null) {
  const safeCorrect = correct ?? 0;
  const answered = safeCorrect + (incorrect ?? 0);
  if (answered > 0) return Number(((safeCorrect / answered) * 100).toFixed(1));
  return accuracy(correct, attempted);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

type TestForSummary = {
  title: string;
  testDate: Date;
  score: number;
  totalMarks: number;
  correctQuestions: number | null;
  incorrectQuestions: number | null;
  attemptedQuestions: number | null;
  timeMinutes: number | null;
};

function summarizeBy<T extends TestForSummary>(tests: T[], key: (test: T) => string) {
  const buckets = new Map<string, T[]>();

  for (const test of tests) {
    const label = key(test) || "General";
    buckets.set(label, [...(buckets.get(label) ?? []), test]);
  }

  return Array.from(buckets.entries())
    .map(([label, group]) => {
      const latest = group[group.length - 1];
      const scoreValues = group.map((test) => percent(test.score, test.totalMarks));
      const accuracyValues = group.map((test) => accuracy(test.correctQuestions, test.attemptedQuestions));
      const precisionValues = group.map((test) =>
        precision(test.correctQuestions, test.incorrectQuestions, test.attemptedQuestions),
      );

      return {
        label,
        count: group.length,
        avgScore: average(scoreValues),
        avgAccuracy: average(accuracyValues),
        avgPrecision: average(precisionValues),
        bestScore: Math.max(0, ...scoreValues),
        latestTitle: latest?.title ?? "No test",
        latestDate: latest ? format(latest.testDate, "dd MMM") : "NA",
      };
    })
    .sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)
    .slice(0, 5);
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
    precision: precision(test.correctQuestions, test.incorrectQuestions, test.attemptedQuestions),
    percentile: Number(test.percentile ?? 0),
    score: test.score,
    totalMarks: test.totalMarks,
    attempted: test.attemptedQuestions ?? 0,
    correct: test.correctQuestions ?? 0,
    incorrect: test.incorrectQuestions ?? 0,
    timeMinutes: test.timeMinutes ?? 0,
  }));

  const latestTest = tests.at(-1);
  const bestTest = tests.reduce<typeof tests[number] | null>((best, test) => {
    if (!best) return test;
    return percent(test.score, test.totalMarks) > percent(best.score, best.totalMarks) ? test : best;
  }, null);
  const averageScore = tests.length
    ? average(tests.map((test) => percent(test.score, test.totalMarks)))
    : 0;
  const averageAccuracy = tests.length
    ? average(tests.map((test) => accuracy(test.correctQuestions, test.attemptedQuestions)))
    : 0;
  const averagePrecision = tests.length
    ? average(tests.map((test) => precision(test.correctQuestions, test.incorrectQuestions, test.attemptedQuestions)))
    : 0;
  const averagePercentile = average(tests.map((test) => Number(test.percentile ?? 0)).filter(Boolean));
  const totalMinutes = tests.reduce((sum, test) => sum + (test.timeMinutes ?? 0), 0);
  const latestPct = latestTest ? percent(latestTest.score, latestTest.totalMarks) : 0;
  const bestPct = bestTest ? percent(bestTest.score, bestTest.totalMarks) : 0;
  const latestAccuracy = latestTest ? accuracy(latestTest.correctQuestions, latestTest.attemptedQuestions) : 0;
  const latestPrecision = latestTest
    ? precision(latestTest.correctQuestions, latestTest.incorrectQuestions, latestTest.attemptedQuestions)
    : 0;
  const sectionGroups = [
    { title: "Exam stage", label: "Prelims and mains", items: summarizeBy(tests, (test) => test.examStage) },
    { title: "Test type", label: "Mock format", items: summarizeBy(tests, (test) => test.testType.replaceAll("_", " ")) },
    { title: "Subject lane", label: "Syllabus pressure", items: summarizeBy(tests, (test) => test.studyNode?.title ?? "General") },
  ];
  const trendCards = [
    {
      label: "Score trajectory",
      value: `${averageScore}%`,
      meta: latestTest ? `Latest ${latestPct}%` : "No score yet",
      dataKey: "scorePct" as const,
      color: "var(--gold-bright)",
      icon: Gauge,
      suffix: "%",
    },
    {
      label: "Accuracy control",
      value: `${averageAccuracy}%`,
      meta: latestTest ? `Latest ${latestAccuracy}%` : "No attempts yet",
      dataKey: "accuracy" as const,
      color: "var(--botany)",
      icon: Target,
      suffix: "%",
    },
    {
      label: "Precision discipline",
      value: `${averagePrecision}%`,
      meta: latestTest ? `Latest ${latestPrecision}%` : "No precision yet",
      dataKey: "precision" as const,
      color: "var(--physics)",
      icon: Crosshair,
      suffix: "%",
    },
    {
      label: "Percentile rank",
      value: averagePercentile ? `${averagePercentile}` : "NA",
      meta: latestTest ? `Latest ${latestTest.percentile ?? 0}` : "No rank yet",
      dataKey: "percentile" as const,
      color: "var(--lotus-bright)",
      icon: Award,
      suffix: "",
    },
    {
      label: "Time pressure",
      value: `${Math.round(totalMinutes / 60)}h`,
      meta: latestTest ? `Latest ${latestTest.timeMinutes ?? 0} min` : "No time logged",
      dataKey: "timeMinutes" as const,
      color: "var(--rose-bright)",
      icon: Clock3,
      suffix: "",
    },
  ];

  return (
    <main className="page-shell tests-page">
      <PageIntro
        eyebrow="Test Tracker"
        title="Mock evidence, cleaned up."
        description="Scores, accuracy, time and subject patterns in one sharp testing cockpit."
        glyph="tests"
      />

      <section className="section-stack tests-redesign-stack">

        {/* ── KPI metric strip ── */}
        <section className="tests-metric-grid">
          {[
            { label: "Tests logged", value: tests.length, hint: "records", icon: FileCheck2, tone: "var(--physics)" },
            { label: "Average score", value: `${averageScore}%`, hint: "across all mocks", icon: Gauge, tone: "var(--gold)" },
            { label: "Avg accuracy", value: `${averageAccuracy}%`, hint: "attempt quality", icon: Award, tone: "var(--botany)" },
            { label: "Avg precision", value: `${averagePrecision}%`, hint: "clean hits only", icon: Crosshair, tone: "var(--lotus-bright)" },
          ].map((metric) => (
            <article key={metric.label} className="glass panel tests-metric-card" style={{ color: metric.tone }}>
              <div className="tests-metric-icon">
                <metric.icon size={18} />
              </div>
              <div>
                <span>{metric.label}</span>
                <strong style={{ color: metric.tone }}>{metric.value}</strong>
              </div>
              <em>{metric.hint}</em>
            </article>
          ))}
        </section>

        {/* ── Trend analysis cockpit ── */}
        <section className="tests-analysis-grid">
          {trendCards.map((card) => (
            <article key={card.label} className="glass panel tests-trend-panel" style={{ color: card.color }}>
              <div className="tests-panel-head">
                <div>
                  <div className="eyebrow">{card.label}</div>
                  <div className="display tests-panel-title">{card.value}</div>
                </div>
                <div className="tests-trend-icon">
                  <card.icon size={18} />
                </div>
              </div>
              <div className="tests-trend-meta">{card.meta}</div>
              <TestMetricTrendChart
                data={chartData}
                dataKey={card.dataKey}
                color={card.color}
                domain={card.dataKey === "timeMinutes" ? [0, "auto"] : [0, 100]}
                suffix={card.suffix}
              />
            </article>
          ))}
        </section>

        {/* ── Intelligence dock: diagnostic + section lanes ── */}
        <section className="tests-intelligence-grid">
          <article className="glass panel tests-diagnostic-panel">
            <div className="tests-panel-head">
              <div>
                <div className="eyebrow">Latest test</div>
                <div className="display tests-panel-title tests-latest-title">{latestTest?.title ?? "No test yet"}</div>
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
                  ["Precision", `${precision(latestTest.correctQuestions, latestTest.incorrectQuestions, latestTest.attemptedQuestions)}%`],
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

          <article className="glass panel tests-section-panel">
            <div className="tests-panel-head">
              <div>
                <div className="eyebrow">Section analysis</div>
                <div className="display tests-panel-title">Separate tracking lanes</div>
              </div>
              <div className="pill">{sectionGroups.reduce((sum, group) => sum + group.items.length, 0)} lanes</div>
            </div>
            <div className="tests-section-grid">
              {sectionGroups.map((group) => (
                <div key={group.title} className="tests-section-card">
                  <div className="tests-section-card-head">
                    <span>{group.label}</span>
                    <strong>{group.title}</strong>
                  </div>
                  <div className="tests-section-rows">
                    {group.items.length ? (
                      group.items.map((item) => (
                        <div key={item.label} className="tests-section-row">
                          <div>
                            <strong>{item.label}</strong>
                            <span>{item.count} tests · latest {item.latestDate}</span>
                          </div>
                          <div className="tests-section-score">
                            <span>{item.avgScore}% score</span>
                            <span>{item.avgAccuracy}% acc</span>
                            <span>{item.avgPrecision}% prec</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="muted tests-empty-state">No lanes recorded yet.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* ── Capture dock: form + ledger ── */}
        <TestsClient
          tests={tests.map((test) => ({
            ...test,
            studyNode: test.studyNode ? { id: test.studyNode.id, title: test.studyNode.title } : null,
          }))}
          subjects={subjects.map((subject) => ({ id: subject.id, title: subject.title }))}
        />

        {/* ── Error lab CTA banner ── */}
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
