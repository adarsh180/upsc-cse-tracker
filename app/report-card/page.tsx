import { format, subDays } from "date-fns";

import { ReportCardClient } from "@/components/ai/report-card-client";
import { ProgressTrends, type CaTrendPoint, type WeeklyTrendPoint } from "@/components/charts/progress-trends";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeReviewForClient } from "@/lib/report-card";

export const dynamic = "force-dynamic";

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
    <main className="page-shell">
      <PageIntro
        eyebrow="Report Card"
        title="Your mentor's verdict, on the record."
        description="Weekly and monthly report cards: the numbers, the honest read on how you logged them, and a UPSC-style viva drawn only from what you claimed to study."
        glyph="essay"
      />
      <section className="db-section">
        <div className="db-section-title">Progress at a glance</div>
        <ProgressTrends weekly={weeklyTrend} caDaily={caTrend} />
      </section>

      <section className="db-section">
        <ReportCardClient
          initialWeekly={weekly.map((review) => serializeReviewForClient(review, review.weekStart, "weekly")) as never}
          initialMonthly={monthly.map((review) => serializeReviewForClient(review, review.monthStart, "monthly")) as never}
        />
      </section>
    </main>
  );
}
