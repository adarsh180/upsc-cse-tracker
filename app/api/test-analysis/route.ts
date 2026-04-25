import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  deleteQuestionLog,
  generateGlobalTestReport,
  generateSingleTestReport,
  getErrorAnalysisMemory,
  getTestAnalysisSnapshot,
  upsertQuestionLog,
} from "@/lib/test-analysis";

export const runtime = "nodejs";

async function requireApiSession() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const testId = searchParams.get("testId");

  if (searchParams.get("mode") === "memory") {
    return NextResponse.json(await getErrorAnalysisMemory());
  }

  if (searchParams.get("mode") === "tests") {
    const tests = await db.testRecord.findMany({
      orderBy: { testDate: "desc" },
      include: {
        studyNode: { select: { id: true, title: true } },
        _count: { select: { questionLogs: true } },
      },
    });

    return NextResponse.json({ tests });
  }

  if (!testId) {
    const reports = await db.testAnalysisReport.findMany({
      where: { scope: "GLOBAL" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    return NextResponse.json({ reports });
  }

  const snapshot = await getTestAnalysisSnapshot(testId);
  if (!snapshot) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

export async function POST(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as {
    action?: string;
    test?: unknown;
    question?: unknown;
    questionId?: string;
    testId?: string;
  };

  if (body.action === "create_test" || body.action === "update_test") {
    const test = body.test as Record<string, unknown>;
    const title = String(test.title ?? "").trim();
    const testId = String(test.id ?? "").trim();

    if (!title) {
      return NextResponse.json({ error: "Test name is required" }, { status: 400 });
    }

    const data = {
      studyNodeId: String(test.studyNodeId ?? "").trim() || null,
      title: title.slice(0, 180),
      examStage: String(test.examStage ?? "PRELIMS").trim() || "PRELIMS",
      testType: String(test.testType ?? "SECTIONAL").trim() || "SECTIONAL",
      testDate: new Date(String(test.testDate ?? new Date().toISOString())),
      totalQuestions: Number(test.totalQuestions ?? 0) || 0,
      totalMarks: Number(test.totalMarks ?? 0) || 0,
      score: Number(test.score ?? 0) || 0,
      correctQuestions: Number(test.correctQuestions ?? 0) || null,
      incorrectQuestions: Number(test.incorrectQuestions ?? 0) || null,
      attemptedQuestions: Number(test.attemptedQuestions ?? 0) || null,
      percentile: Number(test.percentile ?? 0) || null,
      timeMinutes: Number(test.timeMinutes ?? 0) || null,
      notes: String(test.notes ?? "").trim(),
    };

    const saved =
      body.action === "update_test" && testId
        ? await db.testRecord.update({ where: { id: testId }, data })
        : await db.testRecord.create({ data });

    revalidatePath("/tests");
    revalidatePath("/tests/error-analysis");
    return NextResponse.json(saved);
  }

  if (body.action === "delete_test") {
    if (!body.testId) {
      return NextResponse.json({ error: "testId is required" }, { status: 400 });
    }

    await db.testRecord.delete({ where: { id: body.testId } });
    revalidatePath("/tests");
    revalidatePath("/tests/error-analysis");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "upsert_question") {
    const question = body.question as Record<string, unknown>;
    const saved = await upsertQuestionLog({
      testRecordId: String(question.testRecordId ?? ""),
      questionNumber: Number(question.questionNumber ?? 1),
      questionSummary: String(question.questionSummary ?? ""),
      correctAnswer: question.correctAnswer ? String(question.correctAnswer) : null,
      correctExplanation: question.correctExplanation ? String(question.correctExplanation) : null,
      mainsApproach: question.mainsApproach ? String(question.mainsApproach) : null,
      mainsExamples: question.mainsExamples ? String(question.mainsExamples) : null,
      subject: question.subject ? String(question.subject) : null,
      topic: question.topic ? String(question.topic) : null,
      sourceType: question.sourceType ? String(question.sourceType) : null,
      outcome: question.outcome ? String(question.outcome) : null,
      studiedTopic: Boolean(question.studiedTopic),
      resourceCovered: question.resourceCovered ? String(question.resourceCovered) : null,
      currentAffairsLinked: Boolean(question.currentAffairsLinked),
      errorType: question.errorType ? String(question.errorType) : null,
      difficulty: question.difficulty ? String(question.difficulty) : null,
      confidence: question.confidence === null || question.confidence === undefined ? null : Number(question.confidence),
      timeSpentSeconds:
        question.timeSpentSeconds === null || question.timeSpentSeconds === undefined
          ? null
          : Number(question.timeSpentSeconds),
      mistakeReason: question.mistakeReason ? String(question.mistakeReason) : null,
      actionFix: question.actionFix ? String(question.actionFix) : null,
      notes: question.notes ? String(question.notes) : null,
    });

    revalidatePath("/tests");
    revalidatePath("/tests/error-analysis");
    revalidatePath("/performance");
    return NextResponse.json(saved);
  }

  if (body.action === "delete_question") {
    if (!body.questionId) {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }

    const result = await deleteQuestionLog(body.questionId);
    revalidatePath("/tests");
    revalidatePath("/tests/error-analysis");
    return NextResponse.json(result);
  }

  if (body.action === "generate_test_report") {
    if (!body.testId) {
      return NextResponse.json({ error: "testId is required" }, { status: 400 });
    }

    const report = await generateSingleTestReport(body.testId);
    revalidatePath("/tests");
    return NextResponse.json(report);
  }

  if (body.action === "generate_global_report") {
    const report = await generateGlobalTestReport();
    revalidatePath("/tests");
    revalidatePath("/ai-insight");
    return NextResponse.json(report);
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
