import { generateText } from "ai";
import { subDays } from "date-fns";

import { getCrossExamStats } from "@/lib/agent-memory";
import { getGoogleModel } from "@/lib/ai-models";
import { istDayKey } from "@/lib/current-affairs";
import { db } from "@/lib/db";

/** Monday 00:00 IST of the week containing the given date (as UTC day key). */
export function istWeekStart(date = new Date()) {
  const dayKey = istDayKey(date);
  const weekday = dayKey.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % 7;
  return new Date(dayKey.getTime() - daysSinceMonday * 86_400_000);
}

export function isSundayIST(date = new Date()) {
  return istDayKey(date).getUTCDay() === 0;
}

function pearson(pairs: Array<[number, number]>) {
  if (pairs.length < 4) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / n;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const [x, y] of pairs) {
    cov += (x - meanX) * (y - meanY);
    varX += (x - meanX) ** 2;
    varY += (y - meanY) ** 2;
  }
  if (varX === 0 || varY === 0) return null;
  return Math.round((cov / Math.sqrt(varX * varY)) * 100) / 100;
}

function dayOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Mood ↔ performance correlations over the last 60 days, computed by pairing
 * same-day mood entries with study/test signals.
 */
export async function computeMoodPerformanceCorrelation() {
  const since = subDays(new Date(), 60);

  const [moods, studyLogs, dailyLogs, tests] = await Promise.all([
    db.moodEntry.findMany({
      where: { moodDate: { gte: since } },
      select: { moodDate: true, energy: true, focus: true, stress: true, confidence: true },
    }),
    db.studyLog.findMany({
      where: { logDate: { gte: since } },
      select: { logDate: true, hours: true, focusScore: true },
    }),
    db.dailyLog.findMany({
      where: { logDate: { gte: since } },
      select: { logDate: true, totalHours: true, disciplineScore: true },
    }),
    db.testRecord.findMany({
      where: { testDate: { gte: since } },
      select: { testDate: true, score: true, totalMarks: true },
    }),
  ]);

  const moodByDay = new Map(moods.map((mood) => [dayOf(mood.moodDate), mood]));

  const hoursByDay = new Map<string, number>();
  for (const log of studyLogs) {
    const key = dayOf(log.logDate);
    hoursByDay.set(key, (hoursByDay.get(key) ?? 0) + log.hours);
  }
  for (const log of dailyLogs) {
    const key = dayOf(log.logDate);
    if (!hoursByDay.has(key)) hoursByDay.set(key, log.totalHours);
  }

  const focusByDay = new Map<string, number>();
  for (const log of studyLogs) {
    if (log.focusScore != null) focusByDay.set(dayOf(log.logDate), log.focusScore);
  }

  const stressVsHours: Array<[number, number]> = [];
  const energyVsHours: Array<[number, number]> = [];
  const stressVsFocus: Array<[number, number]> = [];
  const confidenceVsTestPct: Array<[number, number]> = [];

  for (const [day, mood] of moodByDay) {
    const hours = hoursByDay.get(day);
    if (hours != null) {
      stressVsHours.push([mood.stress, hours]);
      energyVsHours.push([mood.energy, hours]);
    }
    const focus = focusByDay.get(day);
    if (focus != null) stressVsFocus.push([mood.stress, focus]);
  }

  for (const test of tests) {
    const mood = moodByDay.get(dayOf(test.testDate));
    if (mood && test.totalMarks > 0) {
      confidenceVsTestPct.push([mood.confidence, (test.score / test.totalMarks) * 100]);
    }
  }

  return {
    windowDays: 60,
    samples: {
      moodDays: moods.length,
      studyDays: hoursByDay.size,
      testsWithSameDayMood: confidenceVsTestPct.length,
    },
    correlations: {
      stressVsStudyHours: pearson(stressVsHours),
      energyVsStudyHours: pearson(energyVsHours),
      stressVsFocusScore: pearson(stressVsFocus),
      confidenceVsTestScorePct: pearson(confidenceVsTestPct),
    },
    note: "Pearson r in [-1, 1]; null when fewer than 4 paired samples. Correlation, not causation.",
  };
}

async function computeWeeklyStats(weekStart: Date) {
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  const [studyLogs, dailyLogs, moods, tests, tasksTouched, screenTime, crossExam] =
    await Promise.all([
      db.studyLog.findMany({
        where: { logDate: { gte: weekStart, lt: weekEnd } },
        select: { logDate: true, hours: true, title: true, focusScore: true },
      }),
      db.dailyLog.findMany({
        where: { logDate: { gte: weekStart, lt: weekEnd } },
        select: { logDate: true, totalHours: true, disciplineScore: true, wins: true, blockers: true },
      }),
      db.moodEntry.findMany({
        where: { moodDate: { gte: weekStart, lt: weekEnd } },
        select: { label: true, energy: true, focus: true, stress: true, confidence: true },
      }),
      db.testRecord.findMany({
        where: { testDate: { gte: weekStart, lt: weekEnd } },
        select: { title: true, score: true, totalMarks: true, examStage: true, paperName: true, optionalSubject: true },
      }),
      db.agentTask.findMany({
        where: { updatedAt: { gte: weekStart, lt: weekEnd } },
        select: { status: true, taskType: true, title: true },
      }),
      db.screenTimeLog.findMany({
        where: { logDate: { gte: weekStart, lt: weekEnd } },
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

  const daysStudied = new Set(studyLogs.map((log) => dayOf(log.logDate)));
  for (const log of dailyLogs) {
    if (log.totalHours > 0) daysStudied.add(dayOf(log.logDate));
  }

  const avg = (values: number[]) =>
    values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;

  const done = tasksTouched.filter((task) => task.status === "DONE");
  const skipped = tasksTouched.filter((task) => task.status === "SKIPPED");

  return {
    weekStart: dayOf(weekStart),
    daysStudied: daysStudied.size,
    totalHours: Math.round(studyLogs.reduce((sum, log) => sum + log.hours, 0) * 10) / 10,
    avgFocusScore: avg(studyLogs.map((log) => log.focusScore).filter((value): value is number => value != null)),
    avgDiscipline: avg(dailyLogs.map((log) => log.disciplineScore)),
    wins: dailyLogs.map((log) => log.wins).filter(Boolean).slice(0, 5),
    blockers: dailyLogs.map((log) => log.blockers).filter(Boolean).slice(0, 5),
    mood: {
      entries: moods.length,
      avgEnergy: avg(moods.map((mood) => mood.energy)),
      avgStress: avg(moods.map((mood) => mood.stress)),
      avgConfidence: avg(moods.map((mood) => mood.confidence)),
      labels: moods.map((mood) => mood.label),
    },
    tests: tests.map((test) => ({
      title: test.title,
      stage: test.examStage,
      subject: test.paperName ?? test.optionalSubject ?? null,
      scorePct: test.totalMarks > 0 ? Math.round((test.score / test.totalMarks) * 100) : null,
    })),
    todos: { done: done.length, skipped: skipped.length, doneTitles: done.map((task) => task.title).slice(0, 10) },
    distractionHours:
      Math.round(
        screenTime.reduce(
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
        ) * 10,
      ) / 10,
    crossExamLast30Days: crossExam.last30Days,
  };
}

/** Generate (or return existing) weekly review for the week containing `date`. */
export async function generateWeeklyReview(date = new Date(), force = false) {
  const weekStart = istWeekStart(date);

  const existing = await db.weeklyReview.findUnique({ where: { weekStart } });
  if (existing && !force) return { review: existing, created: false };

  const [stats, correlation] = await Promise.all([
    computeWeeklyStats(weekStart),
    computeMoodPerformanceCorrelation(),
  ]);

  const prompt = `You are UPSC-GURU writing Adarsh Tiwari's Sunday self-review for the week starting ${stats.weekStart} (UPSC CSE 2027 prep, 3rd attempt).
Write in clean markdown with these exact sections:
## The Week in One Verdict
## What the Numbers Say
## Wins Worth Keeping
## Failures Worth Fixing
## Mood × Performance Read
## Next Week's Contract
Rules: surgical honesty, no fluff, cite the actual numbers given, max ~450 words. In "Mood × Performance Read" interpret the Pearson correlations carefully (correlation ≠ causation, mention sample sizes). "Next Week's Contract" must be 3-5 concrete, measurable commitments.

WEEK DATA (JSON):
${JSON.stringify(stats, null, 2)}

MOOD-PERFORMANCE CORRELATIONS (JSON):
${JSON.stringify(correlation, null, 2)}`;

  const model = getGoogleModel(process.env.GOOGLE_AI_MODEL_REVIEW);
  const result = await generateText({ model, prompt, temperature: 0.5, maxOutputTokens: 2048 });

  const review = await db.weeklyReview.upsert({
    where: { weekStart },
    update: {
      reportText: result.text,
      statsJson: JSON.stringify(stats),
      moodCorrelationJson: JSON.stringify(correlation),
    },
    create: {
      weekStart,
      reportText: result.text,
      statsJson: JSON.stringify(stats),
      moodCorrelationJson: JSON.stringify(correlation),
      model: process.env.GOOGLE_AI_MODEL_REVIEW ?? process.env.GOOGLE_AI_MODEL_PRIMARY ?? "gemma-3-27b-it",
    },
  });

  return { review, created: true };
}

/**
 * Sunday surface: on Sundays (IST) return this week's review, generating it
 * lazily if the cron hasn't already. Returns null on other days.
 */
export async function getSundayReview() {
  if (!isSundayIST()) return null;
  try {
    const { review } = await generateWeeklyReview();
    if (!review.seenAt) {
      await db.weeklyReview.update({ where: { id: review.id }, data: { seenAt: new Date() } }).catch(() => {});
    }
    return review;
  } catch (error) {
    console.error("[weekly-review] Failed to build Sunday review:", error);
    return null;
  }
}
