import { logCrossExamQuestion, recordCrossExamAnswer } from "@/lib/agent-memory";
import { extractJsonBlock, generateTextResilient } from "@/lib/ai-models";
import { db } from "@/lib/db";

/**
 * Viva: verification questions generated strictly from what the user CLAIMED to
 * study in a period. If the logs are honest, these should be easy marks; if not,
 * the report card surfaces it. Stored on the review row (quizJson) and mirrored
 * into CrossExamEntry so the Guru chat can follow up on failures.
 */
export type VivaQuestion = {
  entryId: string;
  index: number;
  kind: "MCQ" | "MAINS";
  question: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
  expectedPoints?: string;
  subject?: string;
  topic?: string;
  status: "PENDING" | "ANSWERED";
  userAnswer?: string;
  verdict?: "CORRECT" | "PARTIAL" | "INCORRECT";
  score?: number;
  feedback?: string;
};

export type VivaPayload = {
  questions: VivaQuestion[];
  summary: {
    total: number;
    answered: number;
    correct: number;
    partial: number;
    avgScore: number | null;
  };
};

export function summarizeViva(questions: VivaQuestion[]): VivaPayload["summary"] {
  const answered = questions.filter((question) => question.status === "ANSWERED");
  const scores = answered.map((question) => question.score).filter((score): score is number => score != null);
  return {
    total: questions.length,
    answered: answered.length,
    correct: answered.filter((question) => question.verdict === "CORRECT").length,
    partial: answered.filter((question) => question.verdict === "PARTIAL").length,
    avgScore: scores.length > 0 ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : null,
  };
}

async function getClaimedStudyMaterial(rangeStart: Date, rangeEnd: Date) {
  const [studyLogs, doneTasks, checkedTopics] = await Promise.all([
    db.studyLog.findMany({
      where: { logDate: { gte: rangeStart, lt: rangeEnd } },
      select: { title: true, hours: true, notes: true, studyNode: { select: { title: true, parent: { select: { title: true } } } } },
      take: 60,
    }),
    db.agentTask.findMany({
      where: { status: "DONE", updatedAt: { gte: rangeStart, lt: rangeEnd } },
      select: { title: true, detail: true, taskType: true },
      take: 40,
    }),
    db.topicProgress.findMany({
      where: { checked: true, checkedAt: { gte: rangeStart, lt: rangeEnd } },
      select: { studyNode: { select: { title: true, parent: { select: { title: true } } } } },
      take: 40,
    }),
  ]);

  return {
    studyLogs: studyLogs.map((log) => ({
      title: log.title,
      hours: log.hours,
      subject: log.studyNode?.parent?.title ?? null,
      topic: log.studyNode?.title ?? null,
    })),
    completedTodos: doneTasks.map((task) => ({ title: task.title, type: task.taskType, detail: task.detail?.slice(0, 160) ?? null })),
    topicsMarkedComplete: checkedTopics.map((progress) => ({
      topic: progress.studyNode.title,
      subject: progress.studyNode.parent?.title ?? null,
    })),
  };
}

export async function generateVivaQuestions(input: {
  rangeStart: Date;
  rangeEnd: Date;
  count: number;
  scopeLabel: string;
  mainsShare?: number;
}): Promise<VivaQuestion[]> {
  const claimed = await getClaimedStudyMaterial(input.rangeStart, input.rangeEnd);
  const totalClaims =
    claimed.studyLogs.length + claimed.completedTodos.length + claimed.topicsMarkedComplete.length;
  if (totalClaims === 0) return [];

  const mainsCount = Math.max(1, Math.round(input.count * (input.mainsShare ?? 0.35)));
  const mcqCount = input.count - mainsCount;

  const prompt = `You are UPSC-GURU setting a ${input.scopeLabel} verification viva for Adarsh Tiwari (UPSC CSE 2027, PSIR optional).
He CLAIMS to have studied the material below in this period. Set questions ONLY from those claimed areas — the point is to verify the claims in authentic UPSC style. Mix difficulty; at least one question should be genuinely hard.

Output STRICT JSON (no prose, no fences):
{
  "questions": [
    { "kind": "MCQ", "question": "UPSC Prelims style, statement-based where natural", "options": ["...","...","...","..."], "answerIndex": 0, "explanation": "why, in 1-2 lines", "subject": "...", "topic": "..." },
    { "kind": "MAINS", "question": "UPSC Mains style directive question (Discuss/Examine/Critically analyse) answerable in ~150 words", "expectedPoints": "the 4-6 points a good answer must contain, semicolon-separated", "subject": "...", "topic": "..." }
  ]
}
Rules: exactly ${mcqCount} MCQ questions and ${mainsCount} MAINS questions, in that order. Each question must clearly map to one of his claimed items. Plausible distractors for MCQs.

CLAIMED STUDY (period ${input.rangeStart.toISOString().slice(0, 10)} to ${input.rangeEnd.toISOString().slice(0, 10)}):
${JSON.stringify(claimed, null, 2)}`;

  const result = await generateTextResilient({ prompt, temperature: 0.6, maxOutputTokens: 4096, timeoutMs: 120_000 });
  const parsed = extractJsonBlock<{ questions?: Array<Record<string, unknown>> }>(result.text);
  const raw = Array.isArray(parsed?.questions) ? parsed.questions : [];

  const questions: VivaQuestion[] = [];
  for (const [index, item] of raw.slice(0, input.count).entries()) {
    const kind = item.kind === "MAINS" ? "MAINS" : "MCQ";
    const questionText = String(item.question ?? "").trim();
    if (!questionText) continue;
    const options = Array.isArray(item.options) ? item.options.map(String).slice(0, 4) : undefined;
    if (kind === "MCQ" && (!options || options.length < 4)) continue;

    const { entryId } = await logCrossExamQuestion({
      question: questionText,
      expectedPoints:
        kind === "MAINS"
          ? String(item.expectedPoints ?? "")
          : `Correct option: ${options?.[Number(item.answerIndex) || 0] ?? ""}. ${String(item.explanation ?? "")}`,
      topicLabel: item.topic ? String(item.topic) : undefined,
      subjectLabel: item.subject ? String(item.subject) : `${input.scopeLabel} viva`,
    });

    questions.push({
      entryId,
      index,
      kind,
      question: questionText,
      options,
      answerIndex: kind === "MCQ" ? Math.min(Math.max(Number(item.answerIndex) || 0, 0), 3) : undefined,
      explanation: item.explanation ? String(item.explanation) : undefined,
      expectedPoints: kind === "MAINS" ? String(item.expectedPoints ?? "") : undefined,
      subject: item.subject ? String(item.subject) : undefined,
      topic: item.topic ? String(item.topic) : undefined,
      status: "PENDING",
    });
  }

  return questions;
}

export function parseQuizColumn(quizJson: string | null): { questions: VivaQuestion[] } {
  if (!quizJson) return { questions: [] };
  try {
    const parsed = JSON.parse(quizJson);
    return { questions: Array.isArray(parsed.questions) ? parsed.questions : [] };
  } catch {
    return { questions: [] };
  }
}

/** Shared client-facing shape for weekly/monthly report cards (page + API). */
export function serializeReviewForClient(
  review: {
    id: string;
    reportText: string;
    integrityJson: string | null;
    quizJson: string | null;
    createdAt: Date;
  },
  periodStart: Date,
  scope: "weekly" | "monthly",
) {
  const { questions } = parseQuizColumn(review.quizJson);
  let integrity: unknown = null;
  try {
    integrity = review.integrityJson ? JSON.parse(review.integrityJson) : null;
  } catch {
    integrity = null;
  }
  return {
    id: review.id,
    scope,
    periodStart: periodStart.toISOString(),
    reportText: review.reportText,
    integrity,
    viva: { questions: redactViva(questions), summary: summarizeViva(questions) },
    createdAt: review.createdAt.toISOString(),
  };
}

/** Strip grading keys from pending questions before sending to the client. */
export function redactViva(questions: VivaQuestion[]): VivaQuestion[] {
  return questions.map((question) =>
    question.status === "ANSWERED"
      ? question
      : { ...question, answerIndex: undefined, explanation: undefined, expectedPoints: undefined },
  );
}

export async function gradeVivaAnswer(question: VivaQuestion, answer: string): Promise<VivaQuestion> {
  if (question.status === "ANSWERED") return question;

  if (question.kind === "MCQ") {
    const chosen = Number(answer);
    const correct = chosen === question.answerIndex;
    const graded: VivaQuestion = {
      ...question,
      status: "ANSWERED",
      userAnswer: question.options?.[chosen] ?? answer,
      verdict: correct ? "CORRECT" : "INCORRECT",
      score: correct ? 10 : 0,
      feedback: `${correct ? "Correct." : `Incorrect — the answer is "${question.options?.[question.answerIndex ?? 0] ?? "?"}".`} ${question.explanation ?? ""}`.trim(),
    };
    await recordCrossExamAnswer({
      entryId: question.entryId,
      userAnswer: graded.userAnswer ?? "",
      verdict: graded.verdict!,
      score: graded.score,
      feedback: graded.feedback,
    }).catch(() => {});
    return graded;
  }

  const prompt = `You are a strict but fair UPSC Mains evaluator. Grade this answer.
QUESTION: ${question.question}
EXPECTED POINTS: ${question.expectedPoints ?? "n/a"}
HIS ANSWER: ${answer.slice(0, 2500)}

Output STRICT JSON only: { "verdict": "CORRECT" | "PARTIAL" | "INCORRECT", "score": 0-10, "feedback": "2-4 sentences: what was right, what was missing, one concrete improvement in UPSC answer-writing terms (structure, keywords, examples)" }
Verdict guide: CORRECT = covers most expected points accurately; PARTIAL = right direction but significant gaps; INCORRECT = wrong, empty, or bluffing.`;

  const result = await generateTextResilient({ prompt, temperature: 0.3, maxOutputTokens: 768, timeoutMs: 90_000 });
  const parsed = extractJsonBlock<{ verdict?: string; score?: number; feedback?: string }>(result.text);
  const verdict =
    parsed?.verdict === "CORRECT" || parsed?.verdict === "PARTIAL" || parsed?.verdict === "INCORRECT"
      ? parsed.verdict
      : "PARTIAL";

  const graded: VivaQuestion = {
    ...question,
    status: "ANSWERED",
    userAnswer: answer.slice(0, 2500),
    verdict,
    score: parsed?.score != null ? Math.min(Math.max(Math.round(parsed.score), 0), 10) : verdict === "CORRECT" ? 8 : verdict === "PARTIAL" ? 5 : 1,
    feedback: parsed?.feedback ?? "Graded without detailed feedback (model output was unparseable).",
  };
  await recordCrossExamAnswer({
    entryId: question.entryId,
    userAnswer: graded.userAnswer ?? "",
    verdict: graded.verdict!,
    score: graded.score,
    feedback: graded.feedback,
  }).catch(() => {});
  return graded;
}
