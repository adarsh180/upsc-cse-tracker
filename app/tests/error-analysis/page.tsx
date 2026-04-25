import { TestErrorAnalysisWorkspace } from "@/components/ui/test-error-analysis";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function TestErrorAnalysisPage() {
  await requireSession();

  const [tests, subjects] = await Promise.all([
    db.testRecord.findMany({
      orderBy: { testDate: "desc" },
      include: {
        studyNode: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            questionLogs: true,
          },
        },
      },
    }),
    db.studyNode.findMany({
      where: { type: "SUBJECT" },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        children: {
          where: { type: "MODULE" },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
  ]);

  return (
    <main className="page-shell tests-page">
      <TestErrorAnalysisWorkspace
        tests={tests.map((test) => ({
          id: test.id,
          title: test.title,
          examStage: test.examStage,
          testType: test.testType,
          testDate: test.testDate,
          totalQuestions: test.totalQuestions,
          totalMarks: test.totalMarks,
          score: test.score,
          correctQuestions: test.correctQuestions,
          incorrectQuestions: test.incorrectQuestions,
          attemptedQuestions: test.attemptedQuestions,
          percentile: test.percentile,
          timeMinutes: test.timeMinutes,
          notes: test.notes,
          studyNode: test.studyNode,
          _count: test._count,
        }))}
        subjects={subjects}
      />
    </main>
  );
}
