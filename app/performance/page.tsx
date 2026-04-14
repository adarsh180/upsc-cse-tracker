import { format } from "date-fns";

import { AreaTrendChart, TrendChart } from "@/components/charts/analytics-charts";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getPerformanceSummary } from "@/lib/dashboard";

export default async function PerformancePage() {
  await requireSession();

  const summary = await getPerformanceSummary();

  const testChart = summary.tests.map((test) => ({
    label: format(test.testDate, "dd MMM"),
    value: Number(((test.score / Math.max(test.totalMarks, 1)) * 100).toFixed(1)),
  }));

  const disciplineChart = summary.dailyLogs.map((day) => ({
    label: format(day.logDate, "dd MMM"),
    value: day.disciplineScore,
    secondary: day.completion,
  }));

  const studyHoursChart = summary.studyLogs.map((log) => ({
    label: format(log.logDate, "dd MMM"),
    value: log.hours,
  }));

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Performance Analytics"
        title="See the shape of your preparation."
        description="This view combines test results, daily discipline, completion and study volume so you can measure whether effort is compounding or just feeling busy."
      />

      <section className="section-stack">
        <div className="grid grid-2">
          <article className="glass panel">
            <div className="eyebrow">Test performance</div>
            <div style={{ marginTop: 12 }}>
              <AreaTrendChart data={testChart} color="#5ea1ff" />
            </div>
          </article>

          <article className="glass panel">
            <div className="eyebrow">Discipline vs completion</div>
            <div style={{ marginTop: 12 }}>
              <TrendChart data={disciplineChart} secondaryKey="secondary" color="#65f0b5" secondaryColor="#ffcc75" />
            </div>
          </article>
        </div>

        <article className="glass panel">
          <div className="eyebrow">Study hour trend</div>
          <div style={{ marginTop: 12 }}>
            <AreaTrendChart data={studyHoursChart} color="#c898ff" />
          </div>
        </article>
      </section>
    </main>
  );
}
