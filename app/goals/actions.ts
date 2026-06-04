"use server";

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { requireSession } from "@/lib/auth";
import { buildUPSCContext } from "@/lib/ai-context-builder";
import { normalizeGoogleModelId } from "@/lib/ai-models";
import { db } from "@/lib/db";

const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    "",
});

async function generateWithFallback(prompt: string, system: string) {
  const candidates = [
    process.env.GOOGLE_AI_MODEL_ANALYTICS,
    process.env.GOOGLE_AI_MODEL_PRIMARY,
    process.env.GOOGLE_AI_MODEL_FALLBACK,
    process.env.GOOGLE_AI_MODEL_SECOND_FALLBACK,
    "gemma-3-27b-it",
    "gemma-3-12b-it",
  ].filter(Boolean) as string[];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const result = await generateText({
        model: google(normalizeGoogleModelId(candidate)),
        system,
        prompt,
        temperature: 0.45,
        maxOutputTokens: 2200,
      });
      return { text: result.text, model: normalizeGoogleModelId(candidate) };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("All AI models failed");
}

// ── Deterministic "own logic" pre-pass ──────────────────────────────
// Rigorous hour scoring: only 8h+ is good, 12h+ is peak.
export type GoalsMetrics = {
  windowDays: number;
  loggedDays: number;
  avgHours: number;
  goodDays: number;
  peakDays: number;
  belowParDays: number;
  consistencyPct: number; // share of logged days that hit 8h+
  disciplineAvg: number;
  completionAvg: number;
  momentumScore: number; // 0-100 composite
  momentumVerdict: "PEAK" | "STRONG" | "BUILDING" | "DRIFTING" | "STALLED";
  hoursDebt: number; // cumulative hours below the 8h bar over the window
};

export type StaleArea = { area: string; signal: string; lastTouched: string; priority: "HIGH" | "MEDIUM" | "LOW" };

export type DistractionRead = {
  loggedDays: number;
  avgPerDay: number;
  totalDistraction: number;
  studyYouTube: number;
  highDays: number; // days with >= 3h distraction
  topApp: string | null;
  topAppHours: number;
  onLowStudyDays: number; // avg distraction on sub-8h study days
  onGoodStudyDays: number; // avg distraction on 8h+ study days
  verdict: "CLEAN" | "WATCH" | "LEAKING" | "OUT_OF_CONTROL";
};

export type GoalsInsight = {
  metrics: GoalsMetrics;
  distraction: DistractionRead | null;
  computedStale: StaleArea[];
  ai: {
    headline: string;
    momentumRead: string;
    reviseNow: Array<{ area: string; reason: string; priority: "HIGH" | "MEDIUM" | "LOW" }>;
    studyNext: Array<{ area: string; reason: string }>;
    distractionVerdict?: string;
    habitFix: { strength: string; fix: string };
    weeklyTargets: Array<{ label: string; target: string }>;
    closingNote: string;
  } | null;
  model: string;
  generatedAt: string;
  error?: string;
};

type DailyLogLite = {
  logDate: Date;
  totalHours: number;
  disciplineScore: number;
  completion: number;
  subjectsCovered: string | null;
};

function computeMetrics(logs: DailyLogLite[]): GoalsMetrics {
  const window = logs.slice(0, 30);
  const loggedDays = window.length;
  const totalHours = window.reduce((s, l) => s + l.totalHours, 0);
  const avgHours = loggedDays ? Number((totalHours / loggedDays).toFixed(1)) : 0;
  const goodDays = window.filter((l) => l.totalHours >= 8).length;
  const peakDays = window.filter((l) => l.totalHours >= 12).length;
  const belowParDays = window.filter((l) => l.totalHours > 0 && l.totalHours < 8).length;
  const consistencyPct = loggedDays ? Math.round((goodDays / loggedDays) * 100) : 0;
  const disciplineAvg = loggedDays ? Math.round(window.reduce((s, l) => s + l.disciplineScore, 0) / loggedDays) : 0;
  const completionAvg = loggedDays ? Math.round(window.reduce((s, l) => s + l.completion, 0) / loggedDays) : 0;
  const hoursDebt = Number(window.reduce((s, l) => s + Math.max(0, 8 - l.totalHours), 0).toFixed(1));

  // Composite momentum: weighted toward the rigorous 8h bar + recent depth + discipline.
  const recent7 = window.slice(0, 7);
  const recentAvg = recent7.length ? recent7.reduce((s, l) => s + l.totalHours, 0) / recent7.length : 0;
  const depthScore = Math.min(100, (recentAvg / 12) * 100);
  const momentumScore = Math.round(0.5 * consistencyPct + 0.3 * depthScore + 0.2 * disciplineAvg);

  let momentumVerdict: GoalsMetrics["momentumVerdict"] = "STALLED";
  if (momentumScore >= 85) momentumVerdict = "PEAK";
  else if (momentumScore >= 68) momentumVerdict = "STRONG";
  else if (momentumScore >= 48) momentumVerdict = "BUILDING";
  else if (momentumScore >= 25) momentumVerdict = "DRIFTING";

  return {
    windowDays: 30,
    loggedDays,
    avgHours,
    goodDays,
    peakDays,
    belowParDays,
    consistencyPct,
    disciplineAvg,
    completionAvg,
    momentumScore,
    momentumVerdict,
    hoursDebt,
  };
}

const DISTRACTION_COLS = [
  "instagram",
  "whatsapp",
  "youtube",
  "facebook",
  "netflix",
  "hotstar",
  "mxPlayer",
  "google",
  "other",
] as const;

const APP_LABELS: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  facebook: "Facebook",
  netflix: "Netflix",
  hotstar: "Hotstar",
  mxPlayer: "MX Player",
  google: "Google / browsing",
  other: "Other apps",
};

type ScreenRow = Record<string, unknown> & { logDate: Date };

function istKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  return `${y}-${m}-${d}`;
}

function computeDistraction(logs: DailyLogLite[], screen: ScreenRow[]): DistractionRead | null {
  if (!screen.length) return null;

  const studyByDate = new Map<string, number>();
  for (const log of logs) studyByDate.set(istKey(log.logDate), log.totalHours);

  let totalDistraction = 0;
  let studyYouTube = 0;
  let highDays = 0;
  const appTotals: Record<string, number> = {};
  let lowDaysDistraction = 0;
  let lowDaysCount = 0;
  let goodDaysDistraction = 0;
  let goodDaysCount = 0;

  for (const row of screen) {
    let dayDistraction = 0;
    for (const col of DISTRACTION_COLS) {
      const v = Number(row[col]) || 0;
      dayDistraction += v;
      appTotals[col] = (appTotals[col] ?? 0) + v;
    }
    studyYouTube += Number(row.youtubeStudy) || 0;
    totalDistraction += dayDistraction;
    if (dayDistraction >= 3) highDays += 1;

    const study = studyByDate.get(istKey(row.logDate));
    if (study !== undefined) {
      if (study < 8) {
        lowDaysDistraction += dayDistraction;
        lowDaysCount += 1;
      } else {
        goodDaysDistraction += dayDistraction;
        goodDaysCount += 1;
      }
    }
  }

  const loggedDays = screen.length;
  const avgPerDay = Number((totalDistraction / loggedDays).toFixed(2));
  const topEntry = Object.entries(appTotals).sort((a, b) => b[1] - a[1])[0];

  let verdict: DistractionRead["verdict"] = "CLEAN";
  if (avgPerDay >= 4) verdict = "OUT_OF_CONTROL";
  else if (avgPerDay >= 2.5) verdict = "LEAKING";
  else if (avgPerDay >= 1.25) verdict = "WATCH";

  return {
    loggedDays,
    avgPerDay,
    totalDistraction: Number(totalDistraction.toFixed(1)),
    studyYouTube: Number(studyYouTube.toFixed(1)),
    highDays,
    topApp: topEntry && topEntry[1] > 0 ? APP_LABELS[topEntry[0]] ?? topEntry[0] : null,
    topAppHours: topEntry ? Number(topEntry[1].toFixed(1)) : 0,
    onLowStudyDays: lowDaysCount ? Number((lowDaysDistraction / lowDaysCount).toFixed(2)) : 0,
    onGoodStudyDays: goodDaysCount ? Number((goodDaysDistraction / goodDaysCount).toFixed(2)) : 0,
    verdict,
  };
}

function safeParse(raw: string): GoalsInsight["ai"] | null {
  try {
    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function generateGoalsInsightAction(): Promise<GoalsInsight> {
  await requireSession();

  const [logs, subjectNodes, screenLogs] = await Promise.all([
    db.dailyLog.findMany({
      orderBy: { logDate: "desc" },
      take: 120,
      select: { logDate: true, totalHours: true, disciplineScore: true, completion: true, subjectsCovered: true },
    }) as Promise<DailyLogLite[]>,
    db.studyNode.findMany({ where: { type: "SUBJECT" }, select: { title: true } }),
    db.screenTimeLog.findMany({ orderBy: { logDate: "desc" }, take: 60 }),
  ]);

  const metrics = computeMetrics(logs);
  const distraction = computeDistraction(logs, screenLogs);

  const ctx = await buildUPSCContext();

  // ── Own logic: build the stale-area shortlist deterministically ──
  const computedStale: StaleArea[] = [];

  // Per-subject staleness — when was each syllabus subject last tagged in a daily log?
  const DAY_MS = 86_400_000;
  const now = Date.now();
  const subjectLastSeen = new Map<string, number>();
  for (const log of logs) {
    if (!log.subjectsCovered) continue;
    const day = log.logDate.getTime();
    for (const raw of log.subjectsCovered.split(",")) {
      const tag = raw.trim().toLowerCase();
      if (!tag) continue;
      if (!subjectLastSeen.has(tag) || day > subjectLastSeen.get(tag)!) subjectLastSeen.set(tag, day);
    }
  }

  const subjectCoverage = subjectNodes
    .map((node) => {
      const seen = subjectLastSeen.get(node.title.toLowerCase());
      const daysSince = seen ? Math.floor((now - seen) / DAY_MS) : null;
      return { subject: node.title, daysSince };
    })
    .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));

  for (const cov of subjectCoverage) {
    const stale = cov.daysSince === null || cov.daysSince >= 10;
    if (!stale) continue;
    computedStale.push({
      area: cov.subject,
      signal: cov.daysSince === null ? "never logged as covered" : `last touched ${cov.daysSince} days ago`,
      lastTouched: cov.daysSince === null ? "no record" : `${cov.daysSince}d gap`,
      priority: cov.daysSince === null || cov.daysSince >= 21 ? "HIGH" : "MEDIUM",
    });
  }

  // Papers with low completion + thin recent activity = neglected zones.
  for (const paper of ctx.papers ?? []) {
    const stale = paper.completionPct < 55;
    const cold = !paper.recentTopics || paper.recentTopics.length === 0;
    if (stale || cold) {
      computedStale.push({
        area: paper.title,
        signal: `${paper.completionPct}% complete · ${paper.recentTopics?.length ?? 0} recent topics · ${paper.totalHours}h logged`,
        lastTouched: cold ? "no recent touches" : "thin activity",
        priority: paper.completionPct < 40 ? "HIGH" : "MEDIUM",
      });
    }
  }

  // Least-revised topics straight from the revision tracker.
  for (const topic of ctx.revisionSummary?.leastRevised?.slice(0, 5) ?? []) {
    computedStale.push({
      area: topic.chapter ? `${topic.chapter} → ${topic.topic}` : topic.topic,
      signal: `${topic.count} revision${topic.count === 1 ? "" : "s"} on record`,
      lastTouched: "long gap",
      priority: topic.count === 0 ? "HIGH" : "LOW",
    });
  }

  // Weak subjects from the question-error tracker.
  for (const w of ctx.questionErrorSummary?.weakSubjects?.slice(0, 4) ?? []) {
    computedStale.push({
      area: w.subject,
      signal: `${w.accuracy}% accuracy · ${w.mistakes} mistakes of ${w.total} logged`,
      lastTouched: "active weakness",
      priority: w.accuracy < 50 ? "HIGH" : "MEDIUM",
    });
  }

  const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const dedupStale = Array.from(new Map(computedStale.map((s) => [s.area, s])).values())
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 8);

  const system = `You are the execution analyst inside a UPSC CSE aspirant's personal tracker.
Your job is to read this single student's real preparation data and tell them, honestly and specifically, what to revise and study next.
Hard rules on study hours: under 8 hours/day is NOT a good day, 8-10h is good, 12h+ is the peak target. Never praise sub-8h consistency.
Screen-time / distraction rules: the student manually logs social-media and OTT consumption (Instagram, WhatsApp, YouTube, Facebook, Netflix, Hotstar, MX Player, browsing). Treat this as distraction debt. If distraction is high — especially on days study was under 8h — call it out firmly and tell them to cut the specific top app. The ONE exception is "YouTube (study)" hours, which are legitimate study; never scold those. If distraction is genuinely low, acknowledge it briefly.
Be precise, never generic, never motivational fluff. Reference the student's actual subjects and numbers. Output ONLY JSON.`;

  const prompt = `Deterministic metrics already computed by the app (trust these for hours rigor):
${JSON.stringify(metrics, null, 2)}

Neglected / stale areas the app already detected from revision + completion + error data:
${JSON.stringify(dedupStale, null, 2)}

Screen-time / distraction read (avgPerDay = avg distraction hours/day; onLowStudyDays vs onGoodStudyDays shows whether distraction tracks with weak study days; studyYouTube is legitimate study and must NOT be scolded):
${distraction ? JSON.stringify(distraction, null, 2) : "No screen-time logged yet — gently prompt the student to start logging it."}

Per-subject coverage from the student's own daily subject tags (daysSince = days since last studied; null = never tagged):
${JSON.stringify(subjectCoverage, null, 2)}

Full live preparation context (subjects, completion %, recent topics, tests, mood, revision, errors, strategy):
${JSON.stringify(
    {
      daysToPrelimsDate: ctx.daysToPrelimsDate,
      daysToMainsDate: ctx.daysToMainsDate,
      papers: ctx.papers,
      recentDailyLogs: ctx.recentDailyLogs?.slice(0, 10) ?? [],
      revisionSummary: ctx.revisionSummary,
      questionErrorSummary: ctx.questionErrorSummary,
      testSummary: ctx.testSummary,
      strategicSnapshot: ctx.strategicSnapshot,
      memory: {
        recurringWeaknesses: ctx.memory?.recurringWeaknesses ?? [],
        mentorPriorities: ctx.memory?.mentorPriorities ?? [],
      },
    },
    null,
    2,
  )}

Return ONLY valid JSON (no markdown, no prose outside JSON) in exactly this shape:
{
  "headline": "one sharp line on where this student stands right now",
  "momentumRead": "2-3 sentences on study-hour momentum, judged against the 8h good / 12h peak bars. Be blunt if they are under-studying.",
  "reviseNow": [
    { "area": "specific topic or subject from their data", "reason": "why it is decaying / risky now", "priority": "HIGH" }
  ],
  "studyNext": [
    { "area": "specific area not yet covered or thin", "reason": "why it should be picked up next" }
  ],
  "distractionVerdict": "1-2 sentences. If distraction is high, scold firmly and name the top app to cut. Praise low distraction briefly. Never scold YouTube-study hours. Empty string if no screen-time data.",
  "habitFix": { "strength": "the one real strength to protect", "fix": "the single highest-leverage habit change for hours/discipline" },
  "weeklyTargets": [
    { "label": "Hours", "target": "concrete number tied to 8h+/12h bars" },
    { "label": "Revision", "target": "concrete" },
    { "label": "Tests", "target": "concrete" }
  ],
  "closingNote": "one honest closing line, no fluff"
}
Provide 3-5 items in reviseNow and 2-4 in studyNext, all drawn from the student's actual subjects above.`;

  try {
    const result = await generateWithFallback(prompt, system);
    const parsed = safeParse(result.text);
    return {
      metrics,
      distraction,
      computedStale: dedupStale,
      ai: parsed,
      model: result.model,
      generatedAt: new Date().toISOString(),
      error: parsed ? undefined : "Model returned an unparseable response.",
    };
  } catch (e) {
    return {
      metrics,
      distraction,
      computedStale: dedupStale,
      ai: null,
      model: "none",
      generatedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : "Analysis failed.",
    };
  }
}
