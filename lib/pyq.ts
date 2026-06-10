import { db } from "@/lib/db";

export async function addPyqQuestion(input: {
  year: number;
  examStage?: "PRELIMS" | "MAINS";
  paper?: string;
  subject?: string;
  topic?: string;
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
}) {
  const existing = await db.pyqQuestion.findFirst({
    where: { question: input.question.trim(), year: input.year },
    select: { id: true },
  });
  if (existing) return { ok: true, pyqId: existing.id, deduplicated: true };

  const pyq = await db.pyqQuestion.create({
    data: {
      year: input.year,
      examStage: input.examStage ?? "PRELIMS",
      paper: input.paper?.slice(0, 80) ?? null,
      subject: input.subject?.slice(0, 120) ?? null,
      topic: input.topic?.slice(0, 255) ?? null,
      question: input.question.trim(),
      optionsJson: input.options?.length ? JSON.stringify(input.options) : null,
      correctAnswer: input.correctAnswer?.trim() || null,
      explanation: input.explanation?.trim() || null,
    },
  });
  return { ok: true, pyqId: pyq.id, deduplicated: false };
}

export async function searchPyqQuestions(input: {
  query?: string;
  subject?: string;
  topic?: string;
  examStage?: "PRELIMS" | "MAINS";
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
  const terms = (input.query ?? "")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 5);

  const pyqs = await db.pyqQuestion.findMany({
    where: {
      examStage: input.examStage,
      subject: input.subject ? { contains: input.subject } : undefined,
      topic: input.topic ? { contains: input.topic } : undefined,
      OR: terms.length
        ? terms.map((term) => ({ question: { contains: term } }))
        : undefined,
    },
    orderBy: [{ askedCount: "asc" }, { year: "desc" }],
    take: limit,
  });

  return pyqs.map((pyq) => ({
    id: pyq.id,
    year: pyq.year,
    examStage: pyq.examStage,
    paper: pyq.paper,
    subject: pyq.subject,
    topic: pyq.topic,
    question: pyq.question,
    options: pyq.optionsJson ? (JSON.parse(pyq.optionsJson) as string[]) : null,
    correctAnswer: pyq.correctAnswer,
    explanation: pyq.explanation,
    timesAskedBefore: pyq.askedCount,
  }));
}

export async function markPyqAsked(pyqId: string) {
  await db.pyqQuestion.update({
    where: { id: pyqId },
    data: { askedCount: { increment: 1 }, lastAskedAt: new Date() },
  });
  return { ok: true };
}
