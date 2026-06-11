import { getCrossExamStats } from "@/lib/agent-memory";
import { db } from "@/lib/db";

export type IntegrityFlag = {
  day: string | null;
  type:
    | "HOURS_MISMATCH"
    | "TODO_TIME_EXCEEDS_HOURS"
    | "IMPLAUSIBLE_DAY"
    | "INFLATED_DISCIPLINE"
    | "PERFECT_COMPLETION_LOW_HOURS"
    | "ROUND_NUMBER_BIAS"
    | "COPY_PASTE_LOGGING"
    | "CLAIMS_NOT_VERIFIED"
    | "VIVA_IGNORED";
  severity: "LOW" | "MEDIUM" | "HIGH";
  detail: string;
};

export type DaySignal = {
  day: string;
  dailyLogHours: number | null;
  studyLogHours: number | null;
  doneTodoMinutes: number;
  disciplineScore: number | null;
  completion: number | null;
  distractionHours: number | null;
};

export type IntegrityAudit = {
  rangeStart: string;
  rangeEnd: string;
  daysWithAnyLog: number;
  score: number;
  verdict: "TRUSTED" | "MINOR_GAPS" | "QUESTIONABLE";
  flags: IntegrityFlag[];
  daySignals: DaySignal[];
  vivaVerification: {
    asked: number;
    answered: number;
    ignored: number;
    accuracyPct: number | null;
  };
  note: string;
};

function dayOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

function distractionOf(log: {
  instagram: number;
  whatsapp: number;
  youtube: number;
  youtubeStudy: number;
  netflix: number;
  hotstar: number;
  mxPlayer: number;
  facebook: number;
  other: number;
}) {
  return (
    log.instagram +
    log.whatsapp +
    (log.youtube - log.youtubeStudy) +
    log.netflix +
    log.hotstar +
    log.mxPlayer +
    log.facebook +
    log.other
  );
}

/**
 * Cross-checks the user's self-reported logs against each other to estimate how
 * honest the logging is: daily-goal hours vs study-log hours vs the estimated
 * time of todos marked DONE vs screen-time, plus whether viva/cross-exam answers
 * back up the claimed study. Pure data heuristics — the AI mentor interprets it.
 */
export async function computeIntegrityAudit(rangeStart: Date, rangeEnd: Date): Promise<IntegrityAudit> {
  const [dailyLogs, studyLogs, doneTasks, screenTime, crossExam] = await Promise.all([
    db.dailyLog.findMany({
      where: { logDate: { gte: rangeStart, lt: rangeEnd } },
      select: { logDate: true, totalHours: true, disciplineScore: true, completion: true },
    }),
    db.studyLog.findMany({
      where: { logDate: { gte: rangeStart, lt: rangeEnd } },
      select: { logDate: true, hours: true },
    }),
    db.agentTask.findMany({
      where: { status: "DONE", updatedAt: { gte: rangeStart, lt: rangeEnd } },
      select: { updatedAt: true, estimatedMinutes: true, title: true },
    }),
    db.screenTimeLog.findMany({
      where: { logDate: { gte: rangeStart, lt: rangeEnd } },
      select: {
        logDate: true,
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

  const dailyByDay = new Map(dailyLogs.map((log) => [dayOf(log.logDate), log]));
  const studyHoursByDay = new Map<string, number>();
  for (const log of studyLogs) {
    const key = dayOf(log.logDate);
    studyHoursByDay.set(key, (studyHoursByDay.get(key) ?? 0) + log.hours);
  }
  const todoMinutesByDay = new Map<string, number>();
  for (const task of doneTasks) {
    const key = dayOf(task.updatedAt);
    todoMinutesByDay.set(key, (todoMinutesByDay.get(key) ?? 0) + (task.estimatedMinutes ?? 45));
  }
  const distractionByDay = new Map(screenTime.map((log) => [dayOf(log.logDate), Math.round(distractionOf(log) * 10) / 10]));

  const allDays = new Set([
    ...dailyByDay.keys(),
    ...studyHoursByDay.keys(),
    ...todoMinutesByDay.keys(),
  ]);

  const flags: IntegrityFlag[] = [];
  const daySignals: DaySignal[] = [];

  for (const day of [...allDays].sort()) {
    const daily = dailyByDay.get(day);
    const studyHours = studyHoursByDay.get(day) ?? null;
    const todoMinutes = todoMinutesByDay.get(day) ?? 0;
    const distraction = distractionByDay.get(day) ?? null;
    const claimedHours = daily?.totalHours ?? null;

    daySignals.push({
      day,
      dailyLogHours: claimedHours,
      studyLogHours: studyHours != null ? Math.round(studyHours * 10) / 10 : null,
      doneTodoMinutes: todoMinutes,
      disciplineScore: daily?.disciplineScore ?? null,
      completion: daily?.completion ?? null,
      distractionHours: distraction,
    });

    if (claimedHours != null && studyHours != null && Math.abs(claimedHours - studyHours) > 2) {
      flags.push({
        day,
        type: "HOURS_MISMATCH",
        severity: "MEDIUM",
        detail: `Daily goal log claims ${claimedHours}h but study logs add up to ${Math.round(studyHours * 10) / 10}h — a ${Math.round(Math.abs(claimedHours - studyHours) * 10) / 10}h gap.`,
      });
    }

    const todoHours = todoMinutes / 60;
    if (todoHours > 0 && claimedHours != null && todoHours > claimedHours + 1.5) {
      flags.push({
        day,
        type: "TODO_TIME_EXCEEDS_HOURS",
        severity: "MEDIUM",
        detail: `Todos marked DONE total ~${Math.round(todoHours * 10) / 10}h of estimated work, but only ${claimedHours}h of study was logged. Either the todos weren't really done or hours weren't logged honestly.`,
      });
    }

    if (claimedHours != null && (claimedHours > 13 || (distraction != null && claimedHours + distraction > 17))) {
      flags.push({
        day,
        type: "IMPLAUSIBLE_DAY",
        severity: "HIGH",
        detail: `${claimedHours}h study${distraction != null ? ` + ${distraction}h distraction screen time` : ""} is not a believable day. Honest logging beats heroic numbers.`,
      });
    }

    if (daily && daily.disciplineScore >= 9 && (claimedHours ?? 0) < 4) {
      flags.push({
        day,
        type: "INFLATED_DISCIPLINE",
        severity: "LOW",
        detail: `Discipline self-rated ${daily.disciplineScore}/10 on a ${claimedHours}h day — the score should reflect the work, not the intention.`,
      });
    }

    if (daily && daily.completion >= 100 && (claimedHours ?? 0) < 5) {
      flags.push({
        day,
        type: "PERFECT_COMPLETION_LOW_HOURS",
        severity: "LOW",
        detail: `100% completion claimed on only ${claimedHours}h — either the targets are too soft or the completion is cosmetic.`,
      });
    }
  }

  // Aggregate patterns over the range.
  const hourValues = dailyLogs.map((log) => log.totalHours).filter((hours) => hours > 0);
  if (hourValues.length >= 6) {
    const roundShare = hourValues.filter((hours) => Number.isInteger(hours)).length / hourValues.length;
    if (roundShare >= 0.85) {
      flags.push({
        day: null,
        type: "ROUND_NUMBER_BIAS",
        severity: "LOW",
        detail: `${Math.round(roundShare * 100)}% of logged days are perfectly round hours — usually a sign of estimating from memory instead of tracking.`,
      });
    }
  }
  let identicalRun = 1;
  const sortedDaily = [...dailyLogs].sort((a, b) => a.logDate.getTime() - b.logDate.getTime());
  for (let i = 1; i < sortedDaily.length; i += 1) {
    if (
      sortedDaily[i].totalHours === sortedDaily[i - 1].totalHours &&
      sortedDaily[i].disciplineScore === sortedDaily[i - 1].disciplineScore &&
      sortedDaily[i].totalHours > 0
    ) {
      identicalRun += 1;
      if (identicalRun === 4) {
        flags.push({
          day: dayOf(sortedDaily[i].logDate),
          type: "COPY_PASTE_LOGGING",
          severity: "LOW",
          detail: `4+ consecutive days with identical hours (${sortedDaily[i].totalHours}h) and discipline score — looks like copy-paste logging rather than real tracking.`,
        });
      }
    } else {
      identicalRun = 1;
    }
  }

  // Viva verification: do his answers back up his claimed study?
  const viva = crossExam.last30Days;
  const avgDiscipline =
    dailyLogs.length > 0
      ? dailyLogs.reduce((sum, log) => sum + log.disciplineScore, 0) / dailyLogs.length
      : null;
  if (viva.answered >= 4 && viva.accuracyPct != null && viva.accuracyPct < 50 && (avgDiscipline ?? 0) >= 7) {
    flags.push({
      day: null,
      type: "CLAIMS_NOT_VERIFIED",
      severity: "HIGH",
      detail: `Cross-exam accuracy is only ${viva.accuracyPct}% in the last 30 days while self-rated discipline averages ${Math.round((avgDiscipline ?? 0) * 10) / 10}/10. The logs say "studied"; the answers don't.`,
    });
  }
  if (viva.asked >= 5 && viva.ignored / viva.asked > 0.6) {
    flags.push({
      day: null,
      type: "VIVA_IGNORED",
      severity: "MEDIUM",
      detail: `${viva.ignored} of ${viva.asked} verification questions were ignored. Skipping the viva is itself a signal.`,
    });
  }

  let score = 100;
  for (const flag of flags) {
    score -= flag.severity === "HIGH" ? 15 : flag.severity === "MEDIUM" ? 8 : 3;
  }
  score = Math.max(0, score);

  return {
    rangeStart: dayOf(rangeStart),
    rangeEnd: dayOf(rangeEnd),
    daysWithAnyLog: allDays.size,
    score,
    verdict: score >= 85 ? "TRUSTED" : score >= 60 ? "MINOR_GAPS" : "QUESTIONABLE",
    flags,
    daySignals,
    vivaVerification: {
      asked: viva.asked,
      answered: viva.answered,
      ignored: viva.ignored,
      accuracyPct: viva.accuracyPct,
    },
    note: "Heuristic cross-check of self-reported data; flags are signals to discuss, not verdicts of dishonesty.",
  };
}

/** Today-only quick check used by the evening guard nudge. */
export async function auditToday() {
  const istMidnightUtc = new Date(
    Date.UTC(
      new Date(Date.now() + 5.5 * 3_600_000).getUTCFullYear(),
      new Date(Date.now() + 5.5 * 3_600_000).getUTCMonth(),
      new Date(Date.now() + 5.5 * 3_600_000).getUTCDate(),
    ),
  );
  const dayStartUTC = new Date(istMidnightUtc.getTime() - 5.5 * 3_600_000);
  const audit = await computeIntegrityAudit(dayStartUTC, new Date(dayStartUTC.getTime() + 86_400_000));
  return audit.flags.filter((flag) => flag.severity !== "LOW");
}
