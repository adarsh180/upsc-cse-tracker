import { ReportCardClient } from "@/components/ai/report-card-client";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeReviewForClient } from "@/lib/report-card";

export const dynamic = "force-dynamic";

export default async function ReportCardPage() {
  await requireSession();

  const [weekly, monthly] = await Promise.all([
    db.weeklyReview.findMany({ orderBy: { weekStart: "desc" }, take: 8 }),
    db.monthlyReview.findMany({ orderBy: { monthStart: "desc" }, take: 6 }),
  ]);

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
        <ReportCardClient
          initialWeekly={weekly.map((review) => serializeReviewForClient(review, review.weekStart, "weekly")) as never}
          initialMonthly={monthly.map((review) => serializeReviewForClient(review, review.monthStart, "monthly")) as never}
        />
      </section>
    </main>
  );
}
