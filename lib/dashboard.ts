import { db } from "@/lib/db";
import { ensureSeeded, percent } from "@/lib/seed";

export async function getStudyTree() {
  await ensureSeeded();

  return db.studyNode.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      children: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export async function getStudyNodeBySlug(slug: string) {
  await ensureSeeded();

  return db.studyNode.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: {
        orderBy: { sortOrder: "asc" },
        include: {
          topicProgress: true,
          children: {
            orderBy: { sortOrder: "asc" },
            include: {
              topicProgress: true,
            },
          },
        },
      },
      studyLogs: {
        orderBy: { logDate: "desc" },
        take: 10,
      },
      testRecords: {
        orderBy: { testDate: "desc" },
        take: 10,
      },
    },
  });
}


export async function getDashboardSummary() {
  await ensureSeeded();

  const [papers, studyLogs, dailyLogs, tests, moods, latestEssay] = await Promise.all([
    db.studyNode.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { children: true },
    }),
    db.studyLog.findMany({
      orderBy: { logDate: "desc" },
      take: 30,
      include: { studyNode: true },
    }),
    db.dailyLog.findMany({
      orderBy: { logDate: "desc" },
      take: 30,
    }),
    db.testRecord.findMany({
      orderBy: { testDate: "desc" },
      take: 20,
      include: { studyNode: true },
    }),
    db.moodEntry.findMany({
      orderBy: { moodDate: "desc" },
      take: 14,
    }),
    db.essaySubmission.findFirst({
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const totalHours = studyLogs.reduce((sum, item) => sum + item.hours, 0);
  const totalTests = tests.length;
  const avgScore = totalTests
    ? Number((tests.reduce((sum, test) => sum + percent(test.score, test.totalMarks), 0) / totalTests).toFixed(1))
    : 0;
  const avgDiscipline = dailyLogs.length
    ? Number((dailyLogs.reduce((sum, day) => sum + day.disciplineScore, 0) / dailyLogs.length).toFixed(1))
    : 0;
  const avgMoodFocus = moods.length
    ? Number((moods.reduce((sum, mood) => sum + mood.focus, 0) / moods.length).toFixed(1))
    : 0;

  return {
    papers,
    studyLogs,
    dailyLogs,
    tests,
    moods,
    latestEssay,
    metrics: [
      {
        label: "Tracked study hours",
        value: `${totalHours.toFixed(1)}h`,
        hint: "Last 30 study entries",
      },
      {
        label: "Average test score",
        value: `${avgScore}%`,
        hint: totalTests ? "Based on recorded tests" : "Log your first test",
      },
      {
        label: "Discipline pulse",
        value: `${avgDiscipline}/100`,
        hint: "Last 30 daily goal logs",
      },
      {
        label: "Focus trend",
        value: `${avgMoodFocus}/10`,
        hint: "Last 14 mood entries",
      },
    ],
  };
}

export async function getPerformanceSummary() {
  await ensureSeeded();

  const [tests, moods, dailyLogs, studyLogs] = await Promise.all([
    db.testRecord.findMany({ orderBy: { testDate: "asc" } }),
    db.moodEntry.findMany({ orderBy: { moodDate: "asc" } }),
    db.dailyLog.findMany({ orderBy: { logDate: "asc" } }),
    db.studyLog.findMany({
      orderBy: { logDate: "asc" },
      include: { studyNode: true },
    }),
  ]);

  return {
    tests,
    moods,
    dailyLogs,
    studyLogs,
  };
}
