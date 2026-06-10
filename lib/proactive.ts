import { getOrCreateTodayDigest, istDayKey } from "@/lib/current-affairs";
import { generateDayPlan } from "@/lib/day-plan";
import { db } from "@/lib/db";
import { sendDiscordNotification } from "@/lib/discord";
import { sendTelegramNotification } from "@/lib/telegram";
import { sendWebPushNotification } from "@/lib/web-push";
import { generateWeeklyReview, isSundayIST } from "@/lib/weekly-review";

function getAppBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  return raw?.replace(/\/$/, "") ?? null;
}

/** Broadcast a Guru notification to every channel: in-app + web push + Discord + Telegram. */
async function pushFromGuru(title: string, body: string, tone: "focus" | "urgent" | "care" | "win") {
  const notification = await db.appNotification.create({
    data: { title, body, tone, senderLabel: "Guru" },
  });

  const baseUrl = getAppBaseUrl();
  const [push, discord, telegram] = await Promise.all([
    sendWebPushNotification(notification).catch((error) => {
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
 * 7:00 AM IST briefing. IMPORTANT: this never creates todos by itself.
 * It builds the current-affairs digest, drafts a full day plan (subject
 * rotation, revisions, answer writing, CA reading, books) as a PENDING
 * proposal, and notifies the user. Todos are only created when the user
 * approves the plan inside the app (see lib/day-plan.ts approveDayPlan).
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
    const todos = await getOpenTodos();
    const topTodos = todos.slice(0, 3).map((todo) => todo.title).join(" • ");
    body = topTodos
      ? `Plan generation hit an error, but these todos are already open: ${topTodos}. Open the app to plan your day.`
      : "Plan generation hit an error. Open the app and ask Guru to plan your day.";
  }

  results.briefing = await pushFromGuru(title, body, "focus");

  if (isSundayIST()) {
    results.weeklyReview = await generateWeeklyReview()
      .then((outcome) => ({ created: outcome.created }))
      .catch((error) => {
        console.error("[proactive] weekly review failed:", error);
        return { created: false };
      });
  }

  return results;
}

/**
 * 9:00 PM IST streak guard: if nothing was logged today, nudge with the
 * pending todo list; if work was logged, stay silent unless critical todos remain.
 */
export async function runEveningGuard() {
  const dayStartUTC = new Date(istDayKey().getTime() - 5.5 * 60 * 60 * 1000);

  const [studyToday, dailyToday, todos] = await Promise.all([
    db.studyLog.count({ where: { logDate: { gte: dayStartUTC } } }),
    db.dailyLog.count({ where: { logDate: { gte: dayStartUTC }, totalHours: { gt: 0 } } }),
    getOpenTodos(),
  ]);

  const loggedToday = studyToday > 0 || dailyToday > 0;
  const critical = todos.filter((todo) => todo.priority === "CRITICAL" || todo.priority === "HIGH");

  if (loggedToday && critical.length === 0) {
    return { skipped: true, reason: "studied today, no high-priority todos pending" };
  }

  const title = loggedToday ? "High-priority todos still open" : "Streak at risk — nothing logged today";
  const todoLines = (loggedToday ? critical : todos)
    .slice(0, 4)
    .map((todo) => `• ${todo.title}${todo.estimatedMinutes ? ` (~${todo.estimatedMinutes}m)` : ""}`)
    .join(" ");
  const body = loggedToday
    ? `Good work logging today. Before you wind down: ${todoLines || "review tomorrow's plan."}`
    : `No study log yet today. Even 45 focused minutes protects the streak. Pending: ${todoLines || "open the todo board and pick one."}`;

  const sent = await pushFromGuru(title, body, loggedToday ? "focus" : "urgent");
  return { skipped: false, loggedToday, ...sent };
}
