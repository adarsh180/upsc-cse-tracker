import { format } from "date-fns";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { TestLab } from "@/components/dashboard/test-lab";
import { MetricLine } from "@/components/su/metric-line";
import { PageIntro } from "@/components/ui/sections";
import { TestsClient } from "@/components/ui/tests-client";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { toTestPoint } from "@/lib/insights";

export const metadata = { title: "Tests · Sacred Attempt" };

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
    examStage: test.examStage,
  }));

  const prelimsTests = tests.filter((test) => test.examStage === "PRELIMS");
  const mainsTests = tests.filter((test) => test.examStage === "MAINS");

  const latestTest = tests.at(-1);
  const bestTest = tests.reduce<typeof tests[number] | null>((best, test) => {
    if (!best) return test;
    return percent(test.score, test.totalMarks) > percent(best.score, best.totalMarks) ? test : best;
  }, null);
  const averageScore = tests.length
    ? average(tests.map((test) => percent(test.score, test.totalMarks)))
    : 0;
  const averagePrelimsScore = average(prelimsTests.map((test) => percent(test.score, test.totalMarks)));
  const averageMainsScore = average(mainsTests.map((test) => percent(test.score, test.totalMarks)));
  const averageAccuracy = prelimsTests.length
    ? average(prelimsTests.map((test) => accuracy(test.correctQuestions, test.attemptedQuestions)))
    : 0;
  const averagePrecision = prelimsTests.length
    ? average(prelimsTests.map((test) => precision(test.correctQuestions, test.incorrectQuestions, test.attemptedQuestions)))
    : 0;
  const averagePercentile = average(tests.map((test) => Number(test.percentile ?? 0)).filter(Boolean));
  const totalMinutes = tests.reduce((sum, test) => sum + (test.timeMinutes ?? 0), 0);
  const latestPct = latestTest ? percent(latestTest.score, latestTest.totalMarks) : 0;
  const bestPct = bestTest ? percent(bestTest.score, bestTest.totalMarks) : 0;
  const latestPrelims = prelimsTests.at(-1);
  const sectionGroups = [
    { title: "Exam stage", label: "Prelims and mains", items: summarizeBy(tests, (test) => test.examStage) },
    { title: "Test type", label: "Mock format", items: summarizeBy(tests, (test) => test.testType.replaceAll("_", " ")) },
    { title: "Subject lane", label: "Syllabus pressure", items: summarizeBy(tests, (test) => test.studyNode?.title ?? "General") },
  ];
  const cutoffs = tests.filter((t) => t.cutoffTarget && t.totalMarks).map((t) => (t.cutoffTarget! / t.totalMarks) * 100);
  const avgCutoff = cutoffs.length ? average(cutoffs) : null;
  const series = chartData.map((p) => ({
    x: p.label,
    sub: p.title,
    values: {
      scorePct: p.scorePct,
      accuracy: p.examStage === "PRELIMS" && p.attempted ? p.accuracy : null,
      precision: p.examStage === "PRELIMS" && p.attempted ? p.precision : null,
      percentile: p.percentile || null,
      timeMinutes: p.timeMinutes || null,
    },
  }));
  const figures = [
    { label: "Tests logged", value: String(tests.length), unit: "", note: `${prelimsTests.length} prelims · ${mainsTests.length} mains` },
    { label: "Prelims average", value: prelimsTests.length ? String(Math.round(averagePrelimsScore)) : "—", unit: prelimsTests.length ? "%" : "", note: latestTest ? `latest ${Math.round(latestPct)}%` : "no tests yet" },
    { label: "Accuracy", value: prelimsTests.length ? String(Math.round(averageAccuracy)) : "—", unit: prelimsTests.length ? "%" : "", note: "right of attempted" },
    { label: "Precision", value: prelimsTests.length ? String(Math.round(averagePrecision)) : "—", unit: prelimsTests.length ? "%" : "", note: "right of answered" },
    { label: "Percentile", value: averagePercentile ? String(Math.round(averagePercentile)) : "—", unit: "", note: "average rank" },
    { label: "Best", value: bestTest ? String(Math.round(bestPct)) : "—", unit: bestTest ? "%" : "", note: bestTest?.title.slice(0, 26) ?? "—" },
  ];

  return (
    <main className="page-shell editorial-page editorial-tests tests-page su-page su-legacy pg-tests">
      <PageIntro
        eyebrow="Test Tracker"
        title="Test tracker"
        description="Every mock you log — score against cut-off, accuracy, time and subject patterns — feeds your selection odds."
        actions={
          <>
            <a href="#log" className="su-btn su-btn-ink">Log a test</a>
            <Link href="/tests/error-analysis" className="su-btn">Error lab <ArrowUpRight size={14} /></Link>
          </>
        }
      />

      <div className="su-figs ts-figs">
        {figures.map((f) => (
          <div className="su-fig" key={f.label}>
            <span className="su-fig-label">{f.label}</span>
            <span className="su-fig-value">{f.value}<small>{f.unit}</small></span>
            <span className="su-fig-note">{f.note}</span>
          </div>
        ))}
      </div>

      <section className="su-sect" id="trends">
        <div className="su-sect-head">
          <span className="su-idx">01</span>
          <h2>Trend</h2>
          <p>One instrument for every signal. Switch the metric, scrub across to read any test.</p>
        </div>
        <MetricLine
          series={series}
          emptyText="Log your first test to start the curve."
          metrics={[
            { key: "scorePct", label: "Score", suffix: "%", max: 100, target: avgCutoff ? { value: avgCutoff, label: `avg cut-off ${Math.round(avgCutoff)}%` } : undefined },
            { key: "accuracy", label: "Accuracy", suffix: "%", max: 100, tone: "good" },
            { key: "precision", label: "Precision", suffix: "%", max: 100, tone: "good" },
            { key: "percentile", label: "Percentile", max: 100, tone: "warn", decimals: 0 },
            { key: "timeMinutes", label: "Time", suffix: "m", tone: "ink", decimals: 0 },
          ]}
        />
      </section>

      <section className="su-sect" id="every-test">
        <div className="su-sect-head">
          <span className="su-idx">02</span>
          <h2>Every test, against its cut-off</h2>
          <p>The notch is the cut-off, the ring is you. Green stretch: cleared by. Red: short by. Hover for the breakdown.</p>
        </div>
        <TestLab tests={tests.map(toTestPoint)} />
      </section>

      <section className="su-sect" id="lanes">
        <div className="su-sect-head">
          <span className="su-idx">03</span>
          <h2>Lanes</h2>
          <p>Averages split by stage, format and subject — where you are strong, and where a lane is thin.</p>
        </div>
        <div className="ts-lanes">
          {sectionGroups.map((group) => (
            <div key={group.title} className="ts-lane">
              <div className="ts-lane-head">
                <span className="su-fig-label">{group.label}</span>
                <strong>{group.title}</strong>
              </div>
              {group.items.length ? (
                <table className="ts-table">
                  <thead>
                    <tr><th>Lane</th><th>Tests</th><th>Score</th><th>Acc.</th></tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.label}>
                        <td>
                          <b>{item.label.toLowerCase()}</b>
                          <small>latest {item.latestDate}</small>
                        </td>
                        <td>{item.count}</td>
                        <td>
                          <span className="ts-bar" style={{ "--p": item.avgScore / 100 } as React.CSSProperties}><i /></span>
                          {Math.round(item.avgScore)}%
                        </td>
                        <td>{Math.round(item.avgAccuracy)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="su-muted">No lanes recorded yet.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="su-sect" id="log">
        <div className="su-sect-head">
          <span className="su-idx">04</span>
          <h2>Log a test · ledger</h2>
          <p>Capture a mock on the left; every record sits in the ledger on the right, editable.</p>
        </div>
        <TestsClient
          tests={tests.map((test) => ({
            ...test,
            studyNode: test.studyNode ? { id: test.studyNode.id, title: test.studyNode.title } : null,
          }))}
          subjects={subjects.map((subject) => ({ id: subject.id, title: subject.title }))}
        />
      </section>

      <Link href="/tests/error-analysis" className="ts-errorlab">
        <span className="su-fig-label">Method &amp; error analysis</span>
        <strong>Open the question-wise error lab</strong>
        <span className="su-muted">Log every question of a test, then let the AI find the mistakes you keep repeating.</span>
        <ArrowUpRight size={28} aria-hidden="true" />
      </Link>
    </main>
  );
}
