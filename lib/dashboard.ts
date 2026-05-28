import { syllabusTree } from "@/data/syllabus";
import { db } from "@/lib/db";
import { isRetryableDbError, withDbRetry } from "@/lib/db-retry";
import { ensureSeeded, percent } from "@/lib/seed";

type PaperWithChildren = {
  id: string;
  slug?: string;
  title?: string;
  overview?: string | null;
  accent?: string | null;
  children: Array<{ id: string }>;
};

type CompletionNode = {
  id: string;
  parentId: string | null;
  topicProgress: { checked: boolean } | null;
};

function getStaticPapers() {
  return syllabusTree.map((node, index) => ({
    id: node.slug,
    title: node.title,
    slug: node.slug,
    type: node.type.toUpperCase(),
    overview: node.overview,
    details: node.details ?? null,
    accent: node.accent ?? null,
    parentId: null,
    sortOrder: index,
    children: (node.children ?? []).map((child, childIndex) => ({
      id: child.slug,
      title: child.title,
      slug: child.slug,
      type: child.type.toUpperCase(),
      overview: child.overview,
      details: child.details ?? null,
      accent: child.accent ?? null,
      parentId: node.slug,
      sortOrder: childIndex,
    })),
  }));
}

function emptyMetrics() {
  return [
    {
      label: "Tracked study hours",
      value: "0.0h",
      hint: "Last 30 study entries",
    },
    {
      label: "Average test score",
      value: "0%",
      hint: "Log your first test",
    },
    {
      label: "Discipline pulse",
      value: "0/100",
      hint: "Last 30 daily goal logs",
    },
    {
      label: "Focus trend",
      value: "0/10",
      hint: "Last 14 mood entries",
    },
  ];
}

export async function getPaperCompletionMap(papers: PaperWithChildren[]) {
  const rootIds = papers.map((paper) => paper.id);
  const completionMap: Record<string, number> = Object.fromEntries(
    papers.map((paper) => [paper.id, 0]),
  );

  if (rootIds.length === 0) {
    return completionMap;
  }

  let nodes: CompletionNode[];

  try {
    nodes = await withDbRetry(() =>
      db.studyNode.findMany({
        select: {
          id: true,
          parentId: true,
          topicProgress: {
            select: {
              checked: true,
            },
          },
        },
      }),
    );
  } catch (error) {
    if (!isRetryableDbError(error)) {
      throw error;
    }

    console.error("[paper-completion-map]", error);
    return completionMap;
  }

  const childrenByParent = new Map<string, typeof nodes>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  function collectLeafNodes(rootId: string) {
    const leaves: typeof nodes = [];
    const queue = [...(childrenByParent.get(rootId) ?? [])];

    while (queue.length) {
      const current = queue.shift()!;
      const children = childrenByParent.get(current.id) ?? [];

      if (children.length === 0) {
        leaves.push(current);
        continue;
      }

      queue.push(...children);
    }

    return leaves;
  }

  for (const paper of papers) {
    const leaves = collectLeafNodes(paper.id);
    completionMap[paper.id] = leaves.length
      ? Math.round((leaves.filter((leaf) => leaf.topicProgress?.checked).length / leaves.length) * 100)
      : 0;
  }

  return completionMap;
}

export async function getStudyTree() {
  await ensureSeeded();

  return withDbRetry(() =>
    db.studyNode.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: {
        children: {
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
  );
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
              children: {
                orderBy: { sortOrder: "asc" },
                include: {
                  topicProgress: true,
                },
              },
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
  let papers;
  let studyLogs;
  let dailyLogs;
  let tests;
  let moods;
  let latestEssay;

  try {
    await ensureSeeded();

    [papers, studyLogs, dailyLogs, tests, moods, latestEssay] = await withDbRetry(() =>
      Promise.all([
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
      ]),
    );
  } catch (error) {
    if (!isRetryableDbError(error)) {
      throw error;
    }

    console.error("[dashboard-summary]", error);

    return {
      papers: getStaticPapers(),
      studyLogs: [],
      dailyLogs: [],
      tests: [],
      moods: [],
      latestEssay: null,
      metrics: emptyMetrics(),
    };
  }

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
  try {
    await ensureSeeded();

    const [tests, moods, dailyLogs, studyLogs] = await withDbRetry(() =>
      Promise.all([
        db.testRecord.findMany({
          orderBy: { testDate: "asc" },
          select: { id: true, testDate: true, score: true, totalMarks: true },
        }),
        db.moodEntry.findMany({
          orderBy: { moodDate: "asc" },
          select: { id: true, moodDate: true, focus: true, stress: true },
        }),
        db.dailyLog.findMany({
          orderBy: { logDate: "asc" },
          select: { id: true, logDate: true, disciplineScore: true, completion: true },
        }),
        db.studyLog.findMany({
          orderBy: { logDate: "asc" },
          select: {
            id: true,
            logDate: true,
            hours: true,
            studyNode: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        }),
      ]),
    );

    return {
      tests,
      moods,
      dailyLogs,
      studyLogs,
    };
  } catch (error) {
    if (!isRetryableDbError(error)) {
      throw error;
    }

    console.error("[performance-summary]", error);

    return {
      tests: [],
      moods: [],
      dailyLogs: [],
      studyLogs: [],
    };
  }
}
