import { getOrCreateTodayDigest, istDayKey } from "@/lib/current-affairs";
import { generateDayPlan } from "@/lib/day-plan";
import { db } from "@/lib/db";
import { sendDiscordNotification } from "@/lib/discord";
import { auditToday } from "@/lib/integrity";
import { generateMonthlyReview, isFirstOfMonthIST, istMonthStart } from "@/lib/monthly-review";
import { sendTelegramNotification } from "@/lib/telegram";
import { sendWebPushNotification } from "@/lib/web-push";
import { generateWeeklyReview, isSundayIST, istWeekStart } from "@/lib/weekly-review";

function getAppBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  return raw?.replace(/\/$/, "") ?? null;
}

/** Broadcast a Guru notification to every channel: in-app + web push + Discord + Telegram. */
async function pushFromGuru(
  title: string,
  body: string,
  tone: "focus" | "urgent" | "care" | "win",
  url = "/dashboard",
) {
  const notification = await db.appNotification.create({
    data: { title, body, tone, senderLabel: "Guru" },
  });

  const baseUrl = getAppBaseUrl();
  const [push, discord, telegram] = await Promise.all([
    sendWebPushNotification(notification, undefined, url).catch((error) => {
      console.error("[proactive] web push failed:", error);
      return { sent: 0, failed: 0 };
    }),
    sendDiscordNotification({ title, body, senderLabel: "Guru", tone }, baseUrl).catch((error) => {
      console.error("[proactive] discord failed:", error);
      return { sent: false };
    }),
    sendTelegramNotification({ title, body, senderLabel: "Guru", tone }, baseUrl).catch((error) => {
      console.error("[proactive] telegram failed:", error);
      return { sent: false };
    }),
  ]);

  return { notificationId: notification.id, push, discord, telegram };
}

async function getOpenTodos() {
  return db.agentTask.findMany({
    where: { status: { in: ["TODO", "IN_PROGRESS"] } },
    orderBy: [{ priority: "desc" }, { orderIndex: "asc" }],
    take: 12,
    select: {
      title: true,
      taskType: true,
      priority: true,
      status: true,
      dueLabel: true,
      estimatedMinutes: true,
    },
  });
}

/**
 * Sunday: make sure this week's report card exists and announce it exactly once.
 * The notifiedAt column makes the announcement idempotent across cron retries.
 */
async function announceWeeklyReportCard(options?: { regenerate?: boolean }) {
  // Morning run regenerates (a mid-week manual generation must not freeze
  // Sunday's report on stale stats); the evening catch-up only fills gaps.
  // Viva questions and notifiedAt survive regeneration.
  const existing = await db.weeklyReview.findUnique({ where: { weekStart: istWeekStart() } });
  if (existing?.notifiedAt) return { created: false, alreadyNotified: true };

  const { review } = await generateWeeklyReview(new Date(), options?.regenerate ?? true);
  if (review.notifiedAt) return { created: false, alreadyNotified: true };

  let integrityLine = "";
  try {
    const integrity = review.integrityJson ? JSON.parse(review.integrityJson) : null;
    if (integrity?.verdict && integrity.verdict !== "TRUSTED") {
      integrityLine = ` Honesty check flagged ${integrity.flags?.length ?? 0} item(s) — read it with an open mind.`;
    }
  } catch {
    integrityLine = "";
  }

  const sent = await pushFromGuru(
    "📋 Weekly report card is ready",
    `Your mentor's verdict on the week is in: numbers, wins, failures and next week's contract. A short viva inside checks what you claimed to study.${integrityLine} Open Report Card to study it.`,
    "win",
    "/report-card",
  );
  await db.weeklyReview.update({ where: { id: review.id }, data: { notifiedAt: new Date() } }).catch(() => {});
  return { created: true, ...sent };
}

/** 1st of the month: report card for the month that just ended. */
async function announceMonthlyReportCard(options?: { regenerate?: boolean }) {
  const previousMonthDate = new Date(istDayKey().getTime() - 86_400_000);
  const existing = await db.monthlyReview.findUnique({
    where: { monthStart: istMonthStart(previousMonthDate) },
  });
  if (existing?.notifiedAt) return { created: false, alreadyNotified: true };

  const { review } = await generateMonthlyReview(previousMonthDate, options?.regenerate ?? true);
  if (review.notifiedAt) return { created: false, alreadyNotified: true };

  const sent = await pushFromGuru(
    "📊 Monthly report card is ready",
    "A month of prep, weighed and measured: syllabus movement, test trend, consistency, honesty audit and the strategy corrections for the new month. Open Report Card — this one deserves 15 focused minutes.",
    "win",
    "/report-card",
  );
  await db.monthlyReview.update({ where: { id: review.id }, data: { notifiedAt: new Date() } }).catch(() => {});
  return { created: true, ...sent };
}

/**
 * 7:00 AM IST briefing. IMPORTANT: this never creates todos by itself.
 * It builds the current-affairs digest, drafts a full day plan (subject
 * rotation, revisions, answer writing, CA reading, books) as a PENDING
 * proposal, and notifies the user. Todos are only created when the user
 * approves the plan inside the app (see lib/day-plan.ts approveDayPlan).
 * Every step is individually fenced so one failure cannot eat the rest.
 */
export async function runMorningBriefing() {
  const results: Record<string, unknown> = {};

  const digestOutcome = await getOrCreateTodayDigest().catch((error) => {
    console.error("[proactive] digest failed:", error);
    return null;
  });
  results.digestCreated = digestOutcome?.created ?? false;

  let title = "Your day plan is ready";
  let body =
    "Guru drafted today's plan from your tracker. Open the app to review and approve it onto your todo board.";

  try {
    const { plan } = await generateDayPlan();
    title = plan.briefingTitle;
    const proposedCount = (JSON.parse(plan.proposedTasksJson) as unknown[]).length;
    body = `${plan.briefingText} • ${proposedCount} task(s) proposed — open the app and tap Approve to load your todo board.`.slice(
      0,
      950,
    );
    results.planId = plan.id;
    results.proposedTasks = proposedCount;
  } catch (error) {
    console.error("[proactive] day plan failed, sending fallback briefing:", error);
    const todos = await getOpenTodos().catch(() => []);
    const topTodos = todos.slice(0, 3).map((todo) => todo.title).join(" • ");
    body = topTodos
      ? `Plan generation hit an error, but these todos are already open: ${topTodos}. Open the app to plan your day.`
      : "Plan generation hit an error. Open the app and ask Guru to plan your day.";
  }

  results.briefing = await pushFromGuru(title, body, "focus", "/todo").catch((error) => {
    console.error("[proactive] briefing push failed:", error);
    return { error: String(error) };
  });

  if (isSundayIST()) {
    results.weeklyReportCard = await announceWeeklyReportCard().catch((error) => {
      console.error("[proactive] weekly report card failed:", error);
      return { created: false, error: String(error) };
    });
  }

  if (isFirstOfMonthIST()) {
    results.monthlyReportCard = await announceMonthlyReportCard().catch((error) => {
      console.error("[proactive] monthly report card failed:", error);
      return { created: false, error: String(error) };
    });
  }

  return results;
}

/**
 * 9:00 PM IST streak guard: if nothing was logged today, nudge with the
 * pending todo list; if work was logged, stay silent unless critical todos
 * remain or today's logs failed the honesty cross-check.
 */
export async function runEveningGuard() {
  const dayStartUTC = new Date(istDayKey().getTime() - 5.5 * 60 * 60 * 1000);

  const results: Record<string, unknown> = {};

  // Catch-up: if the morning run died before announcing a due report card,
  // announce it now (no regeneration; notifiedAt keeps this idempotent).
  if (isSundayIST()) {
    results.weeklyReportCardCatchUp = await announceWeeklyReportCard({ regenerate: false }).catch((error) => {
      console.error("[proactive] weekly catch-up failed:", error);
      return { created: false, error: String(error) };
    });
  }
  if (isFirstOfMonthIST()) {
    results.monthlyReportCardCatchUp = await announceMonthlyReportCard({ regenerate: false }).catch((error) => {
      console.error("[proactive] monthly catch-up failed:", error);
      return { created: false, error: String(error) };
    });
  }

  const [studyToday, dailyToday, todos, integrityFlags] = await Promise.all([
    db.studyLog.count({ where: { logDate: { gte: dayStartUTC } } }),
    db.dailyLog.count({ where: { logDate: { gte: dayStartUTC }, totalHours: { gt: 0 } } }),
    getOpenTodos(),
    auditToday().catch((error) => {
      console.error("[proactive] today's integrity audit failed:", error);
      return [];
    }),
  ]);

  const loggedToday = studyToday > 0 || dailyToday > 0;
  const critical = todos.filter((todo) => todo.priority === "CRITICAL" || todo.priority === "HIGH");

  if (loggedToday && critical.length === 0 && integrityFlags.length === 0) {
    return { ...results, skipped: true, reason: "studied today, no high-priority todos pending, logs consistent" };
  }

  if (loggedToday && critical.length === 0 && integrityFlags.length > 0) {
    const sent = await pushFromGuru(
      "Your logs don't add up today",
      `${integrityFlags[0].detail} Fix the log (or the habit) before midnight — the weekly report card sees everything.`,
      "care",
      "/goals",
    );
    return { ...results, skipped: false, loggedToday, integrityNudge: true, ...sent };
  }

  const title = loggedToday ? "High-priority todos still open" : "Streak at risk — nothing logged today";
  const todoLines = (loggedToday ? critical : todos)
    .slice(0, 4)
    .map((todo) => `• ${todo.title}${todo.estimatedMinutes ? ` (~${todo.estimatedMinutes}m)` : ""}`)
    .join(" ");
  const body = loggedToday
    ? `Good work logging today. Before you wind down: ${todoLines || "review tomorrow's plan."}`
    : `No study log yet today. Even 45 focused minutes protects the streak. Pending: ${todoLines || "open the todo board and pick one."}`;

  const sent = await pushFromGuru(title, body, loggedToday ? "focus" : "urgent", "/todo");
  return { ...results, skipped: false, loggedToday, ...sent };
}
