import { db } from "@/lib/db";
import { isRetryableDbError, withDbRetry } from "@/lib/db-retry";
import { ensureSeeded } from "@/lib/seed";
import { computeReadiness, effectiveCoverage, type Readiness, type SyllabusCompletion } from "@/lib/readiness";
import { observedLevers, type Levers, type ModelInputs } from "@/lib/selection-model";

/**
 * Everything the Overview dashboard draws, computed from live records.
 * The result is plain JSON so client instruments can take it as props.
 */

const DAY = 86_400_000;
const PRELIMS_PAPERS = ["general-studies-1", "general-studies-2", "general-studies-3"];
const MAINS_PAPERS = ["general-studies-1", "general-studies-2", "general-studies-3", "general-studies-4", "psir", "essay"];

const SUBJECT_KEYS: Array<[string, RegExp]> = [
  ["Economy", /econom|budget|bank|inflation|mrunal/i],
  ["Polity", /polity|constitution|governance|laxmikanth/i],
  ["History", /history|modern|ancient|medieval|art|culture|heritage/i],
  ["Geography", /geograph|climate|map/i],
  ["Environment", /environment|ecology|biodivers/i],
  ["Science & Tech", /science|tech|s&t|space|biotech/i],
  ["Current Affairs", /current|ca\b|news/i],
];

export type HoursPoint = { date: string; hours: number; discipline: number; completion: number; focus: string };
export type PaperCoverage = { slug: string; title: string; leaves: number; done: number; revised: number; pct: number };
export type TestPoint = {
  id: string;
  title: string;
  date: string;
  stage: string;
  pct: number;
  cutoffPct: number | null;
  percentile: number | null;
  accuracy: number | null;
  attempt: number | null;
  correct: number;
  incorrect: number;
  skipped: number;
  negLost: number;
  subject: string | null;
};
export type Risk = { id: string; severity: "high" | "medium" | "low"; stage: string; title: string; detail: string; href: string };
export type Strength = { id: string; title: string; detail: string };

export type Insights = {
  generatedAt: string;
  prelimsDate: string;
  mainsDate: string;
  daysToPrelims: number;
  daysToMains: number;
  model: { inputs: ModelInputs; observed: Levers };
  hours: {
    series: HoursPoint[];
    total: number;
    perCalendarDay28: number;
    avgLogged: number;
    best: HoursPoint | null;
    streak8: number;
    todayHours: number;
    share8: number;
    last7: number;
    prev7: number;
    loggedDays: number;
  };
  coverage: {
    papers: PaperCoverage[];
    leaves: number;
    done: number;
    revised: number;
    timeline: Array<{ date: string; done: number }>;
    perWeek: number;
    prelimsLeaves: number;
    prelimsDone: number;
    neededPerDay: number;
  };
  tests: {
    list: TestPoint[];
    avgPct: number;
    recentPct: number;
    bestPct: number;
    accuracy: number | null;
    negLostTotal: number;
    subjects: string[];
  };
  mood: { entries: number; focus: number | null; stress: number | null; confidence: number | null; latest: string | null };
  syllabus: SyllabusCompletion;
  readiness: Readiness;
  risks: Risk[];
  strengths: Strength[];
};

const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function istTodayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function subjectOf(text: string) {
  for (const [name, re] of SUBJECT_KEYS) if (re.test(text)) return name;
  return null;
}

type TestRow = {
  id: string;
  title: string;
  examStage: string;
  paperName: string | null;
  testDate: Date;
  score: number;
  totalMarks: number;
  negativeMarks: number | null;
  cutoffTarget: number | null;
  percentile: number | null;
  correctQuestions: number | null;
  incorrectQuestions: number | null;
  attemptedQuestions: number | null;
  totalQuestions: number;
};

/** One test as the test lab draws it: score vs cut-off, accuracy, negatives. */
export function toTestPoint(t: TestRow): TestPoint {
  const pct = t.totalMarks > 0 ? t.score / t.totalMarks : 0;
  const total = t.totalQuestions || 0;
  const attempted = t.attemptedQuestions ?? ((t.correctQuestions ?? 0) + (t.incorrectQuestions ?? 0) || null);
  const correct = t.correctQuestions ?? 0;
  const incorrect = t.incorrectQuestions ?? 0;
  const perQ = total > 0 ? t.totalMarks / total : 2;
  const negLost = t.negativeMarks ?? incorrect * (perQ / 3);
  return {
    id: t.id,
    title: t.title,
    date: dateKey(t.testDate),
    stage: t.examStage,
    pct,
    cutoffPct: t.cutoffTarget && t.totalMarks > 0 ? t.cutoffTarget / t.totalMarks : null,
    percentile: t.percentile ?? null,
    accuracy: attempted ? correct / attempted : null,
    attempt: attempted && total ? attempted / total : null,
    correct,
    incorrect,
    skipped: Math.max(0, total - (attempted ?? 0)),
    negLost: Math.round(negLost * 100) / 100,
    subject: subjectOf(`${t.title} ${t.paperName ?? ""}`),
  };
}

export async function getInsights(): Promise<Insights | null> {
  try {
    await ensureSeeded();
    const [nodes, dailyLogs, tests, moods, essays, writtenLogs, questionSubjects] = await withDbRetry(() =>
      Promise.all([
        db.studyNode.findMany({
          select: {
            id: true,
            parentId: true,
            slug: true,
            title: true,
            sortOrder: true,
            topicProgress: { select: { checked: true, checkedAt: true, revisionCount: true } },
          },
        }),
        db.dailyLog.findMany({
          orderBy: { logDate: "asc" },
          select: { logDate: true, totalHours: true, disciplineScore: true, completion: true, primaryFocus: true },
        }),
        db.testRecord.findMany({
          orderBy: { testDate: "asc" },
          select: {
            id: true,
            title: true,
            examStage: true,
            testType: true,
            paperCode: true,
            paperName: true,
            testDate: true,
            score: true,
            totalMarks: true,
            negativeMarks: true,
            cutoffTarget: true,
            percentile: true,
            correctQuestions: true,
            incorrectQuestions: true,
            attemptedQuestions: true,
            totalQuestions: true,
          },
        }),
        db.moodEntry.findMany({ orderBy: { moodDate: "desc" }, take: 30, select: { moodDate: true, focus: true, stress: true, confidence: true, label: true } }),
        db.essaySubmission.count(),
        db.testQuestionLog.count({ where: { questionType: { not: "OBJECTIVE" } } }),
        db.testQuestionLog.groupBy({ by: ["subject"], _count: true }),
      ]),
    );

    const now = new Date();
    const prelimsDate = process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30";
    const mainsDate = process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30";
    const daysToPrelims = Math.max(0, Math.ceil((new Date(prelimsDate).getTime() - now.getTime()) / DAY));
    const daysToMains = Math.max(0, Math.ceil((new Date(mainsDate).getTime() - now.getTime()) / DAY));
    const todayKey = istTodayKey(now);

    /* ── Syllabus coverage ─────────────────────────────────────────── */
    const children = new Map<string, string[]>();
    for (const n of nodes) if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n.id]);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const roots = nodes.filter((n) => !n.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

    const checkDates: number[] = [];
    let undated = 0;
    const papers: PaperCoverage[] = [];
    for (const root of roots) {
      const queue = [...(children.get(root.id) ?? [])];
      let leaves = 0;
      let done = 0;
      let revised = 0;
      while (queue.length) {
        const id = queue.shift()!;
        const kids = children.get(id) ?? [];
        if (kids.length) {
          queue.push(...kids);
          continue;
        }
        leaves += 1;
        const tp = byId.get(id)?.topicProgress;
        if (tp?.checked) {
          done += 1;
          if (tp.checkedAt) checkDates.push(tp.checkedAt.getTime());
          else undated += 1;
        }
        if ((tp?.revisionCount ?? 0) > 0) revised += 1;
      }
      if (leaves === 0) continue;
      papers.push({ slug: root.slug, title: root.title, leaves, done, revised, pct: done / leaves });
    }
    const leaves = papers.reduce((s, p) => s + p.leaves, 0);
    const done = papers.reduce((s, p) => s + p.done, 0);
    const revised = papers.reduce((s, p) => s + p.revised, 0);
    const sumOf = (slugs: string[], key: "leaves" | "done") => papers.filter((p) => slugs.includes(p.slug)).reduce((s, p) => s + p[key], 0);
    const prelimsLeaves = sumOf(PRELIMS_PAPERS, "leaves");
    const prelimsDone = sumOf(PRELIMS_PAPERS, "done");
    const mainsLeaves = sumOf(MAINS_PAPERS, "leaves");
    const mainsDone = sumOf(MAINS_PAPERS, "done");

    // Weekly cumulative ticks, from the first tick to today.
    checkDates.sort((a, b) => a - b);
    const timeline: Array<{ date: string; done: number }> = [];
    if (checkDates.length || undated) {
      const start = checkDates[0] ?? now.getTime();
      let i = 0;
      let running = undated;
      for (let t = start; t <= now.getTime() + 7 * DAY; t += 7 * DAY) {
        const cap = Math.min(t, now.getTime());
        while (i < checkDates.length && checkDates[i] <= cap) {
          running += 1;
          i += 1;
        }
        timeline.push({ date: dateKey(new Date(cap)), done: running });
        if (cap === now.getTime()) break;
      }
    }
    const ticks28 = checkDates.filter((t) => t >= now.getTime() - 28 * DAY).length;
    const ticks84 = checkDates.filter((t) => t >= now.getTime() - 84 * DAY).length;
    const topicsPerDay = Math.max(ticks28 / 28, ticks84 / 84);
    const neededPerDay = daysToPrelims > 0 ? Math.max(0, prelimsLeaves - prelimsDone) / daysToPrelims : 0;

    /* ── Hours ─────────────────────────────────────────────────────── */
    const series: HoursPoint[] = dailyLogs.map((log) => ({
      date: dateKey(log.logDate),
      hours: Math.round(log.totalHours * 100) / 100,
      discipline: log.disciplineScore,
      completion: log.completion,
      focus: log.primaryFocus,
    }));
    const hoursByKey = new Map(series.map((p) => [p.date, p.hours]));
    // Daily logs are the canonical hours record (study sessions roll up into them).
    const totalHours = series.reduce((s, p) => s + p.hours, 0);
    const sumWindow = (fromBack: number, len: number) => {
      let sum = 0;
      for (let d = fromBack; d < fromBack + len; d++) sum += hoursByKey.get(shiftKey(todayKey, -d)) ?? 0;
      return sum;
    };
    const perCalendarDay28 = sumWindow(0, 28) / 28;
    const todayHours = hoursByKey.get(todayKey) ?? 0;
    let cursor = todayHours >= 8 ? todayKey : shiftKey(todayKey, -1);
    let streak8 = 0;
    while ((hoursByKey.get(cursor) ?? 0) >= 8) {
      streak8 += 1;
      cursor = shiftKey(cursor, -1);
    }
    const best = series.reduce<HoursPoint | null>((b, p) => (!b || p.hours > b.hours ? p : b), null);
    const share8 = series.length ? series.filter((p) => p.hours >= 8).length / series.length : 0;
    const last7 = sumWindow(0, 7) / 7;
    const prev7 = sumWindow(7, 7) / 7;

    /* ── Tests ─────────────────────────────────────────────────────── */
    const list: TestPoint[] = tests.map(toTestPoint);
    const prelimsTests = list.filter((t) => t.stage === "PRELIMS" && !/csat/i.test(t.title));
    const csatTests = tests.filter((t) => /csat/i.test(`${t.title} ${t.paperCode ?? ""} ${t.testType}`));
    // Recency-weighted: the latest test counts most.
    let wSum = 0;
    let wScore = 0;
    prelimsTests.forEach((t, i) => {
      const w = Math.pow(0.72, prelimsTests.length - 1 - i);
      wSum += w;
      wScore += w * t.pct;
    });
    const withQ = prelimsTests.filter((t) => t.accuracy !== null);
    const sumCorrect = withQ.reduce((s, t) => s + t.correct, 0);
    const sumAttempted = withQ.reduce((s, t) => s + t.correct + t.incorrect, 0);
    const sumTotal = withQ.reduce((s, t) => s + t.correct + t.incorrect + t.skipped, 0);
    const subjects = new Set<string>();
    for (const t of list) if (t.subject) subjects.add(t.subject);
    for (const q of questionSubjects) {
      const s = q.subject ? subjectOf(q.subject) : null;
      if (s) subjects.add(s);
    }
    const testsLast60 = tests.filter((t) => t.testDate.getTime() >= now.getTime() - 60 * DAY).length;
    const tests30 = tests.filter((t) => t.testDate.getTime() >= now.getTime() - 30 * DAY).length;

    /* ── Mood ──────────────────────────────────────────────────────── */
    const confidence = moods.length ? avg(moods.slice(0, 10).map((m) => m.confidence)) / 10 : null;

    /* ── Model inputs ──────────────────────────────────────────────── */
    const checkedRevisions = nodes.filter((n) => n.topicProgress?.checked).map((n) => n.topicProgress!.revisionCount);
    const inputs: ModelInputs = {
      daysToPrelims,
      daysToMains,
      prelimsLeaves,
      prelimsDone,
      mainsLeaves,
      mainsDone,
      hoursSoFar: totalHours,
      prelimsTestScore: wSum ? wScore / wSum : null,
      prelimsTestCount: prelimsTests.length,
      testedSubjects: subjects.size,
      observedAccuracy: sumAttempted ? sumCorrect / sumAttempted : null,
      observedAttemptRate: sumTotal ? sumAttempted / sumTotal : null,
      csatScore: csatTests.length ? avg(csatTests.map((t) => (t.totalMarks ? t.score / t.totalMarks : 0))) : null,
      mainsEvidence: tests.filter((t) => t.examStage === "MAINS").length + essays + writtenLogs / 10,
      confidence,
    };
    const observed = observedLevers(inputs, {
      hoursPerDay: perCalendarDay28,
      topicsPerDay,
      testsPerMonth: testsLast60 / 2,
      revisionPasses: avg(checkedRevisions),
    });

    /* ── Risk register ─────────────────────────────────────────────── */
    const risks: Risk[] = [];
    const tickShare = leaves ? done / leaves : 0;
    if (inputs.hoursSoFar > 250 && tickShare < 0.15) {
      risks.push({
        id: "stale-map",
        severity: "medium",
        stage: "All stages",
        title: "Your syllabus map lags your study",
        detail: `${Math.round(inputs.hoursSoFar)}h logged, but only ${done} of ${leaves.toLocaleString("en-IN")} topics ticked (${(tickShare * 100).toFixed(1)}%). Until ticks catch up, coverage is inferred from hours — tick what you've finished to sharpen every estimate here.`,
        href: "/study/general-studies-1",
      });
    }
    if (neededPerDay > 0 && topicsPerDay < neededPerDay * 0.5) {
      risks.push({
        id: "pace",
        severity: "high",
        stage: "Prelims",
        title: "Ticking pace won't close GS 1–3 before Prelims",
        detail: `${(topicsPerDay * 7).toFixed(0)} topics/week now; ${Math.ceil(neededPerDay * 7)}/week needed to finish the remaining ${(prelimsLeaves - prelimsDone).toLocaleString("en-IN")} prelims topics in ${daysToPrelims} days.`,
        href: "/study/general-studies-2",
      });
    }
    if (tests30 < 4) {
      risks.push({
        id: "mock-volume",
        severity: daysToPrelims < 150 ? "high" : "medium",
        stage: "Prelims",
        title: "Too few mocks to read your real level",
        detail: `${tests30} test${tests30 === 1 ? "" : "s"} in the last 30 days. Prelims is decided by full-length practice — aim for at least one a week now, two a week from January.`,
        href: "/tests",
      });
    }
    if (subjects.size <= 3) {
      const missing = SUBJECT_KEYS.map(([n]) => n).filter((n) => !subjects.has(n) && n !== "Current Affairs");
      risks.push({
        id: "breadth",
        severity: "high",
        stage: "Prelims",
        title: "Tests cover a narrow slice of GS",
        detail: `Evidence so far: ${[...subjects].join(", ") || "none"}. Untested: ${missing.slice(0, 5).join(", ")}. Sectional scores overstate a full GS paper.`,
        href: "/tests",
      });
    }
    if (sumAttempted && (sumAttempted - sumCorrect) / sumAttempted > 0.2) {
      const lost = list.reduce((s, t) => s + t.negLost, 0);
      risks.push({
        id: "negatives",
        severity: "medium",
        stage: "Prelims",
        title: "Negative marking is eating your score",
        detail: `${Math.round(((sumAttempted - sumCorrect) / sumAttempted) * 100)}% of attempts wrong → ${lost.toFixed(1)} marks lost across ${list.length} tests. Tighten elimination before adding attempts.`,
        href: "/tests/error-analysis",
      });
    }
    if (!csatTests.length) {
      risks.push({
        id: "csat",
        severity: "medium",
        stage: "Prelims",
        title: "CSAT is unmeasured",
        detail: "CSAT only needs 33%, but it has ended strong attempts. Log one timed CSAT paper a fortnight to rule it out.",
        href: "/study/csat",
      });
    }
    if (inputs.mainsEvidence < 3) {
      risks.push({
        id: "writing",
        severity: daysToMains < 240 ? "high" : "medium",
        stage: "Mains",
        title: "No answer-writing evidence yet",
        detail: `${essays} essays and ${tests.filter((t) => t.examStage === "MAINS").length} Mains tests logged. Mains is a writing exam — start 3 answers a day on finished topics.`,
        href: "/ai-insight/essay-checker",
      });
    }
    if (done > 20 && revised / done < 0.3) {
      risks.push({
        id: "revision",
        severity: "medium",
        stage: "Prelims",
        title: "Finished topics aren't being revised",
        detail: `${revised} of ${done} ticked topics revised (${Math.round((revised / done) * 100)}%). Without spaced revision, recall at Prelims drops sharply.`,
        href: "/study/general-studies-3",
      });
    }
    const missing14 = Array.from({ length: 14 }, (_, d) => shiftKey(todayKey, -d - 1)).filter((k) => !hoursByKey.has(k)).length;
    if (missing14 >= 4) {
      risks.push({
        id: "gaps",
        severity: missing14 >= 7 ? "high" : "medium",
        stage: "Discipline",
        title: "Gaps in the daily log",
        detail: `${missing14} of the last 14 days have no log. Unlogged days can't count toward streaks or the model.`,
        href: "/goals",
      });
    }
    if (prev7 > 0 && last7 < prev7 * 0.85) {
      risks.push({
        id: "dip",
        severity: "low",
        stage: "Discipline",
        title: "Hours dipped this week",
        detail: `${last7.toFixed(1)}h/day this week vs ${prev7.toFixed(1)}h/day the week before.`,
        href: "/goals",
      });
    }
    const recentLogs = series.slice(-10);
    const noDiscipline = recentLogs.filter((p) => p.discipline === 0).length;
    if (noDiscipline >= 4) {
      risks.push({
        id: "discipline-missing",
        severity: "low",
        stage: "Discipline",
        title: "Discipline score often left blank",
        detail: `${noDiscipline} of your last ${recentLogs.length} logs have discipline at 0, which drags the readiness signals.`,
        href: "/goals",
      });
    }
    const moods30 = moods.filter((m) => m.moodDate.getTime() >= now.getTime() - 30 * DAY).length;
    if (moods30 < 4) {
      risks.push({
        id: "mood",
        severity: "low",
        stage: "Interview",
        title: "Mood and confidence barely logged",
        detail: `${moods30} check-ins in 30 days. Burnout shows up here first — a 20-second check-in is enough.`,
        href: "/mood",
      });
    }
    /* ── Syllabus completion & readiness today ──────────────────────── */
    const syllabus: SyllabusCompletion = {
      leaves,
      done,
      revised,
      ticked: tickShare,
      revisedShare: leaves ? revised / leaves : 0,
      effective: effectiveCoverage(tickShare, totalHours),
      hours: totalHours,
      prelims: prelimsLeaves ? prelimsDone / prelimsLeaves : 0,
      mains: mainsLeaves ? mainsDone / mainsLeaves : 0,
    };
    const loggedDays28 = Array.from({ length: 28 }, (_, d) => shiftKey(todayKey, -d)).filter((k) => (hoursByKey.get(k) ?? 0) > 0).length;
    const stress10 = moods.length ? avg(moods.slice(0, 10).map((m) => m.stress)) : null;
    const readiness = computeReadiness({
      syllabus,
      avgRevisionPasses: avg(checkedRevisions),
      testScore: inputs.prelimsTestScore,
      testCount: list.length,
      prelimsTests: prelimsTests.length,
      tests30,
      testedSubjects: subjects.size,
      accuracy: inputs.observedAccuracy,
      mainsEvidence: inputs.mainsEvidence,
      hoursPerDay28: perCalendarDay28,
      loggedDays28,
      confidence,
      stress: stress10,
    });

    const order = { high: 0, medium: 1, low: 2 } as const;
    risks.sort((a, b) => order[a.severity] - order[b.severity]);

    /* ── Strengths ─────────────────────────────────────────────────── */
    const strengths: Strength[] = [];
    const avgLogged = avg(series.map((p) => p.hours));
    if (avgLogged >= 7.5) strengths.push({ id: "volume", title: `${avgLogged.toFixed(1)}h average on logged days`, detail: `${Math.round(share8 * 100)}% of ${series.length} logged days cleared 8 hours.` });
    if (streak8 >= 3) strengths.push({ id: "streak", title: `${streak8}-day 8h streak`, detail: "The chain is live — protect it." });
    const lastTest = list.at(-1);
    if (lastTest && lastTest.accuracy !== null && lastTest.accuracy >= 0.8) strengths.push({ id: "accuracy", title: `${Math.round(lastTest.accuracy * 100)}% accuracy in your latest test`, detail: lastTest.title });
    const bestPerc = list.reduce((m, t) => Math.max(m, t.percentile ?? 0), 0);
    if (bestPerc >= 75) strengths.push({ id: "percentile", title: `Best percentile ${bestPerc.toFixed(0)}`, detail: "You can beat most of a test cohort on a good day." });
    const strongPaper = [...papers].sort((a, b) => b.pct - a.pct)[0];
    if (strongPaper && strongPaper.pct > 0.05) strengths.push({ id: "paper", title: `${strongPaper.title} leads coverage`, detail: `${Math.round(strongPaper.pct * 100)}% ticked.` });

    return {
      generatedAt: now.toISOString(),
      prelimsDate,
      mainsDate,
      daysToPrelims,
      daysToMains,
      model: { inputs, observed },
      hours: {
        series,
        total: totalHours,
        perCalendarDay28,
        avgLogged,
        best,
        streak8,
        todayHours,
        share8,
        last7,
        prev7,
        loggedDays: series.length,
      },
      coverage: { papers, leaves, done, revised, timeline, perWeek: topicsPerDay * 7, prelimsLeaves, prelimsDone, neededPerDay },
      tests: {
        list,
        avgPct: avg(list.map((t) => t.pct)),
        recentPct: avg(list.slice(-3).map((t) => t.pct)),
        bestPct: list.reduce((m, t) => Math.max(m, t.pct), 0),
        accuracy: inputs.observedAccuracy,
        negLostTotal: list.reduce((s, t) => s + t.negLost, 0),
        subjects: [...subjects],
      },
      mood: {
        entries: moods.length,
        focus: moods.length ? avg(moods.slice(0, 10).map((m) => m.focus)) : null,
        stress: moods.length ? avg(moods.slice(0, 10).map((m) => m.stress)) : null,
        confidence: confidence === null ? null : confidence * 10,
        latest: moods[0]?.label ?? null,
      },
      syllabus,
      readiness,
      risks,
      strengths,
    };
  } catch (error) {
    if (!isRetryableDbError(error)) throw error;
    console.error("[insights]", error);
    return null;
  }
}
