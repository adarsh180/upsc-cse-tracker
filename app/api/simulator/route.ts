import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getWeakAreas } from "@/lib/agent-memory";
import { extractJsonBlock, getGoogleModel } from "@/lib/ai-models";
import { getSession } from "@/lib/auth";
import { getLatestDigest } from "@/lib/current-affairs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MARKS_PER_QUESTION = 2;
const NEGATIVE_PER_WRONG = 2 / 3;

const SIM_SUBJECTS = [
  "Polity & Governance",
  "Modern History",
  "Ancient & Medieval History",
  "Art & Culture",
  "Geography",
  "Economy",
  "Environment & Ecology",
  "Science & Tech",
  "International Relations",
  "Current Affairs",
] as const;

const QUESTION_TYPES = [
  "DIRECT",            // single factual/conceptual question
  "STATEMENTS",        // Consider the following statements → is/are correct
  "HOW_MANY",          // How many of the above statements are correct (Only one/two/three/None…)
  "STATEMENT_I_II",    // Statement-I / Statement-II, relation options (post-2023 pattern)
  "MATCH_PAIRS",       // pairs correctly matched / how many pairs
  "ASSERTION_REASON",  // Assertion (A) / Reason (R)
] as const;

const questionSchema = z.object({
  qtype: z.enum(QUESTION_TYPES).default("DIRECT"),
  context: z.string().nullish(),          // intro line, e.g. "With reference to X, consider the following statements:"
  statements: z.array(z.string()).max(10).nullish(), // full lines incl. their own labels ("1. …", "Statement-I: …", "Lake — State")
  question: z.string(),                   // closing question line (or the whole question for DIRECT)
  options: z.array(z.string()).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
  subject: z.string(),
  topic: z.string(),
  source: z.string().nullish(),           // "UPSC CSE 2019" for real PYQs, "AI · cross-verified" otherwise
});

type SimQuestion = z.infer<typeof questionSchema>;

const generateSchema = z.object({
  action: z.literal("generate"),
  count: z.number().int().min(5).max(50).default(10),
  subjects: z.array(z.enum(SIM_SUBJECTS)).max(SIM_SUBJECTS.length).optional(),
  focusWeakAreas: z.boolean().default(true),
  includeCurrentAffairs: z.boolean().default(true),
});

const submitSchema = z.object({
  action: z.literal("submit"),
  questions: z.array(questionSchema).min(1),
  answers: z.array(z.number().int().min(0).max(3).nullable()),
  timeTakenSec: z.number().int().min(0),
});

/** Flatten a structured question into UPSC-paper-style plain text (for storage/logs). */
function flattenQuestion(question: SimQuestion) {
  const parts: string[] = [];
  if (question.context) parts.push(question.context);
  if (question.statements?.length) parts.push(question.statements.join("\n"));
  parts.push(question.question);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Real PYQs from the bank — included verbatim, never round-tripped through
// the model, so the official answer cannot be corrupted.
// ---------------------------------------------------------------------------
async function getVerbatimPyqs(count: number, subjects?: string[]) {
  const pyqs = await db.pyqQuestion.findMany({
    where: {
      examStage: "PRELIMS",
      optionsJson: { not: null },
      correctAnswer: { not: null },
      subject: subjects?.length ? { in: subjects } : undefined,
    },
    orderBy: [{ askedCount: "asc" }, { lastAskedAt: "asc" }],
    take: Math.max(0, Math.floor(count * 0.4)),
  });

  const usedIds: string[] = [];
  const questions: SimQuestion[] = [];

  for (const pyq of pyqs) {
    try {
      const options = JSON.parse(pyq.optionsJson ?? "[]") as string[];
      if (options.length !== 4) continue;
      const answerIndex = options.findIndex(
        (option) => option.trim().toLowerCase() === (pyq.correctAnswer ?? "").trim().toLowerCase(),
      );
      if (answerIndex < 0) continue;
      const lines = pyq.question.split("\n").map((line) => line.trim()).filter(Boolean);
      questions.push({
        qtype: lines.length > 2 ? "STATEMENTS" : "DIRECT",
        context: lines.length > 2 ? lines[0] : null,
        statements: lines.length > 2 ? lines.slice(1, -1) : null,
        question: lines.length > 2 ? lines[lines.length - 1] : pyq.question,
        options,
        answerIndex,
        explanation: pyq.explanation ?? `Official UPSC answer: ${pyq.correctAnswer}.`,
        subject: pyq.subject ?? "General Studies",
        topic: pyq.topic ?? "PYQ",
        source: `UPSC CSE ${pyq.year} (official answer key)`,
      });
      usedIds.push(pyq.id);
    } catch {
      // skip malformed rows
    }
  }

  return { questions, usedIds };
}

// ---------------------------------------------------------------------------
// Fresh AI questions in the modern UPSC idiom (2016–2026 trend mix)
// ---------------------------------------------------------------------------
function buildGenerationPrompt(input: {
  count: number;
  subjects?: string[];
  weakTopics: unknown[];
  revisionDebt: string[];
  recentMistakes: string[];
  digestContext: string | null;
  pyqStyleSamples: string[];
  focusWeakAreas: boolean;
}) {
  const subjectRule = input.subjects?.length
    ? `ONLY use these subjects: ${input.subjects.join(", ")}. Distribute questions across them.`
    : `Spread across: Polity & Governance, Modern History, Ancient & Medieval History, Art & Culture, Geography, Economy, Environment & Ecology, Science & Tech, International Relations${input.digestContext ? ", Current Affairs" : ""}.`;

  const weakRule =
    input.focusWeakAreas && input.weakTopics.length
      ? `About half the questions must target the aspirant's weak areas: ${JSON.stringify(input.weakTopics.slice(0, 8))}${
          input.revisionDebt.length ? ` and revision-debt topics: ${JSON.stringify(input.revisionDebt.slice(0, 5))}` : ""
        }. The rest must cover the other subjects in scope so the mock stays balanced.`
      : "Balance the paper across the subjects in scope.";

  return `You are a UPSC CSE Prelims GS Paper-I question setter. Produce exactly ${input.count} MCQs as STRICT JSON array (no prose, no markdown fences).

Each question object:
{
 "qtype": "DIRECT" | "STATEMENTS" | "HOW_MANY" | "STATEMENT_I_II" | "MATCH_PAIRS" | "ASSERTION_REASON",
 "context": "intro line or null",
 "statements": ["each statement as a SEPARATE array element, carrying its own label"] or null,
 "question": "the closing question line only",
 "options": ["(a) text","(b) text","(c) text","(d) text" → but WITHOUT the (a)/(b) prefixes, just the text],
 "answerIndex": 0-3,
 "explanation": "why the answer is correct AND why each wrong statement/option is wrong",
 "subject": "one of the allowed subjects",
 "topic": "specific topic",
 "source": "AI"
}

FORMAT RULES (follow the real UPSC idiom exactly):
- STATEMENTS → context like "With reference to X, consider the following statements:"; statements like "1. …", "2. …"; question "Which of the statements given above is/are correct?"; options like "1 only", "2 and 3 only", "1, 2 and 3", "None of the above".
- HOW_MANY (post-2022 pattern) → 3-5 numbered statements; question "How many of the above statements are correct?"; options "Only one", "Only two", "Only three"/"All three", "None".
- STATEMENT_I_II (post-2023 pattern) → exactly two statements labelled "Statement-I: …" and "Statement-II: …"; question "Which one of the following is correct in respect of the above statements?"; options: both correct & II explains I / both correct but II does not explain I / I correct, II incorrect / I incorrect, II correct.
- MATCH_PAIRS → context "Consider the following pairs:"; statements like "Tso Lhamo Lake — Sikkim" (pair per line, em-dash separated); question "How many of the pairs given above are correctly matched?" with Only one/Only two/All three/None options, or classic List-I/List-II codes.
- ASSERTION_REASON → statements "Assertion (A): …" and "Reason (R): …" with the four standard options.
- DIRECT → context null, statements null, full question text in "question".

CONTENT MIX (modern 2016–2026 trend):
- ~30% STATEMENTS, ~20% HOW_MANY, ~15% STATEMENT_I_II, ~10% MATCH_PAIRS, ~15% DIRECT factual, ~10% ASSERTION_REASON or applied/analytical DIRECT.
- Include questions that INTERCONNECT subjects (e.g. geography of a historical trade route, economics of an environmental treaty, polity angle of a current scheme) — UPSC loves cross-cutting questions.
- Difficulty: genuine UPSC level — elimination-resistant distractors that are factually plausible, not absurd.
- ${subjectRule}
- ${weakRule}
${input.recentMistakes.length ? `- The aspirant recently got these wrong — write FRESH questions testing the same facts/concepts from a different angle:\n${input.recentMistakes.slice(0, 8).map((m) => `  • ${m}`).join("\n")}` : ""}
${input.digestContext ? `- Ground 2-3 questions in TODAY'S verified current affairs below (use ONLY facts stated there, do not embellish):\n${input.digestContext}` : ""}
${input.pyqStyleSamples.length ? `\nSTYLE REFERENCE — real UPSC PYQs (match this register; do NOT copy them):\n${input.pyqStyleSamples.slice(0, 4).join("\n---\n")}` : ""}

ACCURACY RULES (critical):
- Every statement you mark "correct" must be an established, verifiable fact. If unsure of a fact, do not use it — pick a fact you are certain of.
- Exactly ONE option may be defensible; check the answer twice against your own statements before emitting.
- No invented schemes, dates, articles, or reports.`;
}

const verificationVerdictSchema = z.array(
  z.object({
    index: z.number().int().min(0),
    verdict: z.enum(["ok", "fix", "drop"]),
    answerIndex: z.number().int().min(0).max(3).optional(),
    explanation: z.string().optional(),
    reason: z.string().optional(),
  }),
);

/** Second pass: independent fact-check + answer-consistency audit of AI questions. */
async function verifyQuestions(questions: SimQuestion[]) {
  if (!questions.length) return [];
  const prompt = `You are a strict UPSC fact-checker. Audit each MCQ below:
1. Is every statement/option factually accurate (real articles, dates, reports, geography)?
2. Is there EXACTLY one defensible correct option?
3. Does answerIndex match the explanation and the facts?

Return STRICT JSON array only: [{"index":0,"verdict":"ok"}] where verdict is:
- "ok"  → factually sound, answer correct
- "fix" → facts fine but answerIndex/explanation wrong → include corrected "answerIndex" and "explanation"
- "drop" → contains a factual error or ambiguity that cannot be fixed → include "reason"
Be ruthless: when in doubt about a fact, verdict "drop".

QUESTIONS:
${JSON.stringify(questions.map((q, index) => ({ index, text: flattenQuestion(q), options: q.options, answerIndex: q.answerIndex, explanation: q.explanation })))}`;

  const result = await generateText({ model: getGoogleModel(), prompt, temperature: 0, maxOutputTokens: 4096 });
  const verdicts = verificationVerdictSchema.safeParse(extractJsonBlock(result.text));
  if (!verdicts.success) return questions.map((question) => ({ ...question, source: "AI" })); // audit unavailable → keep, but unlabeled as verified

  const kept: SimQuestion[] = [];
  for (const verdict of verdicts.data) {
    const question = questions[verdict.index];
    if (!question) continue;
    if (verdict.verdict === "drop") continue;
    kept.push({
      ...question,
      answerIndex: verdict.verdict === "fix" && verdict.answerIndex != null ? verdict.answerIndex : question.answerIndex,
      explanation: verdict.verdict === "fix" && verdict.explanation ? verdict.explanation : question.explanation,
      source: "AI · cross-verified",
    });
  }
  return kept;
}

async function generateQuestions(input: z.infer<typeof generateSchema>) {
  const { count, subjects, focusWeakAreas, includeCurrentAffairs } = input;

  const [weakAreas, pyqResult, digest, recentWrong] = await Promise.all([
    getWeakAreas(),
    getVerbatimPyqs(count, subjects),
    includeCurrentAffairs ? getLatestDigest() : Promise.resolve(null),
    db.testQuestionLog.findMany({
      where: { outcome: { in: ["INCORRECT", "WRONG"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { questionSummary: true, correctAnswer: true },
    }),
  ]);

  const digestContext =
    digest && digest.itemsJson
      ? (JSON.parse(digest.itemsJson) as Array<{ title: string; upscAngle: string; syllabusTag: string }>)
          .slice(0, 6)
          .map((item) => `• [${item.syllabusTag}] ${item.title} — ${item.upscAngle}`)
          .join("\n")
      : null;

  const pyqStyleSamples = pyqResult.questions.slice(0, 4).map((q) => flattenQuestion(q));
  const aiNeeded = count - pyqResult.questions.length;
  // Over-generate ~25% so verification drops don't leave the mock short.
  const aiToRequest = Math.min(50, Math.ceil(aiNeeded * 1.25));

  const prompt = buildGenerationPrompt({
    count: aiToRequest,
    subjects,
    weakTopics: weakAreas.weakTopicsFromTests,
    revisionDebt: weakAreas.revisionDebt.map((entry: { topic: string }) => entry.topic),
    recentMistakes: recentWrong.map(
      (log) => `${log.questionSummary.slice(0, 180)} (correct: ${log.correctAnswer ?? "?"})`,
    ),
    digestContext,
    pyqStyleSamples,
    focusWeakAreas,
  });

  const result = await generateText({ model: getGoogleModel(), prompt, temperature: 0.7, maxOutputTokens: 8192 });
  const rawQuestions = z.array(questionSchema).safeParse(extractJsonBlock(result.text));
  if (!rawQuestions.success && pyqResult.questions.length === 0) {
    throw new Error("Question model returned invalid JSON. Try again.");
  }

  const verified = await verifyQuestions((rawQuestions.success ? rawQuestions.data : []).slice(0, aiToRequest));

  // Interleave: PYQs spread through the paper rather than clumped at the start.
  const aiQuestions = verified.slice(0, aiNeeded);
  const merged: SimQuestion[] = [];
  const pyqQueue = [...pyqResult.questions];
  const aiQueue = [...aiQuestions];
  const total = pyqQueue.length + aiQueue.length;
  for (let i = 0; i < total; i += 1) {
    const usePyq = pyqQueue.length > 0 && (aiQueue.length === 0 || i % 3 === 1);
    merged.push(usePyq ? pyqQueue.shift()! : aiQueue.shift()!);
  }

  if (merged.length === 0) throw new Error("No questions survived generation + verification. Try again.");

  if (pyqResult.usedIds.length) {
    await db.pyqQuestion.updateMany({
      where: { id: { in: pyqResult.usedIds } },
      data: { askedCount: { increment: 1 }, lastAskedAt: new Date() },
    });
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Scoring (unchanged marking scheme: +2 / −0.67)
// ---------------------------------------------------------------------------
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
      notes: "AI simulator mock (PYQ-anchored, cross-verified).",
      questionLogs: {
        create: questions.map((question, index) => {
          const picked = answers[index] ?? null;
          const outcome = picked === null ? "SKIPPED" : picked === question.answerIndex ? "CORRECT" : "INCORRECT";
          return {
            questionNumber: index + 1,
            questionType: "OBJECTIVE",
            questionSummary: flattenQuestion(question).slice(0, 1500),
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
      const questions = await generateQuestions(input);
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
