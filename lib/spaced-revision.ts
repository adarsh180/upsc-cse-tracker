import { addDays } from "date-fns";

import { db } from "@/lib/db";
import { createManualTodoTask } from "@/lib/mission-control";

// SM-2 lite: expanding intervals (days) indexed by completed revision count.
const REVISION_INTERVALS_DAYS = [1, 3, 7, 21, 45, 90];

export function nextRevisionDueDate(revisionCount: number, anchor: Date) {
  const interval =
    REVISION_INTERVALS_DAYS[Math.min(revisionCount, REVISION_INTERVALS_DAYS.length - 1)];
  return addDays(anchor, interval);
}

export type DueRevision = {
  studyNodeId: string;
  title: string;
  slug: string;
  revisionCount: number;
  dueSince: string;
  overdueDays: number;
};

export async function getDueRevisions(limit = 12): Promise<DueRevision[]> {
  const now = new Date();
  const progress = await db.topicProgress.findMany({
    where: { checked: true },
    select: {
      studyNodeId: true,
      revisionCount: true,
      lastRevisedAt: true,
      checkedAt: true,
      studyNode: { select: { title: true, slug: true } },
    },
  });

  const due = progress
    .map((entry) => {
      const anchor = entry.lastRevisedAt ?? entry.checkedAt;
      if (!anchor) return null;
      const dueDate = nextRevisionDueDate(entry.revisionCount, anchor);
      if (dueDate > now) return null;
      return {
        studyNodeId: entry.studyNodeId,
        title: entry.studyNode.title,
        slug: entry.studyNode.slug,
        revisionCount: entry.revisionCount,
        dueSince: dueDate.toISOString().slice(0, 10),
        overdueDays: Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000),
      };
    })
    .filter((entry): entry is DueRevision => entry !== null)
    .sort((a, b) => b.overdueDays - a.overdueDays);

  return due.slice(0, limit);
}

/**
 * Create REVISION todos for the most overdue topics that don't already have
 * an open revision task. Returns the created task titles.
 */
export async function ensureRevisionTodos(maxNewTodos = 3) {
  const due = await getDueRevisions(maxNewTodos * 3);
  if (due.length === 0) return { created: [] as string[], duePending: 0 };

  const openRevisionTasks = await db.agentTask.findMany({
    where: {
      taskType: "REVISION",
      status: { in: ["TODO", "IN_PROGRESS"] },
      linkedStudyNodeId: { in: due.map((entry) => entry.studyNodeId) },
    },
    select: { linkedStudyNodeId: true },
  });
  const alreadyQueued = new Set(openRevisionTasks.map((task) => task.linkedStudyNodeId));

  const created: string[] = [];
  for (const entry of due) {
    if (created.length >= maxNewTodos) break;
    if (alreadyQueued.has(entry.studyNodeId)) continue;

    await createManualTodoTask({
      title: `Revise: ${entry.title} (round ${entry.revisionCount + 1})`,
      detail: `Spaced-repetition schedule: due since ${entry.dueSince} (${entry.overdueDays} day(s) overdue). Recall actively first, then re-read notes and close gaps.`,
      taskType: "REVISION",
      priority: entry.overdueDays >= 7 ? "HIGH" : "MEDIUM",
      energyBand: "MEDIUM",
      dueLabel: "Today",
      estimatedMinutes: 45,
      linkedStudyNodeId: entry.studyNodeId,
    });
    created.push(entry.title);
  }

  return { created, duePending: due.length - created.length };
}
