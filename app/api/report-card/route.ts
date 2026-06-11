import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateMonthlyReview } from "@/lib/monthly-review";
import {
  gradeVivaAnswer,
  parseQuizColumn,
  serializeReviewForClient,
  summarizeViva,
} from "@/lib/report-card";
import { generateWeeklyReview } from "@/lib/weekly-review";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("answer"),
    scope: z.enum(["weekly", "monthly"]),
    reviewId: z.string(),
    questionIndex: z.number().int().min(0),
    answer: z.string().min(1).max(4000),
  }),
  z.object({
    action: z.literal("generate"),
    scope: z.enum(["weekly", "monthly"]),
    force: z.boolean().optional(),
  }),
]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json({
    weekly: weekly.map((review) => serializeReviewForClient(review, review.weekStart, "weekly")),
    monthly: monthly.map((review) => serializeReviewForClient(review, review.monthStart, "monthly")),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    if (parsed.data.action === "generate") {
      const outcome =
        parsed.data.scope === "weekly"
          ? await generateWeeklyReview(new Date(), parsed.data.force ?? false)
          : await generateMonthlyReview(new Date(), parsed.data.force ?? false);
      const review = outcome.review;
      const periodStart = "weekStart" in review ? review.weekStart : review.monthStart;
      return NextResponse.json({
        ok: true,
        created: outcome.created,
        review: serializeReviewForClient(review, periodStart, parsed.data.scope),
      });
    }

    const { scope, reviewId, questionIndex, answer } = parsed.data;
    const review =
      scope === "weekly"
        ? await db.weeklyReview.findUnique({ where: { id: reviewId } })
        : await db.monthlyReview.findUnique({ where: { id: reviewId } });
    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

    const { questions } = parseQuizColumn(review.quizJson);
    const question = questions.find((entry) => entry.index === questionIndex);
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });
    if (question.status === "ANSWERED") {
      return NextResponse.json({ ok: true, question, summary: summarizeViva(questions), alreadyAnswered: true });
    }

    const graded = await gradeVivaAnswer(question, answer);
    const updatedQuestions = questions.map((entry) => (entry.index === questionIndex ? graded : entry));
    const quizJson = JSON.stringify({ questions: updatedQuestions, summary: summarizeViva(updatedQuestions) });

    if (scope === "weekly") {
      await db.weeklyReview.update({ where: { id: reviewId }, data: { quizJson } });
    } else {
      await db.monthlyReview.update({ where: { id: reviewId }, data: { quizJson } });
    }

    return NextResponse.json({ ok: true, question: graded, summary: summarizeViva(updatedQuestions) });
  } catch (error) {
    console.error("[report-card] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
