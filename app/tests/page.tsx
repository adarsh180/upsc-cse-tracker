import { AreaTrendChart } from "@/components/charts/analytics-charts";
import { PageIntro } from "@/components/ui/sections";
import { TestsClient } from "@/components/ui/tests-client";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";

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
    value: Number(((test.score / Math.max(test.totalMarks, 1)) * 100).toFixed(1)),
  }));

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Test Tracker"
        title="Capture every serious test."
        description="Record prelims, mains, sectional, unit, subject-wise, full-length and all-India tests with marks, accuracy, percentile and time so your progress curve stays honest."
      />

      <section className="section-stack">
        {/* Score trajectory chart */}
        <article className="glass panel">
          <div className="eyebrow">Score trajectory</div>
          <div style={{ marginTop: 12 }}>
            <AreaTrendChart data={chartData} color="#ffcc75" />
          </div>
        </article>

        {/* Full CRUD table */}
        <TestsClient
          tests={tests.map((t) => ({
            ...t,
            studyNode: t.studyNode ? { id: t.studyNode.id, title: t.studyNode.title } : null,
          }))}
          subjects={subjects.map((s) => ({ id: s.id, title: s.title }))}
        />
      </section>
    </main>
  );
}
