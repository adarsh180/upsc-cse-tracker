import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getWeakAreas } from "@/lib/agent-memory";
import { extractJsonBlock, getGoogleModel } from "@/lib/ai-models";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MARKS_PER_QUESTION = 2;
const NEGATIVE_PER_WRONG = 2 / 3;

const questionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
  subject: z.string(),
  topic: z.string(),
});

const generateSchema = z.object({
  action: z.literal("generate"),
  count: z.number().int().min(5).max(50).default(10),
});

const submitSchema = z.object({
  action: z.literal("submit"),
  questions: z.array(questionSchema).min(1),
  answers: z.array(z.number().int().min(0).max(3).nullable()),
  timeTakenSec: z.number().int().min(0),
});

async function generateQuestions(count: number) {
  const [weakAreas, pyqs] = await Promise.all([
    getWeakAreas(),
    db.pyqQuestion.findMany({
      where: { examStage: "PRELIMS" },
      orderBy: [{ askedCount: "asc" }, { lastAskedAt: "asc" }],
      take: Math.min(count, 10),
      select: { id: true, question: true, optionsJson: true, correctAnswer: true, explanation: true, subject: true, topic: true, year: true },
    }),
  ]);

  const pyqBlock = pyqs.length
    ? `REAL PYQs TO INCLUDE VERBATIM (use them first, mark subject/topic from their data):\n${JSON.stringify(
        pyqs.map((pyq) => ({
          question: pyq.question,
          options: pyq.optionsJson,
          correctAnswer: pyq.correctAnswer,
          explanation: pyq.explanation,
          subject: pyq.subject,
          topic: pyq.topic,
          year: pyq.year,
        })),
      )}`
    : "No stored PYQs available — generate all questions fresh.";

  const prompt = `Create a UPSC CSE Prelims GS Paper 1 style mock of exactly ${count} MCQs as STRICT JSON (no fences, no prose):
[{"question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"...","subject":"Polity","topic":"..."}]
Requirements:
- UPSC standard: statement-based ("Consider the following statements..."), match-the-pairs, "how many of the above" formats where natural.
- Weight questions toward these weak areas (at least 60% of questions): ${JSON.stringify(weakAreas.weakTopicsFromTests.slice(0, 8))}
- Also cover revision-debt topics: ${JSON.stringify(weakAreas.revisionDebt.slice(0, 5).map((entry) => entry.topic))}
- Plausible distractors, single correct answer, crisp explanations.
${pyqBlock}`;

  const result = await generateText({
    model: getGoogleModel(),
    prompt,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  const questions = extractJsonBlock<z.infer<typeof questionSchema>[]>(result.text);
  const validated = z.array(questionSchema).min(1).safeParse(questions);
  if (!validated.success) {
    throw new Error("Simulator model returned invalid question JSON. Try again.");
  }

  if (pyqs.length) {
    await db.pyqQuestion.updateMany({
      where: { id: { in: pyqs.map((pyq) => pyq.id) } },
      data: { askedCount: { increment: 1 }, lastAskedAt: new Date() },
    });
  }

  return validated.data.slice(0, count);
}

async function scoreAndPersist(input: z.infer<typeof submitSchema>) {
  const { questions, answers, timeTakenSec } = input;

  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  for (let i = 0; i < questions.length; i += 1) {
    const picked = answers[i] ?? null;
    if (picked === null) skipped += 1;
    else if (picked === questions[i].answerIndex) correct += 1;
    else incorrect += 1;
  }

  const totalMarks = questions.length * MARKS_PER_QUESTION;
  const negative = Math.round(incorrect * NEGATIVE_PER_WRONG * MARKS_PER_QUESTION * 100) / 100;
  const score = Math.round((correct * MARKS_PER_QUESTION - negative) * 100) / 100;
  const accuracy = correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : null;

  const record = await db.testRecord.create({
    data: {
      title: `AI Prelims Simulator — ${new Date().toISOString().slice(0, 10)}`,
      examStage: "PRELIMS",
      testType: "AI_SIMULATOR",
      testDate: new Date(),
      totalQuestions: questions.length,
      totalMarks,
      score,
      negativeMarks: negative,
      correctQuestions: correct,
      incorrectQuestions: incorrect,
      attemptedQuestions: correct + incorrect,
      timeMinutes: Math.max(1, Math.round(timeTakenSec / 60)),
      notes: "Auto-generated from weak areas by the AI simulator.",
      questionLogs: {
        create: questions.map((question, index) => {
          const picked = answers[index] ?? null;
          const outcome = picked === null ? "SKIPPED" : picked === question.answerIndex ? "CORRECT" : "INCORRECT";
          return {
            questionNumber: index + 1,
            questionType: "OBJECTIVE",
            questionSummary: question.question.slice(0, 1500),
            selectedAnswer: picked === null ? null : question.options[picked],
            correctAnswer: question.options[question.answerIndex],
            correctExplanation: question.explanation,
            subject: question.subject,
            topic: question.topic,
            sourceType: "AI_SIMULATOR",
            outcome,
            marksAwarded:
              outcome === "CORRECT" ? MARKS_PER_QUESTION : outcome === "INCORRECT" ? -NEGATIVE_PER_WRONG * MARKS_PER_QUESTION : 0,
            maxMarks: MARKS_PER_QUESTION,
          };
        }),
      },
    },
  });

  return {
    testRecordId: record.id,
    score,
    totalMarks,
    correct,
    incorrect,
    skipped,
    negative,
    accuracyPct: accuracy,
  };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  try {
    if (body.action === "generate") {
      const input = generateSchema.parse(body);
      const questions = await generateQuestions(input.count);
      return NextResponse.json({ ok: true, questions });
    }

    if (body.action === "submit") {
      const input = submitSchema.parse(body);
      const result = await scoreAndPersist(input);
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[simulator] failed:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
