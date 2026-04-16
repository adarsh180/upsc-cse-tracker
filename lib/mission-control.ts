import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { endOfDay, format, startOfDay } from "date-fns";

import { buildUPSCContext } from "@/lib/ai-context-builder";
import { normalizeGoogleModelId } from "@/lib/ai-models";
import { db } from "@/lib/db";

const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    "",
});

type MissionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type MissionTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED";
const TASK_STALE_MS = 24 * 60 * 60 * 1000;
const AUTO_SKIP_NOTE = "Auto-skipped after 24 hours without a task-status update.";

type MissionPlannerResult = {
  title: string;
  summary: string;
  executionWindow: string;
  urgency: MissionPriority;
  whyNow: string[];
  plannerNotes: string;
  risks: string[];
  followUps: string[];
  todayPlan: {
    primaryOutcome: string;
    hoursTarget: number;
    checkpointStrategy: string;
    shutdownRule: string;
  };
  recommendedDailyLog: {
    logDate: string;
    primaryFocus: string;
    totalHours: number;
    questionsSolved: number;
    topicsStudied: number;
    completion: number;
    disciplineScore: number;
    tomorrowPlan: string;
  };
  tasks: Array<{
    title: string;
    detail: string;
    rationale: string;
    taskType: "REVISION" | "PRACTICE" | "TEST" | "ESSAY" | "RECOVERY" | "ANALYSIS" | "PLANNING";
    priority: MissionPriority;
    energyBand: "DEEP" | "MEDIUM" | "LIGHT";
    dueLabel: string;
    estimatedMinutes: number;
    linkedStudySlug: string | null;
    checklist: string[];
  }>;
};

export type MissionTaskView = {
  id: string;
  title: string;
  detail: string | null;
  rationale: string | null;
  taskType: string;
  status: MissionTaskStatus;
  priority: MissionPriority;
  energyBand: string | null;
  dueLabel: string | null;
  estimatedMinutes: number | null;
  orderIndex: number;
  checklist: string[];
  linkedStudyNode: { id: string; slug: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type MissionView = {
  id: string;
  title: string;
  goal: string | null;
  mode: string;
  status: string;
  summary: string | null;
  executionWindow: string | null;
  urgency: string | null;
  plannerNotes: string | null;
  risks: string[];
  followUps: string[];
  whyNow: string[];
  todayPlan: {
    primaryOutcome: string;
    hoursTarget: number;
    checkpointStrategy: string;
    shutdownRule: string;
  } | null;
  dailyLogDraft: {
    logDate: string;
    primaryFocus: string;
    totalHours: number;
    questionsSolved: number;
    topicsStudied: number;
    completion: number;
    disciplineScore: number;
    tomorrowPlan: string;
  } | null;
  model: string | null;
  launchedAt: string;
  lastActivatedAt: string | null;
  appliedAt: string | null;
  completedAt: string | null;
  tasks: MissionTaskView[];
};

export type TodoTaskItem = {
  id: string;
  title: string;
  detail: string | null;
  rationale: string | null;
  taskType: string;
  status: string;
  priority: string;
  energyBand: string | null;
  dueLabel: string | null;
  estimatedMinutes: number | null;
  checklist: string[];
  mission: {
    id: string;
    title: string;
    urgency: string | null;
    launchedAt: string;
  };
  linkedStudyNode: { id: string; slug: string; title: string } | null;
  updatedAt: string;
};

function parseJsonArray(value: string | null | undefined) {
  if (!value) return [] as string[];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: string | null | undefined): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function cleanJsonBlock(raw: string) {
  const trimmed = raw.trim();
  const withoutFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFences.slice(firstBrace, lastBrace + 1);
  }

  return withoutFences;
}

async function generateWithFallback(prompt: string) {
  const candidates = [
    process.env.GOOGLE_AI_MODEL_MISSION,
    "gemma-4-31b-it",
    "gemma-4-26b-it",
    "gemma-3-27b-it",
    process.env.GOOGLE_AI_MODEL_ANALYTICS,
    process.env.GOOGLE_AI_MODEL_FALLBACK,
    process.env.GOOGLE_AI_MODEL_SECOND_FALLBACK,
    process.env.GOOGLE_AI_MODEL_PRIMARY,
    "gemma-3-12b-it",
  ].filter(Boolean) as string[];

  const uniqueCandidates = [...new Set(candidates)];

  let lastError: unknown;

  for (const candidate of uniqueCandidates) {
    try {
      const model = normalizeGoogleModelId(candidate);
      const result = await generateText({
        model: google(model),
        prompt,
        temperature: 0.4,
        maxOutputTokens: 2200,
      });

      return {
        text: result.text,
        model,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No AI model could generate a mission plan.");
}

function serializeMission(mission: {
  id: string;
  title: string;
  goal: string | null;
  mode: string;
  status: string;
  summary: string | null;
  executionWindow: string | null;
  urgency: string | null;
  plannerNotes: string | null;
  risksJson: string | null;
  followUpsJson: string | null;
  whyNowJson: string | null;
  todayPlanJson: string | null;
  dailyLogDraftJson: string | null;
  model: string | null;
  launchedAt: Date;
  lastActivatedAt: Date | null;
  appliedAt: Date | null;
  completedAt: Date | null;
  tasks: Array<{
    id: string;
    title: string;
    detail: string | null;
    rationale: string | null;
    taskType: string;
    status: string;
    priority: string;
    energyBand: string | null;
    dueLabel: string | null;
    estimatedMinutes: number | null;
    orderIndex: number;
    checklistJson: string | null;
    createdAt: Date;
    updatedAt: Date;
    linkedStudyNode: { id: string; slug: string; title: string } | null;
  }>;
}): MissionView {
  return {
    id: mission.id,
    title: mission.title,
    goal: mission.goal,
    mode: mission.mode,
    status: mission.status,
    summary: mission.summary,
    executionWindow: mission.executionWindow,
    urgency: mission.urgency,
    plannerNotes: mission.plannerNotes,
    risks: parseJsonArray(mission.risksJson),
    followUps: parseJsonArray(mission.followUpsJson),
    whyNow: parseJsonArray(mission.whyNowJson),
    todayPlan: parseJsonObject<MissionView["todayPlan"]>(mission.todayPlanJson),
    dailyLogDraft: parseJsonObject<MissionView["dailyLogDraft"]>(mission.dailyLogDraftJson),
    model: mission.model,
    launchedAt: mission.launchedAt.toISOString(),
    lastActivatedAt: mission.lastActivatedAt?.toISOString() ?? null,
    appliedAt: mission.appliedAt?.toISOString() ?? null,
    completedAt: mission.completedAt?.toISOString() ?? null,
    tasks: mission.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      detail: task.detail,
      rationale: task.rationale,
      taskType: task.taskType,
      status: task.status as MissionTaskStatus,
      priority: task.priority as MissionPriority,
      energyBand: task.energyBand,
      dueLabel: task.dueLabel,
      estimatedMinutes: task.estimatedMinutes,
      orderIndex: task.orderIndex,
      checklist: parseJsonArray(task.checklistJson),
      linkedStudyNode: task.linkedStudyNode,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
  };
}

function serializeTodoTask(task: {
  id: string;
  title: string;
  detail: string | null;
  rationale: string | null;
  taskType: string;
  status: string;
  priority: string;
  energyBand: string | null;
  dueLabel: string | null;
  estimatedMinutes: number | null;
  checklistJson: string | null;
  completionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  mission: {
    id: string;
    title: string;
    urgency: string | null;
    launchedAt: Date;
  };
  linkedStudyNode: { id: string; slug: string; title: string } | null;
}): TodoTaskItem {
  return {
    id: task.id,
    title: task.title,
    detail: task.detail,
    rationale: task.rationale,
    taskType: task.taskType,
    status: task.status,
    priority: task.priority,
    energyBand: task.energyBand,
    dueLabel: task.dueLabel,
    estimatedMinutes: task.estimatedMinutes,
    checklist: parseJsonArray(task.checklistJson),
    mission: {
      id: task.mission.id,
      title: task.mission.title,
      urgency: task.mission.urgency,
      launchedAt: task.mission.launchedAt.toISOString(),
    },
    linkedStudyNode: task.linkedStudyNode,
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function fetchMissionRecord(id: string) {
  const mission = await db.agentMission.findUnique({
    where: { id },
    include: {
      tasks: {
        orderBy: [{ status: "asc" }, { orderIndex: "asc" }, { createdAt: "asc" }],
        include: {
          linkedStudyNode: {
            select: { id: true, slug: true, title: true },
          },
        },
      },
    },
  });

  return mission ? serializeMission(mission) : null;
}

async function syncMissionStatus(missionId: string) {
  const missionTasks = await db.agentTask.findMany({
    where: { missionId },
    select: { status: true },
  });

  if (!missionTasks.length) {
    return;
  }

  const allDone = missionTasks.every((item) => item.status === "DONE");
  const hasInProgress = missionTasks.some((item) => item.status === "IN_PROGRESS");
  const hasTodo = missionTasks.some((item) => item.status === "TODO");
  const allTerminal = missionTasks.every((item) => item.status === "DONE" || item.status === "SKIPPED");

  await db.agentMission.update({
    where: { id: missionId },
    data: {
      status: allDone
        ? "COMPLETED"
        : hasInProgress
          ? "ACTIVE"
          : hasTodo
            ? "READY"
            : allTerminal
              ? "APPLIED"
              : "READY",
      completedAt: allDone ? new Date() : null,
      lastActivatedAt: new Date(),
    },
  });
}

async function reconcileStaleAgentTasks(now = new Date()) {
  const staleBefore = new Date(now.getTime() - TASK_STALE_MS);
  const staleTasks = await db.agentTask.findMany({
    where: {
      status: { in: ["TODO", "IN_PROGRESS"] },
      updatedAt: { lt: staleBefore },
    },
    select: {
      id: true,
      missionId: true,
    },
  });

  if (!staleTasks.length) {
    return;
  }

  await db.$transaction(
    staleTasks.map((task) =>
      db.agentTask.update({
        where: { id: task.id },
        data: {
          status: "SKIPPED",
          completionNotes: AUTO_SKIP_NOTE,
        },
      }),
    ),
  );

  await Promise.all(
    [...new Set(staleTasks.map((task) => task.missionId))].map((missionId) =>
      syncMissionStatus(missionId),
    ),
  );
}

function isBoardVisibleTask(task: {
  status: string;
  completionNotes: string | null;
  updatedAt: Date;
}) {
  if (task.completionNotes === AUTO_SKIP_NOTE) {
    return false;
  }

  return task.updatedAt.getTime() >= Date.now() - TASK_STALE_MS;
}

export async function getMissionControlSnapshot() {
  await reconcileStaleAgentTasks();

  const [missions, openTasks, completedToday, studyNodes] = await Promise.all([
    db.agentMission.findMany({
      where: { status: { not: "HIDDEN" } },
      orderBy: { launchedAt: "desc" },
      take: 8,
      include: {
        tasks: {
          orderBy: [{ status: "asc" }, { orderIndex: "asc" }, { createdAt: "asc" }],
          include: {
            linkedStudyNode: {
              select: { id: true, slug: true, title: true },
            },
          },
        },
      },
    }),
    db.agentTask.findMany({
      where: { status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: {
        linkedStudyNode: {
          select: { id: true, slug: true, title: true },
        },
        mission: {
          select: {
            id: true,
            title: true,
            urgency: true,
          },
        },
      },
      take: 24,
    }),
    db.agentTask.count({
      where: {
        status: "DONE",
        updatedAt: {
          gte: startOfDay(new Date()),
          lte: endOfDay(new Date()),
        },
      },
    }),
    db.studyNode.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
      },
    }),
  ]);

  return {
    missions: missions.map(serializeMission),
    activeMission: missions[0] ? serializeMission(missions[0]) : null,
    backlog: openTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      taskType: task.taskType,
      mission: task.mission,
      linkedStudyNode: task.linkedStudyNode,
      estimatedMinutes: task.estimatedMinutes,
      dueLabel: task.dueLabel,
    })),
    stats: {
      totalMissions: missions.length,
      openTasks: openTasks.length,
      completedToday,
      trackedAreas: studyNodes.length,
    },
    studyAreas: studyNodes,
  };
}

export async function getTodoBoardSnapshot() {
  await reconcileStaleAgentTasks();

  const [tasks, missions, studyAreas] = await Promise.all([
    db.agentTask.findMany({
      orderBy: [{ status: "asc" }, { priority: "desc" }, { orderIndex: "asc" }, { createdAt: "asc" }],
      include: {
        linkedStudyNode: {
          select: { id: true, slug: true, title: true },
        },
        mission: {
          select: {
            id: true,
            title: true,
            urgency: true,
            launchedAt: true,
          },
        },
      },
      take: 120,
    }),
    db.agentMission.findMany({
      where: { status: { not: "HIDDEN" } },
      orderBy: { launchedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        urgency: true,
        launchedAt: true,
      },
      take: 20,
    }),
    db.studyNode.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
      },
    }),
  ]);

  return {
    tasks: tasks.filter(isBoardVisibleTask).map(serializeTodoTask),
    missions: missions.map((mission) => ({
      ...mission,
      launchedAt: mission.launchedAt.toISOString(),
    })),
    studyAreas,
    stats: {
      total: tasks.filter(isBoardVisibleTask).length,
      todo: tasks.filter((task) => isBoardVisibleTask(task) && task.status === "TODO").length,
      inProgress: tasks.filter((task) => isBoardVisibleTask(task) && task.status === "IN_PROGRESS").length,
      done: tasks.filter((task) => isBoardVisibleTask(task) && task.status === "DONE").length,
    },
  };
}

async function getOrCreateManualMission() {
  const existing = await db.agentMission.findFirst({
    where: {
      mode: "MANUAL",
      title: "Manual Todo Inbox",
    },
  });

  if (existing) return existing;

  return db.agentMission.create({
    data: {
      title: "Manual Todo Inbox",
      mode: "MANUAL",
      status: "ACTIVE",
      summary: "Manual tasks added directly from the Todo workspace.",
      urgency: "MEDIUM",
      executionWindow: "Rolling",
      plannerNotes: "User-managed execution queue.",
      lastActivatedAt: new Date(),
    },
  });
}

export async function createManualTodoTask(input: {
  title: string;
  detail?: string;
  taskType?: string;
  priority?: string;
  energyBand?: string;
  estimatedMinutes?: number | null;
  dueLabel?: string;
  linkedStudyNodeId?: string | null;
}) {
  const manualMission = await getOrCreateManualMission();

  const lastTask = await db.agentTask.findFirst({
    where: { missionId: manualMission.id },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const task = await db.agentTask.create({
    data: {
      missionId: manualMission.id,
      title: input.title,
      detail: input.detail?.trim() || null,
      rationale: "Added manually from the Todo workspace.",
      taskType: input.taskType ?? "PLANNING",
      priority: input.priority ?? "MEDIUM",
      energyBand: input.energyBand ?? "MEDIUM",
      dueLabel: input.dueLabel?.trim() || "This week",
      estimatedMinutes: input.estimatedMinutes ?? null,
      linkedStudyNodeId: input.linkedStudyNodeId || null,
      source: "MANUAL",
      orderIndex: (lastTask?.orderIndex ?? -1) + 1,
      checklistJson: JSON.stringify([]),
    },
    include: {
      mission: {
        select: {
          id: true,
          title: true,
          urgency: true,
          launchedAt: true,
        },
      },
      linkedStudyNode: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
    },
  });

  return serializeTodoTask(task);
}

export async function createAgentMission(goal: string) {
  await reconcileStaleAgentTasks();

  const [context, existingTasks, studyNodes] = await Promise.all([
    buildUPSCContext(),
    db.agentTask.findMany({
      where: { status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: { createdAt: "asc" },
      take: 20,
      include: {
        linkedStudyNode: {
          select: { slug: true, title: true },
        },
      },
    }),
    db.studyNode.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, slug: true, title: true, parentId: true },
      take: 200,
    }),
  ]);

  const missionContext = {
    student: context.student,
    daysToPrelimsDate: context.daysToPrelimsDate,
    daysToMainsDate: context.daysToMainsDate,
    strictnessLevel: context.strictnessLevel,
    papers: context.papers.map((paper) => ({
      title: paper.title,
      slug: paper.slug,
      completionPct: paper.completionPct,
      totalHours: paper.totalHours,
      recentTopics: paper.recentTopics.slice(0, 3),
    })),
    performanceSummary: context.performanceSummary,
    testSummary: context.testSummary,
    moodSummary: context.moodSummary,
    executionSummary: context.executionSummary,
    revisionSummary: {
      totalRevisions: context.revisionSummary.totalRevisions,
      totalTopicsTracked: context.revisionSummary.totalTopicsTracked,
      avgRevisionPerTopic: context.revisionSummary.avgRevisionPerTopic,
      unrevisedTopics: context.revisionSummary.unrevisedTopics,
      wellRevisedTopics: context.revisionSummary.wellRevisedTopics,
      topRevised: context.revisionSummary.topRevised.slice(0, 4),
      leastRevised: context.revisionSummary.leastRevised.slice(0, 4),
    },
    latestEssay: context.latestEssay,
    recentTests: context.recentTests.slice(0, 8),
    recentDailyLogs: context.recentDailyLogs.slice(0, 7),
    recentMoodEntries: context.recentMoodEntries.slice(0, 7),
    memory: {
      recurringStrengths: context.memory.recurringStrengths,
      recurringWeaknesses: context.memory.recurringWeaknesses,
      behavioralPatterns: context.memory.behavioralPatterns,
      mentorPriorities: context.memory.mentorPriorities,
      recentConversationThemes: context.memory.recentConversationThemes,
    },
  };

  const prompt = `You are UPSC Mission Control, an execution-planning agent for Adarsh Tiwari's UPSC CSE 2027 attempt.
Your job is not to chat. Your job is to produce a sharp, usable mission brief and a realistic todo list from live preparation data.

Rules:
1. This mission only runs because the user explicitly launched it. Never imply automatic background monitoring.
2. Prefer execution over theory. Produce tasks that can be completed inside the tracker.
3. Avoid duplicating existing open tasks unless they are still strategically necessary.
4. Use exact study slugs when you can map work to a known study area.
5. Keep the mission hard but realistic for the next 24 to 72 hours.
6. Return only valid JSON.

Student goal for this launch:
${goal || "Build the highest-leverage UPSC mission from live data."}

Live UPSC context:
${JSON.stringify(missionContext, null, 2)}

Existing open tasks:
${JSON.stringify(
    existingTasks.map((task) => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      taskType: task.taskType,
      linkedStudySlug: task.linkedStudyNode?.slug ?? null,
    })),
    null,
    2,
  )}

Available study slugs:
${JSON.stringify(
    studyNodes.map((node) => ({
      slug: node.slug,
      title: node.title,
      parentId: node.parentId,
    })),
    null,
    2,
  )}

Return only this JSON shape:
{
  "title": "short mission title",
  "summary": "3-4 sentence brutally clear mission summary",
  "executionWindow": "24 hours",
  "urgency": "HIGH",
  "whyNow": ["reason 1", "reason 2", "reason 3"],
  "plannerNotes": "one tactical paragraph",
  "risks": ["risk 1", "risk 2"],
  "followUps": ["follow up 1", "follow up 2"],
  "todayPlan": {
    "primaryOutcome": "what must be true by tonight",
    "hoursTarget": 8,
    "checkpointStrategy": "how to review progress midday",
    "shutdownRule": "when to stop and what to log"
  },
  "recommendedDailyLog": {
    "logDate": "${format(new Date(), "yyyy-MM-dd")}",
    "primaryFocus": "tracker-ready focus line",
    "totalHours": 8,
    "questionsSolved": 50,
    "topicsStudied": 4,
    "completion": 82,
    "disciplineScore": 84,
    "tomorrowPlan": "tomorrow plan line"
  },
  "tasks": [
    {
      "title": "task title",
      "detail": "precise execution note",
      "rationale": "why this matters right now",
      "taskType": "REVISION",
      "priority": "HIGH",
      "energyBand": "DEEP",
      "dueLabel": "Today",
      "estimatedMinutes": 90,
      "linkedStudySlug": "general-studies-2",
      "checklist": ["step 1", "step 2", "step 3"]
    }
  ]
}

Task rules:
- Produce between 5 and 9 tasks.
- Use only these taskType values: REVISION, PRACTICE, TEST, ESSAY, RECOVERY, ANALYSIS, PLANNING.
- Use only these priority values: LOW, MEDIUM, HIGH, CRITICAL.
- Use only these energyBand values: LIGHT, MEDIUM, DEEP.
- At least one task must be a test-analysis or practice task if data shows weak scores.
- At least one task must be a revision task linked to a study slug when possible.
- Keep estimatedMinutes between 20 and 180.
- Do not create impossible plans like 14 productive hours in one day.`;

  const generated = await generateWithFallback(prompt);
  const parsed = JSON.parse(cleanJsonBlock(generated.text)) as MissionPlannerResult;

  const slugs = new Map(studyNodes.map((node) => [node.slug, node.id]));

  const mission = await db.agentMission.create({
    data: {
      title: parsed.title.slice(0, 120) || "Mission Control Brief",
      goal: goal.trim() || null,
      mode: "MISSION_CONTROL",
      status: "READY",
      summary: parsed.summary,
      executionWindow: parsed.executionWindow,
      urgency: parsed.urgency,
      plannerNotes: parsed.plannerNotes,
      risksJson: JSON.stringify(parsed.risks ?? []),
      followUpsJson: JSON.stringify(parsed.followUps ?? []),
      whyNowJson: JSON.stringify(parsed.whyNow ?? []),
      todayPlanJson: JSON.stringify(parsed.todayPlan),
      dailyLogDraftJson: JSON.stringify(parsed.recommendedDailyLog),
      contextSnapshotJson: JSON.stringify(missionContext),
      model: generated.model,
      lastActivatedAt: new Date(),
      tasks: {
        create: (parsed.tasks ?? []).map((task, index) => ({
          title: task.title,
          detail: task.detail,
          rationale: task.rationale,
          taskType: task.taskType,
          priority: task.priority,
          energyBand: task.energyBand,
          dueLabel: task.dueLabel,
          estimatedMinutes: task.estimatedMinutes,
          linkedStudyNodeId:
            (task.linkedStudySlug && slugs.get(task.linkedStudySlug)) || null,
          checklistJson: JSON.stringify(task.checklist ?? []),
          orderIndex: index,
        })),
      },
    },
    include: {
      tasks: {
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        include: {
          linkedStudyNode: {
            select: { id: true, slug: true, title: true },
          },
        },
      },
    },
  });

  return serializeMission(mission);
}

export async function updateAgentTaskStatus(taskId: string, status: MissionTaskStatus) {
  await reconcileStaleAgentTasks();

  const task = await db.agentTask.update({
    where: { id: taskId },
    data: {
      status,
      completionNotes:
        status === "DONE"
          ? "Completed from Mission Todo board."
          : status === "SKIPPED"
            ? "Skipped from Mission Todo board."
            : null,
    },
    include: {
      mission: {
        select: {
          id: true,
          title: true,
          urgency: true,
          launchedAt: true,
          status: true,
        },
      },
      linkedStudyNode: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
    },
  });

  await syncMissionStatus(task.missionId);

  return serializeTodoTask(task);
}

export async function deleteAgentTask(taskId: string) {
  const existing = await db.agentTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      missionId: true,
    },
  });

  if (!existing) {
    throw new Error("Task not found.");
  }

  await db.agentTask.delete({
    where: { id: taskId },
  });

  await syncMissionStatus(existing.missionId);

  return { ok: true, taskId };
}

export async function applyMissionDailyLog(missionId: string) {
  const mission = await db.agentMission.findUnique({
    where: { id: missionId },
    select: {
      dailyLogDraftJson: true,
    },
  });

  const draft = parseJsonObject<{
    logDate: string;
    primaryFocus: string;
    totalHours: number;
    questionsSolved: number;
    topicsStudied: number;
    completion: number;
    disciplineScore: number;
    tomorrowPlan: string;
  }>(mission?.dailyLogDraftJson);

  if (!draft) {
    throw new Error("This mission does not contain a daily command draft.");
  }

  const logDate = new Date(`${draft.logDate}T12:00:00+05:30`);
  const dayStart = startOfDay(logDate);
  const dayEnd = endOfDay(logDate);

  const existing = await db.dailyLog.findFirst({
    where: {
      logDate: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
  });

  if (existing) {
    await db.dailyLog.update({
      where: { id: existing.id },
      data: {
        primaryFocus: draft.primaryFocus,
        totalHours: draft.totalHours,
        questionsSolved: draft.questionsSolved,
        topicsStudied: draft.topicsStudied,
        completion: draft.completion,
        disciplineScore: draft.disciplineScore,
        tomorrowPlan: draft.tomorrowPlan,
      },
    });
  } else {
    await db.dailyLog.create({
      data: {
        logDate,
        primaryFocus: draft.primaryFocus,
        totalHours: draft.totalHours,
        questionsSolved: draft.questionsSolved,
        topicsStudied: draft.topicsStudied,
        completion: draft.completion,
        disciplineScore: draft.disciplineScore,
        tomorrowPlan: draft.tomorrowPlan,
      },
    });
  }

  await db.agentMission.update({
    where: { id: missionId },
    data: {
      status: "APPLIED",
      appliedAt: new Date(),
      lastActivatedAt: new Date(),
    },
  });

  return fetchMissionRecord(missionId);
}

export async function activateMission(missionId: string) {
  await db.agentMission.update({
    where: { id: missionId },
    data: {
      status: "ACTIVE",
      lastActivatedAt: new Date(),
    },
  });

  return fetchMissionRecord(missionId);
}
