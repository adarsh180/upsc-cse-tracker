import { db } from "@/lib/db";
import { ensureSeeded, percent } from "@/lib/seed";

type ComponentScore = {
  label: string;
  value: number;
  weight: number;
};

export type PrepConfidencePayload = {
  exam: "UPSC CSE 2027";
  score: number;
  label: string;
  reliability: number;
  updatedAt: string;
  source: "live-database";
  formulaVersion: "upsc-confidence-v1";
  components: ComponentScore[];
  signals: string[];
};

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

function labelFor(score: number) {
  if (score >= 84) return "interview-grade trajectory";
  if (score >= 70) return "high-confidence attempt";
  if (score >= 55) return "competitive but volatile";
  if (score >= 38) return "foundation under construction";
  return "needs evidence";
}

export async function getUPSCPrepConfidence(): Promise<PrepConfidencePayload> {
  await ensureSeeded();

  const now = new Date();
  const fourteenAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [nodes, studyLogs, dailyLogs, tests, moods] = await Promise.all([
    db.studyNode.findMany({
      select: {
        id: true,
        parentId: true,
        topicProgress: {
          select: { checked: true },
        },
      },
    }),
    db.studyLog.findMany({
      orderBy: { logDate: "desc" },
      take: 30,
    }),
    db.dailyLog.findMany({
      orderBy: { logDate: "desc" },
      take: 30,
    }),
    db.testRecord.findMany({
      orderBy: { testDate: "desc" },
      take: 20,
    }),
    db.moodEntry.findMany({
      orderBy: { moodDate: "desc" },
      take: 14,
    }),
  ]);

  const childrenByParent = new Map<string, typeof nodes>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const leaves = nodes.filter((node) => (childrenByParent.get(node.id) ?? []).length === 0);
  const completedLeaves = leaves.filter((leaf) => leaf.topicProgress?.checked).length;
  const syllabusScore = leaves.length ? (completedLeaves / leaves.length) * 100 : 0;

  const totalHoursLast30 = studyLogs.reduce((sum, log) => sum + log.hours, 0);
  const activeDays14 = new Set(
    [...studyLogs.map((log) => log.logDate), ...dailyLogs.map((log) => log.logDate)]
      .filter((date) => date >= fourteenAgo)
      .map((date) => date.toISOString().slice(0, 10)),
  ).size;

  const avgDiscipline = average(dailyLogs.map((log) => log.disciplineScore));
  const avgDailyCompletion = average(dailyLogs.map((log) => log.completion));
  const avgFocus = average(moods.map((mood) => mood.focus)) * 10;

  const prelimsTests = tests.filter((test) => test.examStage === "PRELIMS");
  const mainsTests = tests.filter((test) => test.examStage === "MAINS");
  const allTestScore = average(tests.map((test) => percent(test.score, test.totalMarks)));
  const prelimsRaw = average(prelimsTests.map((test) => percent(test.score, test.totalMarks))) || allTestScore;
  const mainsRaw = average(mainsTests.map((test) => percent(test.score, test.totalMarks))) || allTestScore;
  const prelimsReliability = prelimsTests.length / (prelimsTests.length + 4);
  const mainsReliability = mainsTests.length / (mainsTests.length + 4);
  const prelimsScore = prelimsRaw * prelimsReliability + syllabusScore * (1 - prelimsReliability);
  const mainsScore = mainsRaw * mainsReliability + avgDailyCompletion * (1 - mainsReliability);

  const hoursScore = Math.min(totalHoursLast30 / 120, 1) * 100;
  const consistencyScore = Math.min(activeDays14 / 10, 1) * 55 + avgDiscipline * 0.3 + avgFocus * 0.15;
  const testVolumeScore = Math.min(tests.length / 20, 1) * 100;

  const components: ComponentScore[] = [
    { label: "Syllabus leaf completion", value: clampPct(syllabusScore), weight: 0.26 },
    { label: "Prelims test signal, shrinkage-adjusted", value: clampPct(prelimsScore), weight: 0.22 },
    { label: "Mains execution signal, shrinkage-adjusted", value: clampPct(mainsScore), weight: 0.18 },
    { label: "Discipline and focus consistency", value: clampPct(consistencyScore), weight: 0.16 },
    { label: "30-log study-hour load", value: clampPct(hoursScore), weight: 0.1 },
    { label: "Recorded test volume", value: clampPct(testVolumeScore), weight: 0.08 },
  ];

  const score = clampPct(components.reduce((sum, item) => sum + item.value * item.weight, 0));
  const reliability = clampPct(
    32 +
      Math.min(leaves.length / 350, 1) * 14 +
      Math.min(completedLeaves / 120, 1) * 12 +
      Math.min(tests.length / 12, 1) * 20 +
      Math.min(studyLogs.length / 20, 1) * 12 +
      Math.min(dailyLogs.length / 14, 1) * 10,
  );

  return {
    exam: "UPSC CSE 2027",
    score,
    label: labelFor(score),
    reliability,
    updatedAt: now.toISOString(),
    source: "live-database",
    formulaVersion: "upsc-confidence-v1",
    components,
    signals: [
      `${completedLeaves}/${leaves.length || 0} syllabus leaves completed`,
      `${prelimsRaw.toFixed(1)}% prelims and ${mainsRaw.toFixed(1)}% mains test signal`,
      `${totalHoursLast30.toFixed(1)}h across last 30 study logs`,
      `${Math.round(avgDiscipline)}/100 discipline, ${Math.round(avgFocus)}/100 focus`,
    ],
  };
}
