import { db } from "@/lib/db";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type TestDailyLogInput = {
  testDate: Date;
  timeMinutes: number | null;
  attemptedQuestions: number | null;
  totalQuestions: number;
};

export function istDailyLogKey(date: Date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

function contribution(test: TestDailyLogInput) {
  return {
    hours: Math.max(0, (test.timeMinutes ?? 0) / 60),
    questions: Math.max(0, test.attemptedQuestions ?? test.totalQuestions ?? 0),
  };
}

function roundHours(value: number) {
  return Math.max(0, Number(value.toFixed(2)));
}

async function applyDailyLogDelta(
  logDate: Date,
  deltaHours: number,
  deltaQuestions: number,
  options: { createIfMissing: boolean },
) {
  if (deltaHours === 0 && deltaQuestions === 0) return;

  const existing = await db.dailyLog.findUnique({ where: { logDate } });
  if (!existing) {
    if (!options.createIfMissing || (deltaHours <= 0 && deltaQuestions <= 0)) return;

    await db.dailyLog.create({
      data: {
        logDate,
        primaryFocus: "Mock test",
        totalHours: roundHours(deltaHours),
        questionsSolved: Math.max(0, Math.round(deltaQuestions)),
        topicsStudied: 0,
        subjectsCovered: "Mock test",
        wins: "",
        blockers: "",
        tomorrowPlan: "",
        disciplineScore: 0,
        completion: 0,
      },
    });
    return;
  }

  await db.dailyLog.update({
    where: { id: existing.id },
    data: {
      totalHours: roundHours(existing.totalHours + deltaHours),
      questionsSolved: Math.max(0, Math.round(existing.questionsSolved + deltaQuestions)),
    },
  });
}

export async function syncDailyLogForTestCreate(test: TestDailyLogInput) {
  const { hours, questions } = contribution(test);
  await applyDailyLogDelta(istDailyLogKey(test.testDate), hours, questions, { createIfMissing: true });
}

export async function syncDailyLogForTestUpdate(previous: TestDailyLogInput, next: TestDailyLogInput) {
  const previousKey = istDailyLogKey(previous.testDate).getTime();
  const nextKey = istDailyLogKey(next.testDate).getTime();
  const before = contribution(previous);
  const after = contribution(next);

  if (previousKey === nextKey) {
    const existing = await db.dailyLog.findUnique({ where: { logDate: new Date(nextKey) } });
    if (!existing) {
      await applyDailyLogDelta(new Date(nextKey), after.hours, after.questions, { createIfMissing: true });
      return;
    }

    await applyDailyLogDelta(
      new Date(nextKey),
      after.hours - before.hours,
      after.questions - before.questions,
      { createIfMissing: true },
    );
    return;
  }

  await applyDailyLogDelta(new Date(previousKey), -before.hours, -before.questions, { createIfMissing: false });
  await applyDailyLogDelta(new Date(nextKey), after.hours, after.questions, { createIfMissing: true });
}

export async function syncDailyLogForTestDelete(test: TestDailyLogInput) {
  const { hours, questions } = contribution(test);
  await applyDailyLogDelta(istDailyLogKey(test.testDate), -hours, -questions, { createIfMissing: false });
}
