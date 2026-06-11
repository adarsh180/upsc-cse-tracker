import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { istDayKey, type DigestItem, type DigestQuizItem } from "@/lib/current-affairs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const answerSchema = z.object({
  questionIndex: z.number().int().min(0).max(20),
  selectedIndex: z.number().int().min(0).max(3),
});

/** Record one answer of today's current-affairs self-check (idempotent per question). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const dayKey = istDayKey();
  const digest = await db.currentAffairsDigest.findUnique({ where: { digestDate: dayKey } });
  if (!digest?.quizJson) return NextResponse.json({ error: "No quiz for today" }, { status: 404 });

  let quiz: DigestQuizItem[] = [];
  let items: DigestItem[] = [];
  try {
    quiz = JSON.parse(digest.quizJson);
    items = JSON.parse(digest.itemsJson);
  } catch {
    return NextResponse.json({ error: "Quiz data corrupted" }, { status: 500 });
  }

  const question = quiz[parsed.data.questionIndex];
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const attempt = await db.caQuizAttempt.upsert({
    where: {
      digestDate_questionIndex: { digestDate: dayKey, questionIndex: parsed.data.questionIndex },
    },
    // First answer is final — re-clicks don't overwrite the record.
    update: {},
    create: {
      digestDate: dayKey,
      questionIndex: parsed.data.questionIndex,
      question: question.question,
      optionsJson: JSON.stringify(question.options ?? []),
      selectedIndex: parsed.data.selectedIndex,
      correctIndex: question.answerIndex,
      isCorrect: parsed.data.selectedIndex === question.answerIndex,
      explanation: question.explanation ?? null,
      syllabusTag: items[parsed.data.questionIndex]?.syllabusTag ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    attempt: {
      questionIndex: attempt.questionIndex,
      selectedIndex: attempt.selectedIndex,
      isCorrect: attempt.isCorrect,
    },
  });
}
