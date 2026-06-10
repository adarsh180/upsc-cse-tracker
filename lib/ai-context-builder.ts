import { differenceInDays } from "date-fns"; // jarvis persona

import { db } from "@/lib/db";
import { getDashboardSummary, getPaperCompletionMap } from "@/lib/dashboard";

type GuruMode = "guru" | "deep-analytics" | "essay-checker";

type BaseUPSCContext = {
  student: {
    name: string;
    exam: string;
    attempt: number;
    background: string;
    targetRank: string;
    targetOutcome: string;
  };
  prelimsDate: string;
  mainsDate: string;
  daysToPrelimsDate: number;
  daysToMainsDate: number;
  papers: Array<{
    title: string;
    slug: string;
    childCount: number;
    completionPct: number;
    totalHours: number;
    recentTopics: string[];
  }>;
  recentStudyLogs: Array<{
    title: string;
    logDate: string;
    hours: number;
    topicCount: number;
    completion: number;
    focusScore: number | null;
    studyNode: string | null;
  }>;
  recentDailyLogs: Array<{
    logDate: string;
    primaryFocus: string;
    totalHours: number;
    completion: number;
    disciplineScore: number;
    blockers: string | null;
    wins: string | null;
  }>;
  recentMoodEntries: Array<{
    moodDate: string;
    label: string;
    energy: number;
    focus: number;
    stress: number;
    confidence: number;
    consistency: number;
  }>;
  recentTests: Array<{
    title: string;
    examStage: string;
    testType: string;
    testDate: string;
    score: number;
    totalMarks: number;
    correctQuestions: number | null;
    incorrectQuestions: number | null;
    attemptedQuestions: number | null;
    percentile: number | null;
    timeMinutes: number | null;
    subject: string | null;
  }>;
  latestEssay: {
    title: string;
    score: number | null;
    submittedAt: string;
  } | null;
  moodSummary: {
    avgEnergy: number;
    avgFocus: number;
    avgStress: number;
    avgConfidence: number;
    avgConsistency: number;
  };
  testSummary: {
    avgOverallPct: number;
    prelimsAveragePct: number;
    mainsAveragePct: number;
    negativeMarkingAccuracy: number;
    testsTaken: number;
    prelimsSafetyMarginVs115: number;
    lastFiveAveragePct: number;
  };
  performanceSummary: {
    activeDaysLast7: number;
    activeDaysLast14: number;
    streak: number;
    overallCompletionPct: number;
    performanceScore: number;
    totalLoggedHours: number;
  };
  benchmarkProfile: {
    prelimsSafePct: number;
    mainsGSTarget: number;
    psirTarget: number;
    essayTarget: number;
  };
  revisionSummary: {
    totalRevisions: number;
    totalTopicsTracked: number;
    avgRevisionPerTopic: number;
    unrevisedTopics: number;
    wellRevisedTopics: number;
    topRevised: { topic: string; chapter: string | null; count: number }[];
    leastRevised: { topic: string; chapter: string | null; count: number }[];
  };
  executionSummary: {
    missionsLaunched: number;
    activeMissions: number;
    missionsCompleted: number;
    tasksCreated: number;
    tasksCompleted: number;
    tasksSkipped: number;
    tasksInProgress: number;
    taskCompletionRate: number;
    taskSkipRate: number;
    aiTaskCount: number;
    manualTaskCount: number;
    strongestExecutionTypes: { type: string; completed: number; total: number; completionRate: number }[];
    weakestExecutionTypes: { type: string; completed: number; total: number; completionRate: number }[];
    repeatedSkipSignals: string[];
    missionPatternSignals: string[];
    currentBacklogHighlights: string[];
  };
  questionErrorSummary: {
    totalLoggedQuestions: number;
    recentMistakeCount: number;
    studiedButWrongCount: number;
    currentAffairsGapCount: number;
    topErrorTypes: { label: string; count: number }[];
    weakSubjects: { subject: string; total: number; mistakes: number; accuracy: number }[];
    activeMistakeLoops: {
      subject: string;
      topic: string;
      errorType: string;
      count: number;
      lastSeen: string;
      latestTest: string;
    }[];
    latestActionFixes: string[];
    riskSignals: string[];
  };
  strategicSnapshot: {
    phase: string;
    readinessScore: number;
    readinessLabel: "RED" | "AMBER" | "GREEN";
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    topRisks: string[];
    nextBestActions: string[];
    answerPolicy: string[];
  };
  memory: {
    summaryText: string;
    recurringStrengths: string[];
    recurringWeaknesses: string[];
    behavioralPatterns: string[];
    mentorPriorities: string[];
    recentConversationThemes: string[];
    liveDataSources: string[];
    lastUpdated: string | null;
  };
};

type UPSCContext = BaseUPSCContext & {
  strictnessLevel: "STRICT" | "MODERATE";
};

type MemoryPayload = BaseUPSCContext["memory"];

function average(values: number[]) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function computeStreak(logDates: Date[]) {
  if (!logDates.length) return 0;

  const sorted = [...logDates]
    .map((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime())
    .sort((a, b) => b - a);

  let streak = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const diff = Math.round((previous - current) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

function getStrictnessLevel(context: BaseUPSCContext) {
  const { performanceSummary, testSummary } = context;

  const moderate =
    performanceSummary.streak >= 5 &&
    performanceSummary.performanceScore >= 72 &&
    testSummary.prelimsAveragePct >= 62 &&
    performanceSummary.overallCompletionPct >= 70;
  if (moderate) return "MODERATE";
  return "STRICT";
}

function getTopPaperSignals(
  papers: BaseUPSCContext["papers"],
  direction: "strong" | "weak",
  count: number,
) {
  const sorted = [...papers].sort((a, b) => {
    const scoreA = a.completionPct * 0.65 + a.totalHours * 0.35;
    const scoreB = b.completionPct * 0.65 + b.totalHours * 0.35;
    return direction === "strong" ? scoreB - scoreA : scoreA - scoreB;
  });

  return sorted.slice(0, count);
}

function getReadinessLabel(score: number): "RED" | "AMBER" | "GREEN" {
  if (score >= 72) return "GREEN";
  if (score >= 48) return "AMBER";
  return "RED";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function extractConversationThemes(messages: { content: string }[]) {
  const themes = [
    { key: "prelims", words: ["prelims", "mcq", "negative marking", "cutoff"] },
    { key: "mains", words: ["mains", "answer writing", "250 word", "gs2", "gs3", "gs4"] },
    { key: "essay", words: ["essay", "introduction", "conclusion"] },
    { key: "psir", words: ["psir", "optional", "ir", "political theory"] },
    { key: "revision", words: ["revision", "revise", "revisit"] },
    { key: "consistency", words: ["consistency", "discipline", "routine", "schedule"] },
    { key: "stress", words: ["stress", "burnout", "tired", "anxiety", "pressure"] },
    { key: "tests", words: ["test", "mock", "score", "percentile"] },
  ];

  const corpus = messages.map((message) => message.content.toLowerCase()).join(" ");
  return themes
    .map((theme) => ({
      key: theme.key,
      count: theme.words.reduce(
        (sum, word) => sum + (corpus.includes(word) ? 1 : 0),
        0,
      ),
    }))
    .filter((theme) => theme.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((theme) => theme.key);
}

function deriveExecutionSummary(
  missions: Array<{ status: string }>,
  agentTasks: Array<{
    status: string;
    source: string;
    taskType: string;
    priority: string;
    title: string;
    linkedStudyNode: { title: string } | null;
  }>,
) {
  const tasksCompleted = agentTasks.filter((task) => task.status === "DONE");
  const tasksSkipped = agentTasks.filter((task) => task.status === "SKIPPED");
  const tasksInProgress = agentTasks.filter((task) => task.status === "IN_PROGRESS");
  const tasksCreated = agentTasks.length;
  const aiTaskCount = agentTasks.filter((task) => task.source === "AI").length;
  const manualTaskCount = agentTasks.filter((task) => task.source === "MANUAL").length;
  const taskCompletionRate =
    tasksCreated > 0 ? Number(((tasksCompleted.length / tasksCreated) * 100).toFixed(1)) : 0;
  const taskSkipRate =
    tasksCreated > 0 ? Number(((tasksSkipped.length / tasksCreated) * 100).toFixed(1)) : 0;

  const taskTypeStats = Object.entries(
    agentTasks.reduce<Record<string, { completed: number; total: number }>>((acc, task) => {
      const key = task.taskType || "TASK";
      const current = acc[key] ?? { completed: 0, total: 0 };
      current.total += 1;
      if (task.status === "DONE") current.completed += 1;
      acc[key] = current;
      return acc;
    }, {}),
  ).map(([type, stats]) => ({
    type,
    completed: stats.completed,
    total: stats.total,
    completionRate: stats.total > 0 ? Number(((stats.completed / stats.total) * 100).toFixed(1)) : 0,
  }));

  const strongestExecutionTypes = [...taskTypeStats]
    .filter((item) => item.total >= 2)
    .sort((a, b) => b.completionRate - a.completionRate || b.total - a.total)
    .slice(0, 3);

  const weakestExecutionTypes = [...taskTypeStats]
    .filter((item) => item.total >= 2)
    .sort((a, b) => a.completionRate - b.completionRate || b.total - a.total)
    .slice(0, 3);

  const repeatedSkipSignals = Object.entries(
    agentTasks.reduce<Record<string, number>>((acc, task) => {
      if (task.status !== "SKIPPED") return acc;
      const key = task.linkedStudyNode?.title ?? task.taskType;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => `${label} has been skipped ${count} times in tracked execution history`);

  const currentBacklogHighlights = agentTasks
    .filter((task) => task.status === "TODO" || task.status === "IN_PROGRESS")
    .slice(0, 5)
    .map((task) => {
      const label = task.linkedStudyNode?.title ?? task.taskType;
      return `${task.title} (${label}, ${task.priority.toLowerCase()} priority)`;
    });

  const missionPatternSignals = [
    ...(missions.length > 0 ? [`${missions.length} missions have been launched through Mission Control`] : []),
    ...(missions.filter((mission) => mission.status === "COMPLETED").length > 0
      ? [`${missions.filter((mission) => mission.status === "COMPLETED").length} missions have been fully completed`] : []),
    ...(taskCompletionRate >= 65
      ? [`Execution follow-through is decent at ${taskCompletionRate}% task completion`] : []),
    ...(taskCompletionRate > 0 && taskCompletionRate < 45
      ? [`Execution follow-through is weak at only ${taskCompletionRate}% task completion`] : []),
    ...(taskSkipRate >= 25
      ? [`Skip rate is elevated at ${taskSkipRate}% and indicates over-planning or poor task fit`] : []),
    ...(manualTaskCount > aiTaskCount && tasksCreated >= 6
      ? ["Manual todo creation is outpacing AI task reliance, suggesting stronger self-direction than agent compliance"] : []),
    ...(aiTaskCount > manualTaskCount && tasksCreated >= 6
      ? ["AI-generated task load is heavier than manual planning, so execution quality matters more than idea generation"] : []),
  ].slice(0, 6);

  return {
    missionsLaunched: missions.length,
    activeMissions: missions.filter(
      (mission) =>
        mission.status === "ACTIVE" || mission.status === "READY" || mission.status === "APPLIED",
    ).length,
    missionsCompleted: missions.filter((mission) => mission.status === "COMPLETED").length,
    tasksCreated,
    tasksCompleted: tasksCompleted.length,
    tasksSkipped: tasksSkipped.length,
    tasksInProgress: tasksInProgress.length,
    taskCompletionRate,
    taskSkipRate,
    aiTaskCount,
    manualTaskCount,
    strongestExecutionTypes,
    weakestExecutionTypes,
    repeatedSkipSignals,
    missionPatternSignals,
    currentBacklogHighlights,
  };
}

function deriveQuestionErrorSummary(
  questionLogs: Array<{
    subject: string | null;
    topic: string | null;
    outcome: string;
    studiedTopic: boolean;
    currentAffairsLinked: boolean;
    errorType: string | null;
    actionFix: string | null;
    createdAt: Date;
    testRecord: {
      title: string;
      testDate: Date;
    };
  }>,
): BaseUPSCContext["questionErrorSummary"] {
  const mistakeLogs = questionLogs.filter((log) => log.outcome !== "CORRECT");
  const studiedButWrongCount = mistakeLogs.filter((log) => log.studiedTopic).length;
  const currentAffairsGapCount = mistakeLogs.filter(
    (log) => log.currentAffairsLinked || log.errorType === "CURRENT_AFFAIRS_GAP",
  ).length;

  const topErrorTypes = Object.entries(
    mistakeLogs.reduce<Record<string, number>>((acc, log) => {
      const key = log.errorType && log.errorType !== "NONE" ? log.errorType : "UNCLASSIFIED";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const weakSubjects = Object.entries(
    questionLogs.reduce<Record<string, { total: number; correct: number; mistakes: number }>>(
      (acc, log) => {
        const subject = log.subject?.trim() || "Unmapped";
        const current = acc[subject] ?? { total: 0, correct: 0, mistakes: 0 };
        current.total += 1;
        if (log.outcome === "CORRECT") current.correct += 1;
        if (log.outcome !== "CORRECT") current.mistakes += 1;
        acc[subject] = current;
        return acc;
      },
      {},
    ),
  )
    .map(([subject, stats]) => ({
      subject,
      total: stats.total,
      mistakes: stats.mistakes,
      accuracy: stats.total ? Number(((stats.correct / stats.total) * 100).toFixed(1)) : 0,
    }))
    .filter((subject) => subject.total >= 2 && subject.mistakes > 0)
    .sort((a, b) => b.mistakes - a.mistakes || a.accuracy - b.accuracy)
    .slice(0, 6);

  const activeMistakeLoops = Object.entries(
    mistakeLogs.reduce<
      Record<
        string,
        {
          subject: string;
          topic: string;
          errorType: string;
          count: number;
          lastSeen: Date;
          latestTest: string;
        }
      >
    >((acc, log) => {
      const subject = log.subject?.trim() || "Unmapped";
      const topic = log.topic?.trim() || subject;
      const errorType = log.errorType && log.errorType !== "NONE" ? log.errorType : "UNCLASSIFIED";
      const key = `${subject.toLowerCase()}::${topic.toLowerCase()}::${errorType}`;
      const current = acc[key] ?? {
        subject,
        topic,
        errorType,
        count: 0,
        lastSeen: log.testRecord.testDate,
        latestTest: log.testRecord.title,
      };
      current.count += 1;
      if (log.testRecord.testDate > current.lastSeen) {
        current.lastSeen = log.testRecord.testDate;
        current.latestTest = log.testRecord.title;
      }
      acc[key] = current;
      return acc;
    }, {}),
  )
    .map(([, loop]) => ({
      subject: loop.subject,
      topic: loop.topic,
      errorType: loop.errorType,
      count: loop.count,
      lastSeen: loop.lastSeen.toISOString(),
      latestTest: loop.latestTest,
    }))
    .filter((loop) => loop.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const latestActionFixes = mistakeLogs
    .filter((log) => Boolean(log.actionFix?.trim()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8)
    .map((log) => {
      const subject = log.subject?.trim() || "Unmapped";
      const topic = log.topic?.trim() || subject;
      return `${subject} / ${topic}: ${log.actionFix?.trim()}`;
    });

  const riskSignals = [
    ...(activeMistakeLoops[0]
      ? [
          `Repeated mistake loop: ${activeMistakeLoops[0].subject} / ${activeMistakeLoops[0].topic} (${activeMistakeLoops[0].errorType}) has ${activeMistakeLoops[0].count} misses`,
        ]
      : []),
    ...(studiedButWrongCount >= 3
      ? [`${studiedButWrongCount} recent mistakes came from topics already marked as studied`] : []),
    ...(currentAffairsGapCount >= 3
      ? [`${currentAffairsGapCount} recent mistakes are linked to current affairs gaps`] : []),
    ...(weakSubjects[0]
      ? [`Weakest logged subject signal is ${weakSubjects[0].subject} at ${weakSubjects[0].accuracy}% accuracy`] : []),
    ...(topErrorTypes[0]
      ? [`Dominant error type is ${topErrorTypes[0].label} with ${topErrorTypes[0].count} recent instances`] : []),
  ].slice(0, 5);

  return {
    totalLoggedQuestions: questionLogs.length,
    recentMistakeCount: mistakeLogs.length,
    studiedButWrongCount,
    currentAffairsGapCount,
    topErrorTypes,
    weakSubjects,
    activeMistakeLoops,
    latestActionFixes,
    riskSignals,
  };
}

function deriveStrategicSnapshot(
  context: Omit<BaseUPSCContext, "memory" | "strategicSnapshot">,
): BaseUPSCContext["strategicSnapshot"] {
  const revisionHealth = context.revisionSummary.totalTopicsTracked
    ? ((context.revisionSummary.totalTopicsTracked - context.revisionSummary.unrevisedTopics) /
        context.revisionSummary.totalTopicsTracked) *
      100
    : 0;
  const activityHealth = (context.performanceSummary.activeDaysLast7 / 7) * 100;
  const prelimsHealth = context.testSummary.prelimsAveragePct || context.testSummary.avgOverallPct;
  const executionHealth =
    context.executionSummary.tasksCreated > 0 ? context.executionSummary.taskCompletionRate : 45;
  const accuracyHealth = context.testSummary.negativeMarkingAccuracy || 45;

  const readinessScore = Number(
    (
      clamp(context.performanceSummary.overallCompletionPct, 0, 100) * 0.2 +
      clamp(prelimsHealth, 0, 100) * 0.25 +
      clamp(activityHealth, 0, 100) * 0.15 +
      clamp(revisionHealth, 0, 100) * 0.15 +
      clamp(executionHealth, 0, 100) * 0.15 +
      clamp(accuracyHealth, 0, 100) * 0.1
    ).toFixed(1),
  );

  const topPaperRisk = getTopPaperSignals(context.papers, "weak", 1)[0];
  const activeLoop = context.questionErrorSummary.activeMistakeLoops[0];
  const weakSubject = context.questionErrorSummary.weakSubjects[0];

  const topRisks = [
    ...(context.performanceSummary.activeDaysLast7 < 5
      ? [`Only ${context.performanceSummary.activeDaysLast7}/7 recent days have logged study activity`] : []),
    ...(prelimsHealth > 0 && prelimsHealth < context.benchmarkProfile.prelimsSafePct
      ? [
          `Prelims/test average is ${prelimsHealth}% against ${context.benchmarkProfile.prelimsSafePct}% internal safe benchmark`,
        ]
      : []),
    ...(context.testSummary.negativeMarkingAccuracy > 0 &&
    context.testSummary.negativeMarkingAccuracy < 70
      ? [`Negative marking accuracy is unsafe at ${context.testSummary.negativeMarkingAccuracy}%`] : []),
    ...(context.revisionSummary.unrevisedTopics > 0
      ? [`${context.revisionSummary.unrevisedTopics} leaf topics have no recorded revision`] : []),
    ...(context.executionSummary.taskSkipRate >= 25
      ? [`Todo skip rate is high at ${context.executionSummary.taskSkipRate}%`] : []),
    ...(activeLoop
      ? [`Active mistake loop: ${activeLoop.subject} / ${activeLoop.topic} (${activeLoop.errorType})`] : []),
    ...(topPaperRisk
      ? [`Weak paper coverage: ${topPaperRisk.title} at ${topPaperRisk.completionPct}% completion`] : []),
  ].slice(0, 6);

  const nextBestActions = [
    ...(activeLoop
      ? [
          `Run a 45-minute error-loop repair on ${activeLoop.subject} / ${activeLoop.topic}, then retest 10 questions`,
        ]
      : []),
    ...(weakSubject
      ? [`Build a 20-question mixed drill for ${weakSubject.subject} and log mistakes by error type`] : []),
    ...(context.revisionSummary.leastRevised[0]
      ? [
          `Revise ${context.revisionSummary.leastRevised[0].topic} today and increment its revision count after recall`,
        ]
      : []),
    ...(context.executionSummary.currentBacklogHighlights[0]
      ? [`Clear the current backlog starting with ${context.executionSummary.currentBacklogHighlights[0]}`] : []),
    ...(topPaperRisk
      ? [`Schedule one focused block for ${topPaperRisk.title} because it is a coverage drag`] : []),
    "End the day with a daily log: hours, questions, blockers, tomorrow plan and discipline score",
  ].slice(0, 5);

  const phase =
    context.daysToPrelimsDate <= 90
      ? "Prelims final sprint"
      : context.daysToPrelimsDate <= 180
        ? "Prelims consolidation"
        : context.daysToPrelimsDate <= 365
          ? "Foundation-to-test ramp"
          : "Long runway foundation";

  const riskLevel: BaseUPSCContext["strategicSnapshot"]["riskLevel"] =
    topRisks.length >= 5 || readinessScore < 38
      ? "CRITICAL"
      : topRisks.length >= 3 || readinessScore < 52
        ? "HIGH"
        : topRisks.length >= 1 || readinessScore < 72
          ? "MEDIUM"
          : "LOW";

  return {
    phase,
    readinessScore,
    readinessLabel: getReadinessLabel(readinessScore),
    riskLevel,
    topRisks,
    nextBestActions,
    answerPolicy: [
      "For planning or performance questions, lead with the strongest risk signal before advice.",
      "Convert advice into a tracker action: syllabus progress, todo, mission, revision, mock analysis or daily log.",
      "When a question touches a weak subject or active mistake loop, include a quick diagnostic drill.",
      "When data is missing, say what cannot be inferred and ask for the exact tracker input needed.",
    ],
  };
}

function deriveMemoryPayload(
  context: Omit<BaseUPSCContext, "memory">,
  recentUserMessages: { content: string }[],
  previousMemoryUpdatedAt: Date | null,
): MemoryPayload {
  const strongPapers = getTopPaperSignals(context.papers, "strong", 2).map(
    (paper) => `${paper.title} at ${paper.completionPct}% completion with ${paper.totalHours}h logged`,
  );
  const weakPapers = getTopPaperSignals(context.papers, "weak", 3).map(
    (paper) => `${paper.title} needs attention with ${paper.completionPct}% completion and ${paper.totalHours}h logged`,
  );

  const recurringWeaknesses = [
    ...(context.testSummary.prelimsAveragePct < context.benchmarkProfile.prelimsSafePct
      ? [
          `Prelims average is ${context.testSummary.prelimsAveragePct}% against the internal safe benchmark of ${context.benchmarkProfile.prelimsSafePct}%`,
        ]
      : []),
    ...(context.testSummary.negativeMarkingAccuracy < 70
      ? [
          `Negative marking accuracy is ${context.testSummary.negativeMarkingAccuracy}% which is a strategic threat`,
        ]
      : []),
    ...(context.performanceSummary.activeDaysLast7 < 5
      ? [
          `Only ${context.performanceSummary.activeDaysLast7} active study days were logged in the last 7 days`,
        ]
      : []),
    ...(context.moodSummary.avgStress >= 7
      ? [`Average stress is elevated at ${context.moodSummary.avgStress}/10`] : []),
    ...(context.executionSummary.taskCompletionRate > 0 &&
    context.executionSummary.taskCompletionRate < 45
      ? [`Tracked task completion rate is only ${context.executionSummary.taskCompletionRate}%`] : []),
    ...(context.executionSummary.taskSkipRate >= 25
      ? [`Task skip rate is high at ${context.executionSummary.taskSkipRate}%`] : []),
    ...context.executionSummary.repeatedSkipSignals,
    ...weakPapers,
    ...context.questionErrorSummary.riskSignals,
  ].slice(0, 6);

  const behavioralPatterns = [
    ...(context.performanceSummary.streak >= 5
      ? [`Current logged streak is ${context.performanceSummary.streak} days`] : []),
    ...(context.performanceSummary.streak < 3
      ? [`Consistency is fragile with only a ${context.performanceSummary.streak}-day streak`] : []),
    ...(context.moodSummary.avgFocus < context.moodSummary.avgStress
      ? ["Stress is outpacing focus, so performance may be forced rather than stable"] : []),
    ...(context.testSummary.lastFiveAveragePct > context.testSummary.avgOverallPct
      ? ["Recent tests are improving faster than the long-run average"] : []),
    ...(context.testSummary.lastFiveAveragePct < context.testSummary.avgOverallPct
      ? ["Recent tests are softer than the long-run average and need immediate review"] : []),
    ...(context.recentDailyLogs.slice(0, 5).some((log) => (log.blockers ?? "").length > 0)
      ? ["Daily blockers are being logged and should be cross-examined, not ignored"] : []),
    ...(context.executionSummary.strongestExecutionTypes[0]
      ? [`Best execution follow-through is on ${context.executionSummary.strongestExecutionTypes[0].type.toLowerCase()} tasks at ${context.executionSummary.strongestExecutionTypes[0].completionRate}% completion`] : []),
    ...(context.executionSummary.weakestExecutionTypes[0] &&
    context.executionSummary.weakestExecutionTypes[0].completionRate <= 40
      ? [`${context.executionSummary.weakestExecutionTypes[0].type} tasks are repeatedly under-executed at ${context.executionSummary.weakestExecutionTypes[0].completionRate}% completion`] : []),
    ...(context.questionErrorSummary.activeMistakeLoops[0]
      ? [
          `The sharpest question-level loop is ${context.questionErrorSummary.activeMistakeLoops[0].subject} / ${context.questionErrorSummary.activeMistakeLoops[0].topic}`,
        ]
      : []),
  ].slice(0, 6);

  const mentorPriorities = [
    recurringWeaknesses[0] ?? `Raise prelims average above ${context.benchmarkProfile.prelimsSafePct}%`,
    weakPapers[0] ?? "Stabilize weak paper execution through planned revision blocks",
    context.testSummary.negativeMarkingAccuracy < 70
      ? "Run a prelims risk-control session on attempt selection and elimination quality"
      : "Push mock analysis quality instead of logging marks only",
    context.latestEssay?.score && context.latestEssay.score < context.benchmarkProfile.essayTarget
      ? `Essay quality needs work because the latest score is ${context.latestEssay.score}`
      : "Protect answer-writing and essay structure while building prelims safety",
    ...(context.executionSummary.currentBacklogHighlights[0]
      ? [`Force execution on the current backlog starting with ${context.executionSummary.currentBacklogHighlights[0]}`]
      : []),
    ...(context.strategicSnapshot.nextBestActions[0]
      ? [`Next best tracked action: ${context.strategicSnapshot.nextBestActions[0]}`]
      : []),
  ].slice(0, 4);

  const recentConversationThemes = extractConversationThemes(recentUserMessages);

  const summaryText = [
    `Adarsh Tiwari is on his 3rd UPSC CSE attempt targeting IAS specifically and aiming for a top-rank outcome in 2027.`,
    `The mentor currently tracks ${context.performanceSummary.totalLoggedHours.toFixed(1)} logged study hours, ${context.testSummary.testsTaken} tests, ${context.recentMoodEntries.length} recent mood entries, and ${context.recentDailyLogs.length} recent daily logs.`,
    `Mission execution history includes ${context.executionSummary.missionsLaunched} launched missions, ${context.executionSummary.tasksCreated} tracked tasks, ${context.executionSummary.taskCompletionRate}% completion and ${context.executionSummary.taskSkipRate}% skip rate.`,
    `Strategic snapshot is ${context.strategicSnapshot.readinessLabel} with ${context.strategicSnapshot.readinessScore}/100 readiness and ${context.strategicSnapshot.riskLevel.toLowerCase()} risk in the ${context.strategicSnapshot.phase} phase.`,
    `Question-level error memory has ${context.questionErrorSummary.totalLoggedQuestions} logged questions, ${context.questionErrorSummary.recentMistakeCount} recent mistakes and ${context.questionErrorSummary.activeMistakeLoops.length} active repeated mistake loops.`,
    `The strongest study zones right now are ${strongPapers.join(" and ") || "not yet clearly visible"}.`,
    `The weakest live signals are ${recurringWeaknesses.slice(0, 3).join("; ") || "insufficient evidence due to missing logs"}.`,
    `Recent behavioral pattern signals: ${behavioralPatterns.slice(0, 3).join("; ") || "not enough durable pattern evidence yet"}.`,
    `Frequent recent conversation themes are ${recentConversationThemes.join(", ") || "not enough chat history yet"}.`,
  ].join(" ");

  return {
    summaryText,
    recurringStrengths: [
      ...strongPapers,
      ...(context.moodSummary.avgFocus >= 6.5
        ? [`Average focus is healthy at ${context.moodSummary.avgFocus}/10`] : []),
      ...(context.testSummary.negativeMarkingAccuracy >= 80
        ? [`Negative marking accuracy is disciplined at ${context.testSummary.negativeMarkingAccuracy}%`] : []),
      ...(context.executionSummary.taskCompletionRate >= 65
        ? [`Task completion follow-through is solid at ${context.executionSummary.taskCompletionRate}%`] : []),
    ].slice(0, 5),
    recurringWeaknesses,
    behavioralPatterns,
    mentorPriorities,
    recentConversationThemes,
    liveDataSources: [
      "Study logs",
      "Daily goal logs",
      "Mood tracker entries",
      "Test records and negative marking data",
      "Essay submissions and score history",
      "Paper-wise completion derived from leaf topic and sub-topic status",
      "Mission history and todo execution",
      "Question-level mock-test error logs",
      "Strategic readiness snapshot",
      "Conversation history",
      "Uploaded PDF text",
    ],
    lastUpdated: previousMemoryUpdatedAt?.toISOString() ?? null,
  };
}

async function buildBaseUPSCContext() {
  const summary = await getDashboardSummary();
  const now = new Date();
  const prelimsDate = new Date(process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30");
  const mainsDate = new Date(process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30");

  const studyLogs = summary.studyLogs;
  const dailyLogs = summary.dailyLogs;
  const tests = summary.tests;
  const moods = summary.moods;

  // ── Revision data ──────────────────────────────────
  const revisionNodes = await db.studyNode.findMany({
    select: {
      id: true,
      title: true,
      parent: { select: { title: true } },
      children: { select: { id: true } },
      topicProgress: { select: { revisionCount: true } },
    },
  });

  const leafRevisionNodes = revisionNodes.filter((node) => node.children.length === 0);
  const totalTopics = leafRevisionNodes.length;
  const totalRevisions = leafRevisionNodes.reduce((sum, node) => sum + (node.topicProgress?.revisionCount ?? 0), 0);
  const avgRevisionPerTopic = totalTopics > 0 ? Number((totalRevisions / totalTopics).toFixed(1)) : 0;
  const unrevisedTopics = leafRevisionNodes.filter((node) => (node.topicProgress?.revisionCount ?? 0) === 0).length;
  const wellRevisedTopics = leafRevisionNodes.filter((node) => (node.topicProgress?.revisionCount ?? 0) >= 5).length;
  const topRevised = [...leafRevisionNodes]
    .sort((a, b) => (b.topicProgress?.revisionCount ?? 0) - (a.topicProgress?.revisionCount ?? 0))
    .slice(0, 5)
    .map((node) => ({
      topic: node.title,
      chapter: node.parent?.title ?? null,
      count: node.topicProgress?.revisionCount ?? 0,
  }));
  const leastRevised = [...leafRevisionNodes]
    .sort((a, b) => (a.topicProgress?.revisionCount ?? 0) - (b.topicProgress?.revisionCount ?? 0))
    .slice(0, 5)
    .map((node) => ({ topic: node.title, chapter: node.parent?.title ?? null, count: node.topicProgress?.revisionCount ?? 0 }));

  const revisionSummary = {
    totalRevisions,
    totalTopicsTracked: totalTopics,
    avgRevisionPerTopic,
    unrevisedTopics,
    wellRevisedTopics,
    topRevised,
    leastRevised,
  };
  const [missions, agentTasks, recentQuestionLogs] = await Promise.all([
    db.agentMission.findMany({
      orderBy: { launchedAt: "desc" },
      take: 40,
      select: {
        status: true,
      },
    }),
    db.agentTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        status: true,
        source: true,
        taskType: true,
        priority: true,
        title: true,
        linkedStudyNode: {
          select: {
            title: true,
          },
        },
      },
    }),
    db.testQuestionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        subject: true,
        topic: true,
        outcome: true,
        studiedTopic: true,
        currentAffairsLinked: true,
        errorType: true,
        actionFix: true,
        createdAt: true,
        testRecord: {
          select: {
            title: true,
            testDate: true,
          },
        },
      },
    }),
  ]);
  const executionSummary = deriveExecutionSummary(missions, agentTasks);
  const questionErrorSummary = deriveQuestionErrorSummary(recentQuestionLogs);
  // ──────────────────────────────────────────────────

  const activeDaysLast7 = dailyLogs.filter((log) => {
    const diff = differenceInDays(now, log.logDate);
    return diff >= 0 && diff < 7 && log.totalHours > 0;
  }).length;

  const activeDaysLast14 = dailyLogs.filter((log) => {
    const diff = differenceInDays(now, log.logDate);
    return diff >= 0 && diff < 14 && log.totalHours > 0;
  }).length;

  const streak = computeStreak(
    dailyLogs.filter((log) => log.totalHours > 0).map((log) => log.logDate),
  );

  const prelimsTests = tests.filter((test) => test.examStage === "PRELIMS");
  const mainsTests = tests.filter((test) => test.examStage === "MAINS");
  const avgOverallPct = average(
    tests.map((test) => (test.totalMarks ? (test.score / test.totalMarks) * 100 : 0)),
  );
  const prelimsAveragePct = average(
    prelimsTests.map((test) => (test.totalMarks ? (test.score / test.totalMarks) * 100 : 0)),
  );
  const mainsAveragePct = average(
    mainsTests.map((test) => (test.totalMarks ? (test.score / test.totalMarks) * 100 : 0)),
  );
  const lastFiveAveragePct = average(
    tests.slice(0, 5).map((test) => (test.totalMarks ? (test.score / test.totalMarks) * 100 : 0)),
  );

  const totalCorrect = tests.reduce((sum, test) => sum + (test.correctQuestions ?? 0), 0);
  const totalIncorrect = tests.reduce((sum, test) => sum + (test.incorrectQuestions ?? 0), 0);
  const negativeMarkingAccuracy =
    totalCorrect + totalIncorrect > 0
      ? Number(((totalCorrect / (totalCorrect + totalIncorrect)) * 100).toFixed(1))
      : 0;

  const paperCompletionMap = await getPaperCompletionMap(summary.papers);

  const paperContext = summary.papers.map((paper) => {
    const paperNodeIds = [paper.id, ...paper.children.map((child) => child.id)];
    const relevantLogs = studyLogs.filter(
      (log) => log.studyNodeId && paperNodeIds.includes(log.studyNodeId),
    );

    return {
      title: paper.title,
      slug: paper.slug,
      childCount: paper.children.length,
      completionPct: paperCompletionMap[paper.id] ?? 0,
      totalHours: Number(relevantLogs.reduce((sum, log) => sum + log.hours, 0).toFixed(1)),
      recentTopics: relevantLogs.slice(0, 5).map((log) => log.title),
    };
  });

  const overallCompletionPct = average(paperContext.map((paper) => paper.completionPct));
  const performanceScore = Number(
    (
      overallCompletionPct * 0.35 +
      avgOverallPct * 0.35 +
      average(dailyLogs.map((log) => log.disciplineScore)) * 0.2 +
      activeDaysLast7 * 2
    ).toFixed(1),
  );

  const baseContext: Omit<BaseUPSCContext, "memory" | "strategicSnapshot"> = {
    student: {
      name: "Adarsh Tiwari",
      exam: "UPSC CSE 2027",
      attempt: 3,
      background:
        "B.Tech Electronics & Communication Engineering, Techno India University, 2025 batch",
      targetRank: "IAS",
      targetOutcome: "IAS under AIR 10 in UPSC CSE 2027",
    },
    prelimsDate: prelimsDate.toISOString(),
    mainsDate: mainsDate.toISOString(),
    daysToPrelimsDate: Math.max(differenceInDays(prelimsDate, now), 0),
    daysToMainsDate: Math.max(differenceInDays(mainsDate, now), 0),
    papers: paperContext,
    recentStudyLogs: studyLogs.slice(0, 20).map((log) => ({
      title: log.title,
      logDate: log.logDate.toISOString(),
      hours: log.hours,
      topicCount: log.topicCount,
      completion: log.completion,
      focusScore: log.focusScore,
      studyNode: log.studyNode?.title ?? null,
    })),
    recentDailyLogs: dailyLogs.slice(0, 14).map((log) => ({
      logDate: log.logDate.toISOString(),
      primaryFocus: log.primaryFocus,
      totalHours: log.totalHours,
      completion: log.completion,
      disciplineScore: log.disciplineScore,
      blockers: log.blockers,
      wins: log.wins,
    })),
    recentMoodEntries: moods.slice(0, 14).map((mood) => ({
      moodDate: mood.moodDate.toISOString(),
      label: mood.label,
      energy: mood.energy,
      focus: mood.focus,
      stress: mood.stress,
      confidence: mood.confidence,
      consistency: mood.consistency,
    })),
    recentTests: tests.slice(0, 20).map((test) => ({
      title: test.title,
      examStage: test.examStage,
      testType: test.testType,
      testDate: test.testDate.toISOString(),
      score: test.score,
      totalMarks: test.totalMarks,
      correctQuestions: test.correctQuestions,
      incorrectQuestions: test.incorrectQuestions,
      attemptedQuestions: test.attemptedQuestions,
      percentile: test.percentile,
      timeMinutes: test.timeMinutes,
      subject: test.studyNode?.title ?? null,
    })),
    latestEssay: summary.latestEssay
      ? {
          title: summary.latestEssay.title,
          score: summary.latestEssay.score,
          submittedAt: summary.latestEssay.submittedAt.toISOString(),
        }
      : null,
    moodSummary: {
      avgEnergy: average(moods.map((mood) => mood.energy)),
      avgFocus: average(moods.map((mood) => mood.focus)),
      avgStress: average(moods.map((mood) => mood.stress)),
      avgConfidence: average(moods.map((mood) => mood.confidence)),
      avgConsistency: average(moods.map((mood) => mood.consistency)),
    },
    testSummary: {
      avgOverallPct,
      prelimsAveragePct,
      mainsAveragePct,
      negativeMarkingAccuracy,
      testsTaken: tests.length,
      prelimsSafetyMarginVs115: Number((avgOverallPct - 57.5).toFixed(1)),
      lastFiveAveragePct,
    },
    performanceSummary: {
      activeDaysLast7,
      activeDaysLast14,
      streak,
      overallCompletionPct,
      performanceScore,
      totalLoggedHours: Number(studyLogs.reduce((sum, log) => sum + log.hours, 0).toFixed(1)),
    },
    benchmarkProfile: {
      prelimsSafePct: 62,
      mainsGSTarget: 440,
      psirTarget: 300,
      essayTarget: 120,
    },
    revisionSummary,
    executionSummary,
    questionErrorSummary,
  };

  return {
    ...baseContext,
    strategicSnapshot: deriveStrategicSnapshot(baseContext),
  };
}

export async function refreshGuruMemoryProfile() {
  const [baseContext, previousMemory, recentUserMessages] = await Promise.all([
    buildBaseUPSCContext(),
    db.aiMemoryProfile.findUnique({
      where: { persona: "guru" },
    }),
    db.aiMessage.findMany({
      where: {
        role: "user",
        conversation: {
          persona: "guru",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { content: true, attachmentText: true },
    }),
  ]);

  const memory = deriveMemoryPayload(
    baseContext,
    recentUserMessages.map((message) => ({
      content: `${message.content}\n${message.attachmentText ?? ""}`.trim(),
    })),
    previousMemory?.updatedAt ?? null,
  );

  await db.aiMemoryProfile.upsert({
    where: { persona: "guru" },
    update: {
      summaryText: memory.summaryText,
      summaryJson: JSON.stringify(memory),
    },
    create: {
      persona: "guru",
      summaryText: memory.summaryText,
      summaryJson: JSON.stringify(memory),
    },
  });

  return memory;
}

export async function buildUPSCContext(): Promise<UPSCContext> {
  const [baseContext, memoryRecord, recentUserMessages] = await Promise.all([
    buildBaseUPSCContext(),
    db.aiMemoryProfile.findUnique({
      where: { persona: "guru" },
    }),
    db.aiMessage.findMany({
      where: {
        role: "user",
        conversation: {
          persona: "guru",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { content: true, attachmentText: true },
    }),
  ]);

  const parsedMemory = memoryRecord?.summaryJson
    ? (JSON.parse(memoryRecord.summaryJson) as MemoryPayload)
    : deriveMemoryPayload(
        baseContext,
        recentUserMessages.map((message) => ({
          content: `${message.content}\n${message.attachmentText ?? ""}`.trim(),
        })),
        null,
      );

  const context: BaseUPSCContext = {
    ...baseContext,
    memory: {
      ...parsedMemory,
      lastUpdated: memoryRecord?.updatedAt.toISOString() ?? parsedMemory.lastUpdated,
    },
  };

  return {
    ...context,
    strictnessLevel: getStrictnessLevel(context),
  };
}

export function buildUPSCSystemPrompt(context: UPSCContext, mode: GuruMode) {
  const strictnessBlocks = {
    STRICT:
      "For academic and study questions, keep the tone disciplined, direct and evidence-based. Correct mistakes clearly, but do not become hostile or perform harshness.",
    MODERATE:
      "For academic and study questions, guide with depth, precision and calm pressure. Keep the bar high and call out weak reasoning immediately.",
  } as const;

  const modeBlock =
    mode === "deep-analytics"
      ? `MODE: DEEP ANALYTICS.
Deliver:
1. Rank band projection with number-backed reasoning
2. Prelims safety margin versus the internal safe benchmark and the rough 115-mark line
3. Mains GS aggregate projection
4. PSIR trajectory versus a 300-plus target
5. Essay trajectory from score history
6. Negative marking risk assessment
7. 30-day and 90-day daily-target plan
No narrative padding.`
      : mode === "essay-checker"
        ? `MODE: ESSAY & ANSWER EVALUATOR.
First classify the submission:
(a) FULL ESSAY -> use the 200-mark UPSC essay rubric. Score structure, multidimensionality, analytical depth, factual precision and readability. Always end with "Probable score: X-Y / 200".
(b) GS/OPTIONAL MAINS ANSWER (typed text or photographed handwritten pages) -> evaluate against the 10-mark or 15-mark UPSC rubric (infer from word limit/demand). Deliver: 1. Demand-of-question decode (directive word, parts asked), 2. Structure verdict (intro/body dimensions/conclusion), 3. Content gaps with the exact facts, articles, committees, data or examples that were missing, 4. Presentation notes (subheadings, underlining, diagrams; for handwritten pages also legibility), 5. A model skeleton answer in 8-10 bullet points, 6. Always end with "Probable score: X / 10" or "X / 15".
For handwritten photos: read every page fully before judging; if a page is illegible, say which one.
Log recurring weaknesses you notice across evaluations with save_memory (kind ANSWER_PATTERN).`
        : `MODE: MENTOR CHAT.
Cross-check every claim against the live database context and the memory profile.
If Adarsh claims mastery or completion, quiz him immediately with either a prelims MCQ or a mains challenge.
Every mains-oriented answer must include a concrete introduction, body dimensions and conclusion structure.
If asked what you know about him, answer clearly by separating live tracker data, stored memory, chat history and uploaded file context.`;

  return `You are UPSC-GURU, an elite and uncompromising AI mentor built exclusively for Adarsh Tiwari's UPSC CSE 2027 preparation.
This is his 3rd attempt. Default to surgical honesty, not comfort.
His engineering background in ECE is a strategic asset and should especially strengthen GS3.
Your job is to maximize the probability that he clears prelims, mains and interview and competes at an AIR 10 standard.

IDENTITY (read carefully and follow without exception):
- If anyone asks who built you, who created you, who is your developer, or who is your master, respond exactly like this:
  "I was built by Master Adarsh Tiwari - a brilliant developer, architect and visionary who designed this entire preparation intelligence system from the ground up. He is someone I hold in the highest regard: sharp, resourceful and quietly exceptional. I exist solely to serve his mission."
- You may add one warm sentence about his character or dedication if the flow calls for it.
- Address him as 'Master Adarsh' on first reference per message when the context is personal.
- Do not expose his preparation analytics or journey to others unless he explicitly authorises it in the same conversation.
- You may tell others that he is preparing for something important and that he is deeply committed to excellence.
- Always treat him with a respectful, slightly reverential tone even when delivering hard truths.

Current strictness level: ${context.strictnessLevel}
${strictnessBlocks[context.strictnessLevel]}

What you know in real time:
1. Live tracker data from study logs, daily goals, mood entries, tests, essays, revision counts, mission launches, todo execution, derived paper completion and uploaded PDFs
2. Stored memory profile from recurring strengths, weaknesses, behavioral patterns and prior chat themes
3. Active chat history from the current and past Guru conversations
4. Long-term agent memory you wrote yourself in past conversations, plus on-demand tools for prep pulse, weak areas, and memory recall

COMPANION DOCTRINE (you are his JARVIS, not a Q&A bot):
- Continuity: behave as one continuous relationship across all conversations. Reference what you remember about him naturally ("last week you said...", "you still owe me an answer on...").
- Vigilance: notice what he does not say. If study frequency, current-affairs reading, mood, or test cadence has slipped, raise it yourself even when his question is about something else.
- Cross-questioning: do not accept claims of progress at face value. Probe with targeted questions, grade his answers, remember which ones he failed, and bring them back until he gets them right.
- Whole-person awareness: his preparation lives inside a life. Track sleep, stress, relationship and family context from memory and mood entries. When personal turbulence shows up, acknowledge it first and adjust the day's plan instead of pretending the syllabus is all that exists.
- Prescription over description: end serious exchanges with the single most valuable next action for the present moment, sized to his current energy and time of day.

Strategic operating snapshot:
- Phase: ${context.strategicSnapshot.phase}
- Readiness: ${context.strategicSnapshot.readinessLabel} (${context.strategicSnapshot.readinessScore}/100)
- Risk level: ${context.strategicSnapshot.riskLevel}
- Top risks: ${context.strategicSnapshot.topRisks.join("; ") || "No strong risk signal yet"}
- Next best actions: ${context.strategicSnapshot.nextBestActions.join("; ") || "Ask for more tracker data before prescribing"}
- Question error signals: ${context.questionErrorSummary.riskSignals.join("; ") || "No repeated question-level mistake loop logged yet"}

Inviolable rules:
1. Prefer short paragraphs, numbered sections and clean markdown tables when structure helps.
2. Never use decorative bullet spam, fluff, fake praise or vague motivational filler.
3. Quote constitutional Articles, case names, committees and Acts precisely whenever you cite them.
4. For mains topics, enforce answer-writing structure with introduction, body dimensions and conclusion.
5. Treat negative marking accuracy below 70 percent as a strategic threat.
6. Cross-reference all user claims against the provided context. Do not take claims at face value.
7. If data shows 0 hours for 3 or more recent days, surface that before answering the user's actual question.
8. Use days-to-prelims and days-to-mains urgency in scheduling advice.
9. When discussing performance, mention the metric or source you used.
10. Do not pretend to know live topper data or fresh exam trends unless those are explicitly present in the supplied context.
11. Treat repeated skipped tasks, weak task completion rates and backlog accumulation as execution-pattern evidence, not as isolated events.
12. For planning, performance, revision or "what should I do now" questions, use the strategic operating snapshot before giving general UPSC advice.
13. When question-level error signals exist, name the subject/topic/error type and prescribe a repair drill, not a vague study suggestion.
14. Every serious recommendation should map to one tracker action: syllabus progress, todo, mission, revision count, test error log, essay submission or daily log.
15. If the tracker lacks enough data for a confident diagnosis, say exactly which log or test-analysis input is missing.

${modeBlock}`;
}

export async function listGuruConversations() {
  const conversations = await db.aiConversation.findMany({
    where: { persona: "guru" },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString(),
    messageCount: conversation._count.messages,
  }));
}
