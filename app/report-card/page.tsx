import { format, subDays } from "date-fns";

import { ReportCardClient } from "@/components/ai/report-card-client";
import type { CaTrendPoint, WeeklyTrendPoint } from "@/components/charts/progress-trends";
import { MetricLine } from "@/components/su/metric-line";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeReviewForClient } from "@/lib/report-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report card · Sacred Attempt" };

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default async function ReportCardPage() {
  await requireSession();

  const [weekly, monthly, caAttempts] = await Promise.all([
    db.weeklyReview.findMany({ orderBy: { weekStart: "desc" }, take: 12 }),
    db.monthlyReview.findMany({ orderBy: { monthStart: "desc" }, take: 6 }),
    db.caQuizAttempt.findMany({
      where: { digestDate: { gte: subDays(new Date(), 30) } },
      select: { digestDate: true, isCorrect: true },
      orderBy: { digestDate: "asc" },
    }),
  ]);

  const weeklyTrend: WeeklyTrendPoint[] = [...weekly]
    .reverse()
    .map((review) => {
      const stats = safeJson<{ totalHours?: number; avgDiscipline?: number | null }>(review.statsJson, {});
      const integrity = safeJson<{ score?: number }>(review.integrityJson, {});
      const quiz = safeJson<{ summary?: { answered?: number; correct?: number; partial?: number } }>(review.quizJson, {});
      const answered = quiz.summary?.answered ?? 0;
      return {
        label: format(review.weekStart, "d MMM"),
        hours: stats.totalHours ?? 0,
        integrity: integrity.score ?? null,
        vivaAccuracy: answered > 0 ? Math.round(((quiz.summary?.correct ?? 0) / answered) * 100) : null,
        discipline: stats.avgDiscipline ?? null,
      };
    });

  const caByDay = new Map<string, { attempted: number; correct: number }>();
  for (const attempt of caAttempts) {
    const key = format(attempt.digestDate, "d MMM");
    const bucket = caByDay.get(key) ?? { attempted: 0, correct: 0 };
    bucket.attempted += 1;
    if (attempt.isCorrect) bucket.correct += 1;
    caByDay.set(key, bucket);
  }
  const caTrend: CaTrendPoint[] = [...caByDay.entries()].map(([label, bucket]) => ({
    label,
    attempted: bucket.attempted,
    accuracyPct: Math.round((bucket.correct / bucket.attempted) * 100),
  }));

  const now = new Date();
  await Promise.all([
    weekly[0] && !weekly[0].seenAt
      ? db.weeklyReview.update({ where: { id: weekly[0].id }, data: { seenAt: now } }).catch(() => {})
      : null,
    monthly[0] && !monthly[0].seenAt
      ? db.monthlyReview.update({ where: { id: monthly[0].id }, data: { seenAt: now } }).catch(() => {})
      : null,
  ]);

  return (
    <main className="page-shell editorial-page editorial-report-card su-page su-legacy pg-report">
      <PageIntro
        eyebrow="Report Card"
        title="The verdict"
        description="Weekly and monthly report cards: the numbers, the honest read on how you logged them, and a UPSC-style viva drawn only from what you claimed to study."
        glyph="essay"
      />
      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">01</span>
          <h2>Week over week</h2>
          <p>Hours, honesty and viva accuracy from each weekly card. Integrity is how consistent your logs are with the work they claim.</p>
        </div>
        <MetricLine
          series={weeklyTrend.map((w) => ({
            x: w.label,
            values: { hours: w.hours, integrity: w.integrity, viva: w.vivaAccuracy, discipline: w.discipline },
          }))}
          emptyText="Your first weekly card appears after Sunday."
          metrics={[
            { key: "hours", label: "Hours", suffix: "h", decimals: 1 },
            { key: "integrity", label: "Integrity", max: 100, tone: "good", decimals: 0 },
            { key: "viva", label: "Viva accuracy", suffix: "%", max: 100, tone: "warn", decimals: 0 },
            { key: "discipline", label: "Discipline", max: 100, tone: "ink", decimals: 0 },
          ]}
        />
      </section>

      {caTrend.length ? (
        <section className="su-sect">
          <div className="su-sect-head">
            <span className="su-idx">02</span>
            <h2>Current-affairs quiz</h2>
            <p>Daily digest self-check accuracy over the last 30 days.</p>
          </div>
          <MetricLine
            series={caTrend.map((c) => ({ x: c.label, sub: `${c.attempted} answered`, values: { acc: c.accuracyPct } }))}
            height={220}
            metrics={[{ key: "acc", label: "Accuracy", suffix: "%", max: 100, tone: "good", decimals: 0 }]}
          />
        </section>
      ) : null}

      <section className="su-sect rc-cards">
        <div className="su-sect-head">
          <span className="su-idx">{caTrend.length ? "03" : "02"}</span>
          <h2>The cards</h2>
          <p>Each verdict, its numbers and the viva — open any week or month.</p>
        </div>
        <ReportCardClient
          initialWeekly={weekly.map((review) => serializeReviewForClient(review, review.weekStart, "weekly")) as never}
          initialMonthly={monthly.map((review) => serializeReviewForClient(review, review.monthStart, "monthly")) as never}
        />
      </section>
    </main>
  );
}
