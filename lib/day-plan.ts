import { subDays } from "date-fns";

import { getPrepPulse, getWeakAreas } from "@/lib/agent-memory";
import { extractJsonBlock, generateTextResilient } from "@/lib/ai-models";
import { istDayKey } from "@/lib/current-affairs";
import { db } from "@/lib/db";
import { createManualTodoTask } from "@/lib/mission-control";
import { getDueRevisions } from "@/lib/spaced-revision";

export type ProposedTask = {
  title: string;
  detail: string;
  taskType: "PLANNING" | "REVISION" | "PRACTICE" | "TEST" | "ESSAY" | "RECOVERY" | "ANALYSIS";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  energyBand: "LIGHT" | "MEDIUM" | "DEEP";
  estimatedMinutes: number;
  subject?: string;
};

const TASK_TYPES = new Set(["PLANNING", "REVISION", "PRACTICE", "TEST", "ESSAY", "RECOVERY", "ANALYSIS"]);
const PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const ENERGY_BANDS = new Set(["LIGHT", "MEDIUM", "DEEP"]);

// ---------------------------------------------------------------------------
// Subject status (completion % per SUBJECT node, GS vs optional classification)
// ---------------------------------------------------------------------------

export type SubjectStatus = {
  title: string;
  paper: string;
  completionPct: number;
  isOptional: boolean;
  lastStudiedDaysAgo: number | null;
};

function isOptionalSubjectPath(paperTitle: string, subjectTitle: string) {
  const haystack = `${paperTitle} ${subjectTitle}`.toLowerCase();
  return /psir|political science|optional/.test(haystack);
}

export async function getSubjectStatus(): Promise<SubjectStatus[]> {
  const [nodes, recentLogs] = await Promise.all([
    db.studyNode.findMany({
      select: {
        id: true,
        parentId: true,
        type: true,
        title: true,
        topicProgress: { select: { checked: true } },
      },
    }),
    db.studyLog.findMany({
      where: { logDate: { gte: subDays(new Date(), 30) }, studyNodeId: { not: null } },
      orderBy: { logDate: "desc" },
      select: { logDate: true, studyNodeId: true },
    }),
  ]);

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, typeof nodes>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  function leafStats(nodeId: string): { leaves: number; checked: number } {
    const children = childrenByParent.get(nodeId) ?? [];
    if (children.length === 0) {
      const node = byId.get(nodeId);
      return { leaves: 1, checked: node?.topicProgress?.checked ? 1 : 0 };
    }
    let leaves = 0;
    let checked = 0;
    for (const child of children) {
      const stats = leafStats(child.id);
      leaves += stats.leaves;
      checked += stats.checked;
    }
    return { leaves, checked };
  }

  function subjectOfNode(nodeId: string | null): string | null {
    let current = nodeId ? byId.get(nodeId) : null;
    while (current) {
      if (current.type === "SUBJECT") return current.id;
      current = current.parentId ? byId.get(current.parentId) : null;
    }
    return null;
  }

  const lastStudiedBySubject = new Map<string, Date>();
  for (const log of recentLogs) {
    const subjectId = subjectOfNode(log.studyNodeId);
    if (subjectId && !lastStudiedBySubject.has(subjectId)) {
      lastStudiedBySubject.set(subjectId, log.logDate);
    }
  }

  const now = Date.now();
  return nodes
    .filter((node) => node.type === "SUBJECT")
    .map((subject) => {
      const paper = subject.parentId ? byId.get(subject.parentId) : null;
      const stats = leafStats(subject.id);
      const lastStudied = lastStudiedBySubject.get(subject.id) ?? null;
      return {
        title: subject.title,
        paper: paper?.title ?? "Unknown paper",
        completionPct: stats.leaves > 0 ? Math.round((stats.checked / stats.leaves) * 100) : 0,
        isOptional: isOptionalSubjectPath(paper?.title ?? "", subject.title),
        lastStudiedDaysAgo: lastStudied ? Math.floor((now - lastStudied.getTime()) / 86_400_000) : null,
      };
    })
    .sort((a, b) => b.completionPct - a.completionPct);
}

/**
 * Rotation rule: PSIR/optional daily + exactly the ACTIVE GS subjects
 * (0 < completion < 100). A new GS subject becomes eligible only when
 * fewer than 2 are active.
 */
export function computeAllowedSubjects(subjects: SubjectStatus[]) {
  const optional = subjects.filter((subject) => subject.isOptional && subject.completionPct < 100);
  const gs = subjects.filter((subject) => !subject.isOptional);

  const activeGs = gs
    .filter((subject) => subject.completionPct > 0 && subject.completionPct < 100)
    .sort((a, b) => (a.lastStudiedDaysAgo ?? 99) - (b.lastStudiedDaysAgo ?? 99));

  const allowedGs = activeGs.slice(0, 2);

  // Only when fewer than 2 GS subjects are in progress may a fresh one start.
  if (allowedGs.length < 2) {
    const fresh = gs
      .filter((subject) => subject.completionPct === 0)
      .slice(0, 2 - allowedGs.length);
    allowedGs.push(...fresh);
  }

  return {
    optionalSubjects: optional.map((subject) => subject.title),
    allowedGsSubjects: allowedGs.map((subject) => ({
      title: subject.title,
      completionPct: subject.completionPct,
      lastStudiedDaysAgo: subject.lastStudiedDaysAgo,
    })),
    lockedGsSubjects: gs
      .filter((subject) => subject.completionPct === 0 && !allowedGs.some((allowed) => allowed.title === subject.title))
      .map((subject) => subject.title),
  };
}

// ---------------------------------------------------------------------------
// Plan generation (proposes; never creates todos directly)
// ---------------------------------------------------------------------------

function sanitizeTasks(raw: unknown): ProposedTask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((task): task is Record<string, unknown> => typeof task === "object" && task !== null)
    .map((task) => ({
      title: String(task.title ?? "").slice(0, 200),
      detail: String(task.detail ?? "").slice(0, 600),
      taskType: (TASK_TYPES.has(String(task.taskType)) ? String(task.taskType) : "PLANNING") as ProposedTask["taskType"],
      priority: (PRIORITIES.has(String(task.priority)) ? String(task.priority) : "MEDIUM") as ProposedTask["priority"],
      energyBand: (ENERGY_BANDS.has(String(task.energyBand)) ? String(task.energyBand) : "MEDIUM") as ProposedTask["energyBand"],
      estimatedMinutes: Math.min(Math.max(Math.round(Number(task.estimatedMinutes) || 60), 15), 240),
      subject: task.subject ? String(task.subject).slice(0, 120) : undefined,
    }))
    .filter((task) => task.title.length > 0)
    .slice(0, 10);
}

export async function generateDayPlan(force = false) {
  const planDate = istDayKey();

  const existing = await db.dayPlan.findUnique({ where: { planDate } });
  if (existing && !force) return { plan: existing, created: false };

  const [pulse, weakAreas, dueRevisions, subjects, yesterdayLog, openTodos] = await Promise.all([
    getPrepPulse(),
    getWeakAreas(),
    getDueRevisions(8),
    getSubjectStatus(),
    db.dailyLog.findFirst({ orderBy: { logDate: "desc" }, take: 1 }),
    db.agentTask.findMany({
      where: { status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: [{ priority: "desc" }, { orderIndex: "asc" }],
      take: 10,
      select: { title: true, taskType: true, priority: true, status: true },
    }),
  ]);

  const rotation = computeAllowedSubjects(subjects);

  const prompt = `You are UPSC-GURU, Adarsh Tiwari's personal preparation chief-of-staff (UPSC CSE 2027, 3rd attempt, PSIR optional).
Build his plan for today and output STRICT JSON only (no fences, no prose):
{
  "briefingTitle": "max 60 chars, names today's single most important focus",
  "briefingText": "max 550 chars push-notification body: 1 line on yesterday/streak, then today's plan in compact form, then one closing directive. Plain text with • separators.",
  "tasks": [ { "title": "...", "detail": "why + what exactly to do", "taskType": "PLANNING|REVISION|PRACTICE|TEST|ESSAY|RECOVERY|ANALYSIS", "priority": "LOW|MEDIUM|HIGH|CRITICAL", "energyBand": "LIGHT|MEDIUM|DEEP", "estimatedMinutes": 60, "subject": "optional subject name" } ]
}

NON-NEGOTIABLE PLANNING RULES:
1. SUBJECT ROTATION: one PSIR/optional study block daily (${JSON.stringify(rotation.optionalSubjects)}), plus study blocks ONLY from these allowed GS subjects: ${JSON.stringify(rotation.allowedGsSubjects)}. These GS subjects are LOCKED until an active one reaches 100%: ${JSON.stringify(rotation.lockedGsSubjects)} — never schedule them.
2. One current-affairs task daily (newspaper/digest reading + notes, ~45 min, taskType PLANNING).
3. Revision first: if topics are overdue for spaced revision, the highest-overdue ones become HIGH/CRITICAL REVISION tasks. Overdue queue: ${JSON.stringify(dueRevisions)}.
4. Answer-writing: schedule one ESSAY/PRACTICE answer-writing task targeting a weak area at least every other day. Weak areas: ${JSON.stringify(weakAreas.weakTopicsFromTests.slice(0, 6))}.
5. One book-reading task when the day has room (standard reference for an allowed subject, taskType PLANNING, LIGHT energy).
6. 5-8 tasks total, realistic for one day (sum 6-9 hours), sized to his recent energy. Do NOT duplicate these already-open todos: ${JSON.stringify(openTodos)}.
7. If discipline slipped (low streak/hours), make the first task small and winnable (RECOVERY).

LIVE DATA:
- Prep pulse: ${JSON.stringify({ streak: pulse.studyRhythm.currentStreakDays, daysStudiedLast14: pulse.studyRhythm.daysStudiedInLast14, hoursLast14: pulse.studyRhythm.totalLoggedHoursLast14, blockers: pulse.studyRhythm.recentBlockers, currentAffairs: pulse.currentAffairs, mood: pulse.mood, distractionHoursLast7: pulse.distractionHoursLast7 })}
- Yesterday's daily log: ${JSON.stringify(yesterdayLog ? { focus: yesterdayLog.primaryFocus, hours: yesterdayLog.totalHours, discipline: yesterdayLog.disciplineScore, wins: yesterdayLog.wins, blockers: yesterdayLog.blockers, tomorrowPlan: yesterdayLog.tomorrowPlan } : null)}
- All subjects with completion: ${JSON.stringify(subjects.map((subject) => ({ title: subject.title, paper: subject.paper, pct: subject.completionPct, lastStudiedDaysAgo: subject.lastStudiedDaysAgo })))}`;

  // Gemma-4 first with a generous budget; flash only as the chain's last resort.
  const result = await generateTextResilient({
    prompt,
    temperature: 0.5,
    maxOutputTokens: 4096,
    timeoutMs: 150_000,
    modelEnvOverride: process.env.GOOGLE_AI_MODEL_PLAN,
  });

  const parsed = extractJsonBlock<{ briefingTitle?: string; briefingText?: string; tasks?: unknown }>(result.text);
  const tasks = sanitizeTasks(parsed?.tasks);

  if (!parsed?.briefingText || tasks.length === 0) {
    throw new Error("Day-plan model returned unusable output.");
  }

  const plan = await db.dayPlan.upsert({
    where: { planDate },
    update: existing
      ? {
          briefingTitle: parsed.briefingTitle?.slice(0, 120) ?? "Today's plan",
          briefingText: parsed.briefingText.slice(0, 900),
          proposedTasksJson: JSON.stringify(tasks),
          status: "PENDING",
          approvedTaskCount: 0,
          approvedAt: null,
        }
      : {},
    create: {
      planDate,
      briefingTitle: parsed.briefingTitle?.slice(0, 120) ?? "Today's plan",
      briefingText: parsed.briefingText.slice(0, 900),
      proposedTasksJson: JSON.stringify(tasks),
      contextJson: JSON.stringify({ rotation, dueRevisions: dueRevisions.length }),
    },
  });

  return { plan, created: true };
}

// ---------------------------------------------------------------------------
// Approval flow — todos are created ONLY here, on explicit user approval
// ---------------------------------------------------------------------------

export async function getTodayPlan() {
  return db.dayPlan.findUnique({ where: { planDate: istDayKey() } });
}

export async function approveDayPlan(planId: string, taskIndexes?: number[]) {
  const plan = await db.dayPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found.");
  if (plan.status === "APPROVED") return { ok: true, createdCount: plan.approvedTaskCount, alreadyApproved: true };

  const tasks = sanitizeTasks(JSON.parse(plan.proposedTasksJson));
  const selected =
    taskIndexes && taskIndexes.length > 0
      ? tasks.filter((_, index) => taskIndexes.includes(index))
      : tasks;

  let createdCount = 0;
  for (const task of selected) {
    await createManualTodoTask({
      title: task.title,
      detail: `${task.detail}${task.subject ? ` [Subject: ${task.subject}]` : ""} — proposed by Guru's morning plan, approved by you.`,
      taskType: task.taskType,
      priority: task.priority,
      energyBand: task.energyBand,
      estimatedMinutes: task.estimatedMinutes,
      dueLabel: "Today",
    });
    createdCount += 1;
  }

  const updated = await db.dayPlan.update({
    where: { id: plan.id },
    data: {
      status: createdCount === tasks.length ? "APPROVED" : "PARTIAL",
      approvedTaskCount: createdCount,
      approvedAt: new Date(),
    },
  });

  return { ok: true, createdCount, status: updated.status };
}

export async function dismissDayPlan(planId: string) {
  await db.dayPlan.update({ where: { id: planId }, data: { status: "DISMISSED" } });
  return { ok: true };
}
