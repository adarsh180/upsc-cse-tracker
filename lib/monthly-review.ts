import { generateTextResilient } from "@/lib/ai-models";
import { istDayKey } from "@/lib/current-affairs";
import { db } from "@/lib/db";
import { computeIntegrityAudit } from "@/lib/integrity";
import { generateVivaQuestions, summarizeViva, type VivaQuestion } from "@/lib/report-card";

/** 1st 00:00 IST of the month containing the given date (as UTC day key). */
export function istMonthStart(date = new Date()) {
  const dayKey = istDayKey(date);
  return new Date(Date.UTC(dayKey.getUTCFullYear(), dayKey.getUTCMonth(), 1));
}

export function isFirstOfMonthIST(date = new Date()) {
  return istDayKey(date).getUTCDate() === 1;
}

function dayOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pct(score: number, total: number) {
  return total > 0 ? Math.round((score / total) * 100) : null;
}

async function computeMonthlyStats(monthStart: Date) {
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const prevMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));

  const [studyLogs, dailyLogs, moods, tests, prevTests, checkedTopics, prevCheckedTopics, weeklies] =
    await Promise.all([
      db.studyLog.findMany({
        where: { logDate: { gte: monthStart, lt: monthEnd } },
        select: { logDate: true, hours: true, focusScore: true },
      }),
      db.dailyLog.findMany({
        where: { logDate: { gte: monthStart, lt: monthEnd } },
        select: { logDate: true, totalHours: true, disciplineScore: true, questionsSolved: true },
      }),
      db.moodEntry.findMany({
        where: { moodDate: { gte: monthStart, lt: monthEnd } },
        select: { energy: true, stress: true, confidence: true },
      }),
      db.testRecord.findMany({
        where: { testDate: { gte: monthStart, lt: monthEnd } },
        select: { title: true, examStage: true, paperName: true, optionalSubject: true, score: true, totalMarks: true, testDate: true },
      }),
      db.testRecord.findMany({
        where: { testDate: { gte: prevMonthStart, lt: monthStart } },
        select: { score: true, totalMarks: true },
      }),
      db.topicProgress.count({ where: { checked: true, checkedAt: { gte: monthStart, lt: monthEnd } } }),
      db.topicProgress.count({ where: { checked: true, checkedAt: { gte: prevMonthStart, lt: monthStart } } }),
      db.weeklyReview.findMany({
        where: { weekStart: { gte: monthStart, lt: monthEnd } },
        select: { weekStart: true, statsJson: true },
      }),
    ]);

  const studiedDays = new Set(studyLogs.map((log) => dayOf(log.logDate)));
  for (const log of dailyLogs) {
    if (log.totalHours > 0) studiedDays.add(dayOf(log.logDate));
  }

  const avg = (values: number[]) =>
    values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;

  const testPcts = tests.map((test) => pct(test.score, test.totalMarks)).filter((value): value is number => value != null);
  const prevTestPcts = prevTests.map((test) => pct(test.score, test.totalMarks)).filter((value): value is number => value != null);

  let weeklyHours: Array<{ weekStart: string; totalHours: number; daysStudied: number }> = [];
  try {
    weeklyHours = weeklies.map((week) => {
      const stats = JSON.parse(week.statsJson);
      return { weekStart: dayOf(week.weekStart), totalHours: stats.totalHours ?? 0, daysStudied: stats.daysStudied ?? 0 };
    });
  } catch {
    weeklyHours = [];
  }

  const daysInMonth = Math.round((Math.min(monthEnd.getTime(), Date.now()) - monthStart.getTime()) / 86_400_000);

  return {
    monthStart: dayOf(monthStart),
    daysInMonthSoFar: daysInMonth,
    daysStudied: studiedDays.size,
    consistencyPct: daysInMonth > 0 ? Math.round((studiedDays.size / daysInMonth) * 100) : null,
    totalHours: Math.round(studyLogs.reduce((sum, log) => sum + log.hours, 0) * 10) / 10,
    avgHoursPerStudyDay:
      studiedDays.size > 0
        ? Math.round((studyLogs.reduce((sum, log) => sum + log.hours, 0) / studiedDays.size) * 10) / 10
        : null,
    avgFocusScore: avg(studyLogs.map((log) => log.focusScore).filter((value): value is number => value != null)),
    avgDiscipline: avg(dailyLogs.map((log) => log.disciplineScore)),
    questionsSolved: dailyLogs.reduce((sum, log) => sum + log.questionsSolved, 0),
    syllabus: {
      topicsCompletedThisMonth: checkedTopics,
      topicsCompletedPrevMonth: prevCheckedTopics,
    },
    tests: {
      count: tests.length,
      avgScorePct: avg(testPcts),
      prevMonthAvgScorePct: avg(prevTestPcts),
      list: tests.map((test) => ({
        title: test.title,
        date: dayOf(test.testDate),
        stage: test.examStage,
        subject: test.paperName ?? test.optionalSubject ?? null,
        scorePct: pct(test.score, test.totalMarks),
      })),
    },
    mood: {
      entries: moods.length,
      avgEnergy: avg(moods.map((mood) => mood.energy)),
      avgStress: avg(moods.map((mood) => mood.stress)),
      avgConfidence: avg(moods.map((mood) => mood.confidence)),
    },
    weekByWeek: weeklyHours,
  };
}

/**
 * Generate (or return existing) monthly review for the month containing `date`.
 * Called on the 1st for the PREVIOUS month (pass that date), or lazily.
 */
export async function generateMonthlyReview(date = new Date(), force = false) {
  const monthStart = istMonthStart(date);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

  const existing = await db.monthlyReview.findUnique({ where: { monthStart } });
  if (existing && !force) return { review: existing, created: false };

  const [stats, integrity] = await Promise.all([
    computeMonthlyStats(monthStart),
    computeIntegrityAudit(monthStart, monthEnd),
  ]);

  let viva: VivaQuestion[] = [];
  if (existing?.quizJson) {
    try {
      viva = JSON.parse(existing.quizJson).questions ?? [];
    } catch {
      viva = [];
    }
  }
  if (viva.length === 0) {
    viva = await generateVivaQuestions({
      rangeStart: monthStart,
      rangeEnd: monthEnd,
      count: 8,
      scopeLabel: "monthly report-card",
      mainsShare: 0.4,
    }).catch((error) => {
      console.error("[monthly-review] viva generation failed:", error);
      return [];
    });
  }

  const monthLabel = monthStart.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const prompt = `You are UPSC-GURU, Adarsh Tiwari's personal mentor, writing his monthly report card for ${monthLabel} (UPSC CSE 2027 prep, 3rd attempt, PSIR optional). This is the zoomed-out strategic review — month-scale trends, not day-scale noise. Mentor voice: direct, invested, occasionally tough.
Write in clean markdown with these exact sections:
## The Month in One Verdict
## Syllabus Movement
## Test Performance Trend
## Consistency & Discipline
## Honesty Audit
## Mood & Sustainability
## Strategy Corrections for Next Month
Rules: cite the actual numbers, compare against the previous month where data exists, max ~700 words.
- "Honesty Audit": use the INTEGRITY AUDIT — name flags with dates/numbers, reference his viva verification record, and state plainly whether you trust this month's logs. If clean, credit it.
- "Strategy Corrections": 3-5 strategic changes (subject sequencing, test frequency, revision cycles, answer-writing volume) — mentor-grade, specific to his data, each with a measurable target.

MONTH DATA (JSON):
${JSON.stringify(stats, null, 2)}

INTEGRITY AUDIT (JSON):
${JSON.stringify({ score: integrity.score, verdict: integrity.verdict, flags: integrity.flags, vivaVerification: integrity.vivaVerification }, null, 2)}`;

  const result = await generateTextResilient({
    prompt,
    temperature: 0.5,
    maxOutputTokens: 3072,
    timeoutMs: 150_000,
    modelEnvOverride: process.env.GOOGLE_AI_MODEL_REVIEW,
  });

  const quizJson = JSON.stringify({ questions: viva, summary: summarizeViva(viva) });
  const review = await db.monthlyReview.upsert({
    where: { monthStart },
    update: {
      reportText: result.text,
      statsJson: JSON.stringify(stats),
      integrityJson: JSON.stringify(integrity),
      quizJson,
    },
    create: {
      monthStart,
      reportText: result.text,
      statsJson: JSON.stringify(stats),
      integrityJson: JSON.stringify(integrity),
      quizJson,
      model: process.env.GOOGLE_AI_MODEL_REVIEW ?? process.env.GOOGLE_AI_MODEL_PRIMARY ?? "gemma-4-31b-it",
    },
  });

  return { review, created: true };
}
