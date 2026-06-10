import { differenceInCalendarDays, subDays } from "date-fns";

import { db } from "@/lib/db";

export const MEMORY_KINDS = [
  "PERSONAL",
  "RELATIONSHIP",
  "WEAKNESS",
  "STRENGTH",
  "COMMITMENT",
  "ANSWER_PATTERN",
  "PREFERENCE",
  "CURRENT_AFFAIRS",
  "INSIGHT",
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

const MAX_ACTIVE_MEMORIES_PER_KIND = 40;

// ---------------------------------------------------------------------------
// Memory CRUD
// ---------------------------------------------------------------------------

export async function saveAgentMemory(input: {
  kind: MemoryKind;
  content: string;
  sourceNote?: string;
  importance?: number;
}) {
  const content = input.content.trim();
  if (!content) {
    throw new Error("Memory content is required.");
  }

  // Avoid exact duplicates: refresh the existing memory instead.
  const existing = await db.agentMemory.findFirst({
    where: { status: "ACTIVE", kind: input.kind, content },
  });

  if (existing) {
    const updated = await db.agentMemory.update({
      where: { id: existing.id },
      data: {
        importance: Math.max(existing.importance, clampImportance(input.importance)),
        sourceNote: input.sourceNote?.slice(0, 255) ?? existing.sourceNote,
      },
    });
    return { memory: updated, deduplicated: true };
  }

  const memory = await db.agentMemory.create({
    data: {
      kind: input.kind,
      content,
      sourceNote: input.sourceNote?.slice(0, 255) ?? null,
      importance: clampImportance(input.importance),
    },
  });

  // Keep memory bounded: archive the least important, oldest entries.
  const activeCount = await db.agentMemory.count({
    where: { status: "ACTIVE", kind: input.kind },
  });
  if (activeCount > MAX_ACTIVE_MEMORIES_PER_KIND) {
    const overflow = await db.agentMemory.findMany({
      where: { status: "ACTIVE", kind: input.kind },
      orderBy: [{ importance: "asc" }, { updatedAt: "asc" }],
      take: activeCount - MAX_ACTIVE_MEMORIES_PER_KIND,
      select: { id: true },
    });
    if (overflow.length > 0) {
      await db.agentMemory.updateMany({
        where: { id: { in: overflow.map((m) => m.id) } },
        data: { status: "ARCHIVED" },
      });
    }
  }

  return { memory, deduplicated: false };
}

export async function updateAgentMemory(input: {
  memoryId: string;
  content?: string;
  importance?: number;
  archive?: boolean;
}) {
  const memory = await db.agentMemory.update({
    where: { id: input.memoryId },
    data: {
      content: input.content?.trim() || undefined,
      importance: input.importance != null ? clampImportance(input.importance) : undefined,
      status: input.archive ? "ARCHIVED" : undefined,
    },
  });
  return { memory };
}

export async function recallAgentMemories(input: {
  query?: string;
  kind?: MemoryKind;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 30);
  const terms = (input.query ?? "")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 6);

  const memories = await db.agentMemory.findMany({
    where: {
      status: "ACTIVE",
      kind: input.kind,
      OR: terms.length > 0 ? terms.map((term) => ({ content: { contains: term } })) : undefined,
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  if (memories.length > 0) {
    await db.agentMemory.updateMany({
      where: { id: { in: memories.map((m) => m.id) } },
      data: { lastRecalledAt: new Date() },
    });
  }

  return memories.map(serializeMemory);
}

function clampImportance(value?: number) {
  return Math.min(Math.max(Math.round(value ?? 3), 1), 5);
}

function serializeMemory(memory: {
  id: string;
  kind: string;
  content: string;
  sourceNote: string | null;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: memory.id,
    kind: memory.kind,
    content: memory.content,
    sourceNote: memory.sourceNote,
    importance: memory.importance,
    rememberedOn: memory.createdAt.toISOString().slice(0, 10),
    lastTouched: memory.updatedAt.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Memory digest injected into every Guru turn
// ---------------------------------------------------------------------------

export async function buildAgentMemoryDigest() {
  const [memories, pendingExams, recentFailures] = await Promise.all([
    db.agentMemory.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 36,
    }),
    db.crossExamEntry.findMany({
      where: { verdict: "PENDING" },
      orderBy: { askedAt: "desc" },
      take: 5,
    }),
    db.crossExamEntry.findMany({
      where: {
        verdict: { in: ["INCORRECT", "PARTIAL"] },
        followUpAt: { lte: new Date() },
      },
      orderBy: { followUpAt: "asc" },
      take: 5,
    }),
  ]);

  if (memories.length === 0 && pendingExams.length === 0 && recentFailures.length === 0) {
    return "No long-term agent memories stored yet. Begin building them with the save_memory tool.";
  }

  const byKind = new Map<string, string[]>();
  for (const memory of memories) {
    const list = byKind.get(memory.kind) ?? [];
    list.push(`- (${memory.importance}/5, ${memory.updatedAt.toISOString().slice(0, 10)}) ${memory.content}`);
    byKind.set(memory.kind, list);
  }

  const sections: string[] = [];
  for (const kind of MEMORY_KINDS) {
    const entries = byKind.get(kind);
    if (entries?.length) {
      sections.push(`${kind}:\n${entries.join("\n")}`);
    }
  }

  if (pendingExams.length > 0) {
    sections.push(
      `CROSS-EXAM QUESTIONS AWAITING HIS ANSWER (check if his latest message answers one; if so grade it with record_cross_exam_answer):\n${pendingExams
        .map((entry) => `- [${entry.id}] ${entry.question}${entry.topicLabel ? ` (topic: ${entry.topicLabel})` : ""}`)
        .join("\n")}`,
    );
  }

  if (recentFailures.length > 0) {
    sections.push(
      `DUE FOR RE-TESTING (he previously failed these; re-ask naturally when relevant):\n${recentFailures
        .map(
          (entry) =>
            `- [${entry.id}] ${entry.question} (last verdict: ${entry.verdict}${entry.topicLabel ? `, topic: ${entry.topicLabel}` : ""})`,
        )
        .join("\n")}`,
    );
  }

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Cross-examination log
// ---------------------------------------------------------------------------

export async function logCrossExamQuestion(input: {
  question: string;
  expectedPoints?: string;
  topicLabel?: string;
  subjectLabel?: string;
}) {
  const entry = await db.crossExamEntry.create({
    data: {
      question: input.question.trim(),
      expectedPoints: input.expectedPoints?.trim() || null,
      topicLabel: input.topicLabel?.slice(0, 255) ?? null,
      subjectLabel: input.subjectLabel?.slice(0, 120) ?? null,
    },
  });
  return { ok: true, entryId: entry.id };
}

export async function recordCrossExamAnswer(input: {
  entryId: string;
  userAnswer: string;
  verdict: "CORRECT" | "PARTIAL" | "INCORRECT";
  score?: number;
  feedback?: string;
}) {
  const followUpDays = input.verdict === "CORRECT" ? null : input.verdict === "PARTIAL" ? 3 : 1;
  const entry = await db.crossExamEntry.update({
    where: { id: input.entryId },
    data: {
      userAnswer: input.userAnswer.trim(),
      verdict: input.verdict,
      score: input.score != null ? Math.min(Math.max(Math.round(input.score), 0), 10) : null,
      feedback: input.feedback?.trim() || null,
      answeredAt: new Date(),
      followUpAt: followUpDays ? subDays(new Date(), -followUpDays) : null,
    },
  });
  return { ok: true, entryId: entry.id, verdict: entry.verdict, followUpAt: entry.followUpAt };
}

export async function getCrossExamStats() {
  const since = subDays(new Date(), 30);
  const entries = await db.crossExamEntry.findMany({
    where: { askedAt: { gte: since } },
    orderBy: { askedAt: "desc" },
    take: 100,
  });

  const answered = entries.filter((entry) => entry.verdict !== "PENDING");
  const correct = answered.filter((entry) => entry.verdict === "CORRECT").length;
  const bySubject = new Map<string, { asked: number; correct: number }>();
  for (const entry of answered) {
    const key = entry.subjectLabel ?? "General";
    const bucket = bySubject.get(key) ?? { asked: 0, correct: 0 };
    bucket.asked += 1;
    if (entry.verdict === "CORRECT") bucket.correct += 1;
    bySubject.set(key, bucket);
  }

  return {
    last30Days: {
      asked: entries.length,
      answered: answered.length,
      ignored: entries.filter((entry) => entry.verdict === "PENDING").length,
      correct,
      accuracyPct: answered.length > 0 ? Math.round((correct / answered.length) * 100) : null,
    },
    bySubject: Array.from(bySubject.entries()).map(([subject, stats]) => ({
      subject,
      ...stats,
      accuracyPct: Math.round((stats.correct / stats.asked) * 100),
    })),
  };
}

// ---------------------------------------------------------------------------
// Prep pulse: study frequency, current affairs, mood, tests, screen time
// ---------------------------------------------------------------------------

const CURRENT_AFFAIRS_PATTERN = /current affairs|newspaper|the hindu|indian express|pib|yojana|kurukshetra|daily news|editorial/i;

export async function getPrepPulse() {
  const now = new Date();
  const since14 = subDays(now, 14);
  const since30 = subDays(now, 30);

  const [studyLogs, dailyLogs, moodEntries, tests, screenTime, crossExamStats] = await Promise.all([
    db.studyLog.findMany({
      where: { logDate: { gte: since14 } },
      orderBy: { logDate: "desc" },
      select: { logDate: true, hours: true, title: true, focusScore: true },
    }),
    db.dailyLog.findMany({
      where: { logDate: { gte: since14 } },
      orderBy: { logDate: "desc" },
      select: {
        logDate: true,
        totalHours: true,
        primaryFocus: true,
        disciplineScore: true,
        subjectsCovered: true,
        blockers: true,
      },
    }),
    db.moodEntry.findMany({
      where: { moodDate: { gte: since14 } },
      orderBy: { moodDate: "desc" },
      select: { moodDate: true, label: true, energy: true, focus: true, stress: true, confidence: true },
    }),
    db.testRecord.findMany({
      where: { testDate: { gte: since30 } },
      orderBy: { testDate: "desc" },
      take: 10,
      select: {
        title: true,
        testDate: true,
        score: true,
        totalMarks: true,
        examStage: true,
        paperName: true,
        optionalSubject: true,
      },
    }),
    db.screenTimeLog.findMany({
      where: { logDate: { gte: subDays(now, 7) } },
      select: {
        instagram: true,
        whatsapp: true,
        youtube: true,
        youtubeStudy: true,
        netflix: true,
        hotstar: true,
        mxPlayer: true,
        facebook: true,
        other: true,
      },
    }),
    getCrossExamStats(),
  ]);

  const studiedDays = new Set(studyLogs.map((log) => log.logDate.toISOString().slice(0, 10)));
  for (const log of dailyLogs) {
    if (log.totalHours > 0) studiedDays.add(log.logDate.toISOString().slice(0, 10));
  }

  let streak = 0;
  for (let offset = 0; offset < 14; offset += 1) {
    const day = subDays(now, offset).toISOString().slice(0, 10);
    if (studiedDays.has(day)) {
      streak += 1;
    } else if (offset > 0) {
      break;
    }
  }

  const totalHours14 = round1(
    studyLogs.reduce((sum, log) => sum + log.hours, 0),
  );

  const caHits = [
    ...studyLogs.filter((log) => CURRENT_AFFAIRS_PATTERN.test(log.title)),
    ...dailyLogs.filter(
      (log) =>
        CURRENT_AFFAIRS_PATTERN.test(log.primaryFocus) ||
        CURRENT_AFFAIRS_PATTERN.test(log.subjectsCovered ?? ""),
    ),
  ];
  const caDays = new Set(caHits.map((log) => log.logDate.toISOString().slice(0, 10)));

  const lastStudyDate = studyLogs[0]?.logDate ?? dailyLogs.find((l) => l.totalHours > 0)?.logDate ?? null;

  const distraction = screenTime.reduce(
    (sum, log) =>
      sum +
      log.instagram +
      log.whatsapp +
      (log.youtube - log.youtubeStudy) +
      log.netflix +
      log.hotstar +
      log.mxPlayer +
      log.facebook +
      log.other,
    0,
  );

  return {
    studyRhythm: {
      daysStudiedInLast14: studiedDays.size,
      currentStreakDays: streak,
      totalLoggedHoursLast14: totalHours14,
      daysSinceLastStudyLog: lastStudyDate ? differenceInCalendarDays(now, lastStudyDate) : null,
      avgFocusScore: average(studyLogs.map((log) => log.focusScore).filter(isNumber)),
      recentBlockers: dailyLogs
        .map((log) => log.blockers)
        .filter((blocker): blocker is string => Boolean(blocker?.trim()))
        .slice(0, 3),
    },
    currentAffairs: {
      daysTouchedInLast14: caDays.size,
      assessment:
        caDays.size >= 10
          ? "consistent"
          : caDays.size >= 5
            ? "irregular"
            : "neglected",
    },
    mood: {
      entriesLast14: moodEntries.length,
      latest: moodEntries[0] ?? null,
      avgEnergy: average(moodEntries.map((entry) => entry.energy)),
      avgStress: average(moodEntries.map((entry) => entry.stress)),
      avgConfidence: average(moodEntries.map((entry) => entry.confidence)),
    },
    tests: {
      countLast30: tests.length,
      recent: tests.map((test) => ({
        title: test.title,
        date: test.testDate.toISOString().slice(0, 10),
        scorePct: test.totalMarks > 0 ? Math.round((test.score / test.totalMarks) * 100) : null,
        stage: test.examStage,
        subject: test.paperName ?? test.optionalSubject ?? null,
      })),
    },
    distractionHoursLast7: round1(distraction),
    crossExam: crossExamStats,
  };
}

// ---------------------------------------------------------------------------
// Weak areas from question-level error logs + revision gaps
// ---------------------------------------------------------------------------

export async function getWeakAreas() {
  const since = subDays(new Date(), 60);

  const [wrongQuestions, staleRevisions] = await Promise.all([
    db.testQuestionLog.findMany({
      where: {
        createdAt: { gte: since },
        outcome: { in: ["INCORRECT", "WRONG", "SKIPPED"] },
      },
      select: {
        subject: true,
        topic: true,
        errorType: true,
        outcome: true,
        mistakeReason: true,
      },
      take: 400,
    }),
    db.topicProgress.findMany({
      where: {
        checked: true,
        OR: [{ lastRevisedAt: null }, { lastRevisedAt: { lte: subDays(new Date(), 21) } }],
      },
      orderBy: { checkedAt: "asc" },
      take: 15,
      select: {
        revisionCount: true,
        lastRevisedAt: true,
        studyNode: { select: { title: true } },
      },
    }),
  ]);

  const byTopic = new Map<string, { subject: string; topic: string; wrong: number; skipped: number; errorTypes: Set<string> }>();
  for (const question of wrongQuestions) {
    const subject = question.subject ?? "Unknown";
    const topic = question.topic ?? "General";
    const key = `${subject}::${topic}`;
    const bucket =
      byTopic.get(key) ?? { subject, topic, wrong: 0, skipped: 0, errorTypes: new Set<string>() };
    if (question.outcome === "SKIPPED") bucket.skipped += 1;
    else bucket.wrong += 1;
    if (question.errorType) bucket.errorTypes.add(question.errorType);
    byTopic.set(key, bucket);
  }

  const weakTopics = Array.from(byTopic.values())
    .sort((a, b) => b.wrong + b.skipped - (a.wrong + a.skipped))
    .slice(0, 12)
    .map((bucket) => ({
      subject: bucket.subject,
      topic: bucket.topic,
      wrongCount: bucket.wrong,
      skippedCount: bucket.skipped,
      errorTypes: Array.from(bucket.errorTypes),
    }));

  return {
    weakTopicsFromTests: weakTopics,
    revisionDebt: staleRevisions.map((progress) => ({
      topic: progress.studyNode.title,
      revisionCount: progress.revisionCount,
      lastRevisedAt: progress.lastRevisedAt?.toISOString().slice(0, 10) ?? "never",
    })),
  };
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function average(values: number[]) {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
