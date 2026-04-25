import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { buildUPSCContext } from "@/lib/ai-context-builder";
import { normalizeGoogleModelId } from "@/lib/ai-models";
import { db } from "@/lib/db";

const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    "",
});

const OUTCOMES = ["CORRECT", "INCORRECT", "SKIPPED", "PARTIAL"] as const;
const RESOURCE_STATUSES = ["YES", "NO", "PARTIAL", "UNKNOWN"] as const;
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
const ERROR_TYPES = [
  "CONCEPT_GAP",
  "FACTUAL_GAP",
  "SILLY_MISTAKE",
  "ELIMINATION_ERROR",
  "CURRENT_AFFAIRS_GAP",
  "QUESTION_READING",
  "TIME_PRESSURE",
  "RESOURCE_GAP",
  "REVISION_GAP",
  "NONE",
] as const;

export type QuestionOutcome = (typeof OUTCOMES)[number];
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];
export type QuestionDifficulty = (typeof DIFFICULTIES)[number];
export type ErrorType = (typeof ERROR_TYPES)[number];
export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type QuestionLogInput = {
  testRecordId: string;
  questionNumber: number;
  questionSummary: string;
  correctAnswer?: string | null;
  correctExplanation?: string | null;
  mainsApproach?: string | null;
  mainsExamples?: string | null;
  subject?: string | null;
  topic?: string | null;
  sourceType?: string | null;
  outcome?: string | null;
  studiedTopic?: boolean;
  resourceCovered?: string | null;
  currentAffairsLinked?: boolean;
  errorType?: string | null;
  difficulty?: string | null;
  confidence?: number | null;
  timeSpentSeconds?: number | null;
  mistakeReason?: string | null;
  actionFix?: string | null;
  notes?: string | null;
};

function clampNumber(value: unknown, min: number, max: number, fallback: number | null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function cleanString(value: unknown, max = 4000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanLongText(value: unknown, max = 8000) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeOption<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]) {
  const normalized = cleanString(value, 80).toUpperCase().replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T[number]) : fallback;
}

function percent(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

type AnalyticsQuestion = {
  questionNumber: number;
  subject: string | null;
  topic: string | null;
  outcome: string;
  studiedTopic: boolean;
  resourceCovered: string;
  currentAffairsLinked: boolean;
  errorType: string | null;
  difficulty: string;
  confidence: number | null;
  timeSpentSeconds: number | null;
};

export function scoreQuestionSeverity(question: AnalyticsQuestion) {
  let score = 0;
  const reasons: string[] = [];
  const isMiss = ["INCORRECT", "PARTIAL", "SKIPPED"].includes(question.outcome);

  if (question.outcome === "INCORRECT") {
    score += 28;
    reasons.push("incorrect");
  }
  if (question.outcome === "PARTIAL") {
    score += 18;
    reasons.push("partial knowledge");
  }
  if (question.outcome === "SKIPPED") {
    score += 16;
    reasons.push("skipped");
  }
  if (isMiss && question.studiedTopic) {
    score += 18;
    reasons.push("studied but missed");
  }
  if (isMiss && question.resourceCovered === "NO") {
    score += 18;
    reasons.push("resource gap");
  }
  if (isMiss && question.resourceCovered === "UNKNOWN") {
    score += 10;
    reasons.push("coverage unknown");
  }
  if (isMiss && question.currentAffairsLinked) {
    score += 12;
    reasons.push("current affairs link");
  }
  if (["CONCEPT_GAP", "CURRENT_AFFAIRS_GAP", "RESOURCE_GAP", "REVISION_GAP"].includes(question.errorType ?? "")) {
    score += 14;
    reasons.push(String(question.errorType).replaceAll("_", " ").toLowerCase());
  }
  if (question.difficulty === "HARD" && isMiss) {
    score += 6;
    reasons.push("hard question");
  }
  if ((question.confidence ?? 3) <= 2 && isMiss) {
    score += 6;
    reasons.push("low confidence");
  }

  const capped = Math.min(100, score);
  const severity: SeverityLevel =
    capped >= 72 ? "CRITICAL" : capped >= 48 ? "HIGH" : capped >= 24 ? "MEDIUM" : "LOW";

  return { score: capped, severity, reasons };
}

export function normalizeQuestionInput(input: QuestionLogInput) {
  return {
    testRecordId: cleanString(input.testRecordId, 120),
    questionNumber: clampNumber(input.questionNumber, 1, 500, 1) ?? 1,
    questionSummary: cleanLongText(input.questionSummary, 2000) || "Question note",
    correctAnswer: cleanLongText(input.correctAnswer, 2000) || null,
    correctExplanation: cleanLongText(input.correctExplanation, 5000) || null,
    mainsApproach: cleanLongText(input.mainsApproach, 5000) || null,
    mainsExamples: cleanLongText(input.mainsExamples, 5000) || null,
    subject: cleanString(input.subject, 140) || null,
    topic: cleanString(input.topic, 180) || null,
    sourceType: cleanString(input.sourceType, 120) || "PRACTICE_TEST",
    outcome: normalizeOption(input.outcome, OUTCOMES, "SKIPPED"),
    studiedTopic: Boolean(input.studiedTopic),
    resourceCovered: normalizeOption(input.resourceCovered, RESOURCE_STATUSES, "UNKNOWN"),
    currentAffairsLinked: Boolean(input.currentAffairsLinked),
    errorType: normalizeOption(input.errorType, ERROR_TYPES, "NONE"),
    difficulty: normalizeOption(input.difficulty, DIFFICULTIES, "MEDIUM"),
    confidence: clampNumber(input.confidence, 1, 5, null),
    timeSpentSeconds: clampNumber(input.timeSpentSeconds, 0, 7200, null),
    mistakeReason: cleanLongText(input.mistakeReason, 4000) || null,
    actionFix: cleanLongText(input.actionFix, 4000) || null,
    notes: cleanLongText(input.notes, 4000) || null,
  };
}

export async function upsertQuestionLog(input: QuestionLogInput) {
  const data = normalizeQuestionInput(input);

  await db.testRecord.findUniqueOrThrow({
    where: { id: data.testRecordId },
    select: { id: true },
  });

  return db.testQuestionLog.upsert({
    where: {
      testRecordId_questionNumber: {
        testRecordId: data.testRecordId,
        questionNumber: data.questionNumber,
      },
    },
    update: data,
    create: data,
  });
}

export async function deleteQuestionLog(id: string) {
  await db.testQuestionLog.delete({ where: { id } });
  return { ok: true };
}

function buildBreakdown<T extends string>(
  items: T[],
  labels: readonly T[],
) {
  return labels.map((label) => ({
    label,
    count: items.filter((item) => item === label).length,
  }));
}

export function buildQuestionAnalytics(
  questionLogs: AnalyticsQuestion[],
) {
  const sorted = [...questionLogs].sort((a, b) => a.questionNumber - b.questionNumber);
  const severities = sorted.map((item) => ({
    questionNumber: item.questionNumber,
    subject: item.subject || "Unmapped",
    topic: item.topic || "Unmapped",
    errorType: item.errorType || "NONE",
    outcome: item.outcome,
    ...scoreQuestionSeverity(item),
  }));
  const total = sorted.length;
  const correct = sorted.filter((item) => item.outcome === "CORRECT").length;
  const incorrect = sorted.filter((item) => item.outcome === "INCORRECT").length;
  const skipped = sorted.filter((item) => item.outcome === "SKIPPED").length;
  const partial = sorted.filter((item) => item.outcome === "PARTIAL").length;
  const attempted = total - skipped;
  const resourceGap = sorted.filter((item) => item.resourceCovered === "NO" || item.resourceCovered === "UNKNOWN").length;
  const currentAffairs = sorted.filter((item) => item.currentAffairsLinked).length;
  const studiedButWrong = sorted.filter(
    (item) => item.studiedTopic && (item.outcome === "INCORRECT" || item.outcome === "PARTIAL"),
  ).length;
  const totalSeconds = sorted.reduce((sum, item) => sum + (item.timeSpentSeconds ?? 0), 0);

  const subjectMap = new Map<string, { total: number; correct: number; incorrect: number; skipped: number; partial: number }>();
  for (const item of sorted) {
    const key = item.subject || "Unmapped";
    const current = subjectMap.get(key) ?? { total: 0, correct: 0, incorrect: 0, skipped: 0, partial: 0 };
    current.total += 1;
    if (item.outcome === "CORRECT") current.correct += 1;
    if (item.outcome === "INCORRECT") current.incorrect += 1;
    if (item.outcome === "SKIPPED") current.skipped += 1;
    if (item.outcome === "PARTIAL") current.partial += 1;
    subjectMap.set(key, current);
  }

  let runningAttempted = 0;
  let runningScore = 0;
  const timeline = sorted.map((item) => {
    if (item.outcome !== "SKIPPED") runningAttempted += 1;
    if (item.outcome === "CORRECT") runningScore += 1;
    if (item.outcome === "PARTIAL") runningScore += 0.5;

    return {
      question: item.questionNumber,
      accuracy: percent(runningScore, Math.max(runningAttempted, 1)),
      cumulativeScore: Number(runningScore.toFixed(1)),
      attempted: runningAttempted,
      outcome: item.outcome,
      severity: scoreQuestionSeverity(item).score,
    };
  });

  const subjects = Array.from(subjectMap.entries()).map(([subject, value]) => ({
    subject,
    ...value,
    accuracy: percent(value.correct + value.partial * 0.5, value.total - value.skipped),
    errorRate: percent(value.incorrect + value.partial, value.total),
  }));

  return {
    total,
    correct,
    incorrect,
    skipped,
    partial,
    attempted,
    accuracy: percent(correct + partial * 0.5, attempted),
    skipRate: percent(skipped, total),
    resourceGapRate: percent(resourceGap, total),
    currentAffairsRate: percent(currentAffairs, total),
    studiedButWrong,
    avgSeconds: total ? Math.round(totalSeconds / total) : 0,
    subjects: subjects.sort((a, b) => b.total - a.total),
    errorTypes: buildBreakdown(
      sorted.map((item) => (item.errorType || "NONE") as ErrorType),
      ERROR_TYPES,
    ).filter((item) => item.count > 0),
    severity: {
      avgScore: severities.length
        ? Math.round(severities.reduce((sum, item) => sum + item.score, 0) / severities.length)
        : 0,
      critical: severities.filter((item) => item.severity === "CRITICAL").length,
      high: severities.filter((item) => item.severity === "HIGH").length,
      medium: severities.filter((item) => item.severity === "MEDIUM").length,
      low: severities.filter((item) => item.severity === "LOW").length,
      byQuestion: severities,
      top: severities
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
    },
    difficulties: buildBreakdown(
      sorted.map((item) => item.difficulty as QuestionDifficulty),
      DIFFICULTIES,
    ),
    timeline,
  };
}

type TestWithLogs = {
  id: string;
  title: string;
  testDate: Date;
  testType: string;
  examStage: string;
  questionLogs: AnalyticsQuestion[];
};

function buildPatternMemoryFromTests(tests: TestWithLogs[]) {
  const ordered = [...tests].sort((a, b) => a.testDate.getTime() - b.testDate.getTime());
  const buckets = new Map<
    string,
    {
      subject: string;
      topic: string;
      errorType: string;
      events: Array<{
        testId: string;
        testTitle: string;
        testDate: string;
        outcome: string;
        severityScore: number;
        severity: SeverityLevel;
      }>;
    }
  >();

  for (const test of ordered) {
    for (const question of test.questionLogs) {
      const isSignal =
        question.outcome !== "CORRECT" ||
        (question.errorType && question.errorType !== "NONE") ||
        question.resourceCovered === "NO" ||
        question.resourceCovered === "UNKNOWN";
      if (!isSignal) continue;

      const subject = question.subject || "Unmapped";
      const topic = question.topic || subject;
      const errorType = question.errorType || "NONE";
      const key = `${subject.toLowerCase()}::${topic.toLowerCase()}::${errorType}`;
      const current = buckets.get(key) ?? { subject, topic, errorType, events: [] };
      const severity = scoreQuestionSeverity(question);
      current.events.push({
        testId: test.id,
        testTitle: test.title,
        testDate: test.testDate.toISOString(),
        outcome: question.outcome,
        severityScore: severity.score,
        severity: severity.severity,
      });
      buckets.set(key, current);
    }
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const mistakes = bucket.events.filter((event) => event.outcome !== "CORRECT");
      const latest = bucket.events[bucket.events.length - 1];
      const earlierMistakes = bucket.events.slice(0, -1).some((event) => event.outcome !== "CORRECT");
      const recovered = earlierMistakes && latest?.outcome === "CORRECT";
      const repeated = mistakes.length >= 2 && latest?.outcome !== "CORRECT";
      const avgSeverity = bucket.events.length
        ? Math.round(bucket.events.reduce((sum, event) => sum + event.severityScore, 0) / bucket.events.length)
        : 0;
      const status = recovered ? "RECOVERED" : repeated ? "ACTIVE_LOOP" : "WATCH";
      const maxSeverity = avgSeverity >= 72 ? "CRITICAL" : avgSeverity >= 48 ? "HIGH" : avgSeverity >= 24 ? "MEDIUM" : "LOW";

      return {
        subject: bucket.subject,
        topic: bucket.topic,
        errorType: bucket.errorType,
        attempts: bucket.events.length,
        mistakes: mistakes.length,
        status,
        avgSeverity,
        severity: maxSeverity,
        firstSeen: bucket.events[0]?.testDate ?? null,
        lastSeen: latest?.testDate ?? null,
        latestTest: latest?.testTitle ?? null,
        quickNote:
          status === "RECOVERED"
            ? "Recovery visible. Keep this in light revision rotation."
            : status === "ACTIVE_LOOP"
              ? "Repeated miss. Convert the concept into a one-page note and revise before the next test."
              : "Single signal. Watch this area in the next two tests.",
        recommendation:
          bucket.errorType === "CURRENT_AFFAIRS_GAP"
            ? "Link this static topic with recent examples and revise the last 12-month current affairs notes."
            : bucket.errorType === "RESOURCE_GAP"
              ? "Check whether your main source covers this area; if not, add one compact source only."
              : bucket.errorType === "REVISION_GAP"
                ? "Move this into spaced revision and test it again after 3, 7 and 14 days."
                : "Write the exact trap and the correct elimination rule in your error notebook.",
      };
    })
    .sort((a, b) => b.mistakes - a.mistakes || b.avgSeverity - a.avgSeverity);
}

export async function getErrorAnalysisMemory() {
  const tests = await db.testRecord.findMany({
    orderBy: { testDate: "desc" },
    take: 40,
    include: {
      questionLogs: { orderBy: { questionNumber: "asc" } },
    },
  });

  const patterns = buildPatternMemoryFromTests(tests);
  const [latest, previous] = tests;
  const latestAnalytics = latest ? buildQuestionAnalytics(latest.questionLogs) : null;
  const previousAnalytics = previous ? buildQuestionAnalytics(previous.questionLogs) : null;

  return {
    patterns: patterns.slice(0, 14),
    activeLoops: patterns.filter((pattern) => pattern.status === "ACTIVE_LOOP").slice(0, 8),
    recovered: patterns.filter((pattern) => pattern.status === "RECOVERED").slice(0, 8),
    watch: patterns.filter((pattern) => pattern.status === "WATCH").slice(0, 6),
    comparison:
      latestAnalytics && previousAnalytics && latest && previous
        ? {
            latestTitle: latest.title,
            previousTitle: previous.title,
            accuracyDelta: Number((latestAnalytics.accuracy - previousAnalytics.accuracy).toFixed(1)),
            skipDelta: Number((latestAnalytics.skipRate - previousAnalytics.skipRate).toFixed(1)),
            resourceGapDelta: Number((latestAnalytics.resourceGapRate - previousAnalytics.resourceGapRate).toFixed(1)),
            severityDelta: latestAnalytics.severity.avgScore - previousAnalytics.severity.avgScore,
            latestLogged: latestAnalytics.total,
            previousLogged: previousAnalytics.total,
          }
        : null,
  };
}

export async function getTestAnalysisSnapshot(testId: string) {
  const test = await db.testRecord.findUnique({
    where: { id: testId },
    include: {
      studyNode: { select: { id: true, title: true } },
      questionLogs: {
        orderBy: { questionNumber: "asc" },
      },
      analysisReports: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!test) return null;

  return {
    test,
    analytics: buildQuestionAnalytics(test.questionLogs),
    memory: await getErrorAnalysisMemory(),
  };
}

async function generateWithFallback(prompt: string) {
  const candidates = [
    process.env.GOOGLE_AI_MODEL_ANALYTICS,
    process.env.GOOGLE_AI_MODEL_PRIMARY,
    process.env.GOOGLE_AI_MODEL_FALLBACK,
    process.env.GOOGLE_AI_MODEL_SECOND_FALLBACK,
    "gemma-3-27b-it",
    "gemma-3-12b-it",
  ].filter(Boolean) as string[];

  let lastError: unknown;
  for (const candidate of [...new Set(candidates)]) {
    try {
      const model = normalizeGoogleModelId(candidate);
      const result = await generateText({
        model: google(model),
        prompt,
        temperature: 0.35,
        maxOutputTokens: 2600,
      });

      return { text: result.text, model };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No AI model could generate the analysis.");
}

function reportGuardrails() {
  return [
    "Write clean markdown only. Do not use corrupted characters or decorative symbols.",
    "Use UPSC-specific language: prelims elimination, PYQ pattern, static-current linkage, resource coverage, revision gap and attempt discipline.",
    "Give precise recommendations that can be turned into study actions.",
    "Do not create micro drills.",
    "Do not claim live UPSC trend data unless it is present in the supplied tracker data.",
  ].join("\n");
}

export async function generateSingleTestReport(testId: string) {
  const snapshot = await getTestAnalysisSnapshot(testId);
  if (!snapshot) throw new Error("Test not found.");

  const context = await buildUPSCContext();
  const memory = await getErrorAnalysisMemory();
  const prompt = `You are generating an on-demand UPSC error-analysis report for one test only.

Rules:
${reportGuardrails()}

Test:
${JSON.stringify(
  {
    id: snapshot.test.id,
    title: snapshot.test.title,
    examStage: snapshot.test.examStage,
    testType: snapshot.test.testType,
    totalQuestions: snapshot.test.totalQuestions,
    score: snapshot.test.score,
    totalMarks: snapshot.test.totalMarks,
    subject: snapshot.test.studyNode?.title ?? null,
    notes: snapshot.test.notes,
  },
  null,
  2,
)}

Question-level logs:
${JSON.stringify(snapshot.test.questionLogs, null, 2)}

Computed analytics:
${JSON.stringify(snapshot.analytics, null, 2)}

Cross-test pattern memory:
${JSON.stringify(memory, null, 2)}

Live preparation context:
${JSON.stringify(
  {
    strictnessLevel: context.strictnessLevel,
    performanceSummary: context.performanceSummary,
    testSummary: context.testSummary,
    revisionSummary: context.revisionSummary,
    memory: context.memory,
  },
  null,
  2,
)}

Return this structure:
# Test Error Report
## Verdict
## Structured Scorecard
## Score And Attempt Quality
## Subject-Wise Damage
## Repeated Mistake Patterns
## Severity Ranking
## Recovery Or Repetition Signal
## Resource And Current Affairs Gaps
## Next 72 Hours Correction Plan
## What To Log In The Next Test`;

  const generated = await generateWithFallback(prompt);
  const report = await db.testAnalysisReport.create({
    data: {
      scope: "TEST",
      testRecordId: testId,
      title: `AI report: ${snapshot.test.title}`,
      reportText: generated.text,
      model: generated.model,
      highlightsJson: JSON.stringify([
        `${snapshot.analytics.accuracy}% logged accuracy`,
        `${snapshot.analytics.skipRate}% skip rate`,
        `${snapshot.analytics.resourceGapRate}% resource gap rate`,
      ]),
      weakAreasJson: JSON.stringify(snapshot.analytics.subjects.slice(0, 5)),
      recommendationsJson: JSON.stringify(snapshot.analytics.errorTypes.slice(0, 5)),
    },
  });

  return report;
}

export async function generateGlobalTestReport() {
  const [tests, context, memory] = await Promise.all([
    db.testRecord.findMany({
      orderBy: { testDate: "desc" },
      take: 40,
      include: {
        studyNode: { select: { title: true } },
        questionLogs: { orderBy: { questionNumber: "asc" } },
      },
    }),
    buildUPSCContext(),
    getErrorAnalysisMemory(),
  ]);

  const allQuestions = tests.flatMap((test) =>
    test.questionLogs.map((question) => ({
      ...question,
      testTitle: test.title,
      testDate: test.testDate.toISOString(),
      examStage: test.examStage,
      testType: test.testType,
      testSubject: test.studyNode?.title ?? null,
    })),
  );
  const analytics = buildQuestionAnalytics(allQuestions);

  const prompt = `You are generating an on-demand all-history UPSC test error-pattern audit.

Rules:
${reportGuardrails()}

All recent tests with question logs:
${JSON.stringify(
  tests.map((test) => ({
    title: test.title,
    testDate: test.testDate.toISOString(),
    examStage: test.examStage,
    testType: test.testType,
    score: test.score,
    totalMarks: test.totalMarks,
    totalQuestions: test.totalQuestions,
    subject: test.studyNode?.title ?? null,
    questionLogs: test.questionLogs,
  })),
  null,
  2,
)}

Computed cross-test analytics:
${JSON.stringify(analytics, null, 2)}

Deterministic pattern memory:
${JSON.stringify(memory, null, 2)}

Live preparation context:
${JSON.stringify(
  {
    strictnessLevel: context.strictnessLevel,
    papers: context.papers,
    performanceSummary: context.performanceSummary,
    testSummary: context.testSummary,
    revisionSummary: context.revisionSummary,
    executionSummary: context.executionSummary,
    memory: context.memory,
  },
  null,
  2,
)}

Return this structure:
# All-Test Error Pattern Audit
## Executive Verdict
## Structured Scorecard
## Repeated Subject And Topic Damage
## Same Mistake Pattern Loop
## Severity Ranking
## Recovery Versus Repetition
## Resource Coverage Diagnosis
## Current Affairs Diagnosis
## Attempt Strategy Diagnosis
## 30-Day Correction Protocol
## Quick Notes And Mnemonics
## Rules For The Next 5 Tests

In Recovery Versus Repetition, explicitly identify whether later tests show recovery from older mistakes or continued repetition. If repetition is visible, give compact quick notes, memory hooks, or mnemonics for the recurring weak areas. Do not create micro drills.`;

  const generated = await generateWithFallback(prompt);
  const report = await db.testAnalysisReport.create({
    data: {
      scope: "GLOBAL",
      title: "AI report: all test error patterns",
      reportText: generated.text,
      model: generated.model,
      highlightsJson: JSON.stringify([
        `${analytics.total} logged questions`,
        `${analytics.accuracy}% cross-test logged accuracy`,
        `${analytics.resourceGapRate}% resource gap rate`,
      ]),
      weakAreasJson: JSON.stringify(analytics.subjects.slice(0, 8)),
      recommendationsJson: JSON.stringify(analytics.errorTypes.slice(0, 8)),
    },
  });

  return report;
}
