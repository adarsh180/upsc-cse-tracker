"use server";

import pdfParse from "pdf-parse";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { createSession, destroySession, requireSession } from "@/lib/auth";
import { refreshGuruMemoryProfile } from "@/lib/ai-context-builder";
import { db } from "@/lib/db";
import { getDashboardSummary } from "@/lib/dashboard";
import {
  activateMission,
  applyMissionDailyLog,
  createManualTodoTask,
  createAgentMission,
  updateAgentTaskStatus,
} from "@/lib/mission-control";
import { normalizeGoogleModelId } from "@/lib/ai-models";
import { createStudyNode, deleteStudyNode, updateStudyNode } from "@/lib/study-tree";
import { slugify } from "@/lib/utils";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

async function uniqueSlug(base: string) {
  const normalized = slugify(base);
  let candidate = normalized;
  let counter = 2;

  while (await db.studyNode.findUnique({ where: { slug: candidate } })) {
    candidate = `${normalized}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function refreshCorePages(pathname?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/tests");
  revalidatePath("/performance");
  revalidatePath("/mood");
  revalidatePath("/ai-insight");
  revalidatePath("/mission-control");
  revalidatePath("/todo");
  revalidatePath("/");

  if (pathname) {
    revalidatePath(pathname);
  }
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (
    email === (process.env.AUTH_EMAIL ?? "") &&
    password === (process.env.AUTH_PASSWORD ?? "")
  ) {
    await createSession(email);
    redirect("/dashboard");
  }

  redirect("/sign-in?error=invalid");
}

export async function signOutAction() {
  await destroySession();
  redirect("/sign-in");
}

export async function createStudyNodeAction(formData: FormData) {
  const parentId = String(formData.get("parentId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const overview = String(formData.get("overview") ?? "").trim();
  const pathname = String(formData.get("pathname") ?? "");

  if (!title) {
    return;
  }

  await createStudyNode({
    parentId,
    title,
    overview,
  });

  refreshCorePages(pathname);
}

export async function deleteStudyNodeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const pathname = String(formData.get("pathname") ?? "");

  if (!id) {
    return;
  }

  await deleteStudyNode(id);

  refreshCorePages(pathname);
}

export async function toggleTopicProgressAction(formData: FormData) {
  const studyNodeId = String(formData.get("studyNodeId") ?? "");
  const checked = formData.get("checked") === "true";
  const pathname = String(formData.get("pathname") ?? "");

  if (!studyNodeId) return;

  await db.topicProgress.upsert({
    where: { studyNodeId },
    update: {
      checked,
      checkedAt: checked ? new Date() : null,
    },
    create: {
      studyNodeId,
      checked,
      checkedAt: checked ? new Date() : null,
    },
  });

  if (pathname) revalidatePath(pathname);
}

export async function addStudyLogAction(formData: FormData) {
  await db.studyLog.create({
    data: {
      studyNodeId: String(formData.get("studyNodeId") ?? "") || null,
      title: String(formData.get("title") ?? "Study log"),
      logDate: new Date(String(formData.get("logDate") ?? new Date().toISOString())),
      hours: Number(formData.get("hours") ?? 0),
      topicCount: Number(formData.get("topicCount") ?? 0),
      completion: Number(formData.get("completion") ?? 0),
      focusScore: Number(formData.get("focusScore") ?? 0) || null,
      notes: String(formData.get("notes") ?? ""),
    },
  });

  refreshCorePages(String(formData.get("pathname") ?? ""));
}

export async function saveDailyGoalAction(formData: FormData) {
  const logDate = new Date(String(formData.get("logDate") ?? new Date().toISOString()));

  await db.dailyLog.upsert({
    where: { logDate },
    update: {
      primaryFocus: String(formData.get("primaryFocus") ?? ""),
      totalHours: Number(formData.get("totalHours") ?? 0),
      questionsSolved: Number(formData.get("questionsSolved") ?? 0),
      topicsStudied: Number(formData.get("topicsStudied") ?? 0),
      wins: String(formData.get("wins") ?? ""),
      blockers: String(formData.get("blockers") ?? ""),
      tomorrowPlan: String(formData.get("tomorrowPlan") ?? ""),
      disciplineScore: Number(formData.get("disciplineScore") ?? 0),
      completion: Number(formData.get("completion") ?? 0),
    },
    create: {
      logDate,
      primaryFocus: String(formData.get("primaryFocus") ?? ""),
      totalHours: Number(formData.get("totalHours") ?? 0),
      questionsSolved: Number(formData.get("questionsSolved") ?? 0),
      topicsStudied: Number(formData.get("topicsStudied") ?? 0),
      wins: String(formData.get("wins") ?? ""),
      blockers: String(formData.get("blockers") ?? ""),
      tomorrowPlan: String(formData.get("tomorrowPlan") ?? ""),
      disciplineScore: Number(formData.get("disciplineScore") ?? 0),
      completion: Number(formData.get("completion") ?? 0),
    },
  });

  refreshCorePages("/goals");
}

export async function saveMoodAction(formData: FormData) {
  const rawDate = String(formData.get("moodDate") ?? "");
  const baseDate = rawDate ? new Date(`${rawDate}T00:00:00+05:30`) : new Date();
  const dayStart = new Date(baseDate);
  const dayEnd = new Date(baseDate);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const moodDate = rawDate ? new Date(`${rawDate}T12:00:00+05:30`) : new Date();

  const existing = await db.moodEntry.findFirst({
    where: {
      moodDate: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  });

  if (existing) {
    await db.moodEntry.update({
      where: { id: existing.id },
      data: {
        moodDate,
        label: String(formData.get("label") ?? "Steady"),
        energy: Number(formData.get("energy") ?? 5),
        focus: Number(formData.get("focus") ?? 5),
        stress: Number(formData.get("stress") ?? 5),
        confidence: Number(formData.get("confidence") ?? 5),
        consistency: Number(formData.get("consistency") ?? 5),
        notes: String(formData.get("notes") ?? ""),
      },
    });
  } else {
    await db.moodEntry.create({
      data: {
        moodDate,
        label: String(formData.get("label") ?? "Steady"),
        energy: Number(formData.get("energy") ?? 5),
        focus: Number(formData.get("focus") ?? 5),
        stress: Number(formData.get("stress") ?? 5),
        confidence: Number(formData.get("confidence") ?? 5),
        consistency: Number(formData.get("consistency") ?? 5),
        notes: String(formData.get("notes") ?? ""),
      },
    });
  }

  refreshCorePages("/mood");
}

export async function saveTestAction(formData: FormData) {
  await db.testRecord.create({
    data: {
      studyNodeId: String(formData.get("studyNodeId") ?? "") || null,
      title: String(formData.get("title") ?? "Untitled test"),
      examStage: String(formData.get("examStage") ?? "PRELIMS"),
      testType: String(formData.get("testType") ?? "SECTIONAL"),
      testDate: new Date(String(formData.get("testDate") ?? new Date().toISOString())),
      totalMarks: Number(formData.get("totalMarks") ?? 0),
      score: Number(formData.get("score") ?? 0),
      correctQuestions: Number(formData.get("correctQuestions") ?? 0) || null,
      incorrectQuestions: Number(formData.get("incorrectQuestions") ?? 0) || null,
      attemptedQuestions: Number(formData.get("attemptedQuestions") ?? 0) || null,
      percentile: Number(formData.get("percentile") ?? 0) || null,
      timeMinutes: Number(formData.get("timeMinutes") ?? 0) || null,
      notes: String(formData.get("notes") ?? ""),
    },
  });

  refreshCorePages("/tests");
}

export async function updateTestAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.testRecord.update({
    where: { id },
    data: {
      studyNodeId: String(formData.get("studyNodeId") ?? "") || null,
      title: String(formData.get("title") ?? "Untitled test"),
      examStage: String(formData.get("examStage") ?? "PRELIMS"),
      testType: String(formData.get("testType") ?? "SECTIONAL"),
      testDate: new Date(String(formData.get("testDate") ?? new Date().toISOString())),
      totalMarks: Number(formData.get("totalMarks") ?? 0),
      score: Number(formData.get("score") ?? 0),
      correctQuestions: Number(formData.get("correctQuestions") ?? 0) || null,
      incorrectQuestions: Number(formData.get("incorrectQuestions") ?? 0) || null,
      attemptedQuestions: Number(formData.get("attemptedQuestions") ?? 0) || null,
      percentile: Number(formData.get("percentile") ?? 0) || null,
      timeMinutes: Number(formData.get("timeMinutes") ?? 0) || null,
      notes: String(formData.get("notes") ?? ""),
    },
  });
  refreshCorePages("/tests");
}

export async function deleteTestAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.testRecord.delete({ where: { id } });
  refreshCorePages("/tests");
}

export async function deleteDailyGoalAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.dailyLog.delete({ where: { id } });
  refreshCorePages("/goals");
}

export async function updateStudyNodeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const overview = String(formData.get("overview") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const pathname = String(formData.get("pathname") ?? "");
  if (!id || !title) return;
  await updateStudyNode({
    id,
    title,
    overview,
    details,
  });
  refreshCorePages(pathname);
}

export async function deleteStudyLogAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const pathname = String(formData.get("pathname") ?? "");
  if (!id) return;
  await db.studyLog.delete({ where: { id } });
  if (pathname) revalidatePath(pathname);
  refreshCorePages(pathname);
}
async function generateWithFallback(prompt: string) {
  const candidates = [
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
        prompt,
      });

      return {
        text: result.text,
        model: normalizeGoogleModelId(candidate),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No AI model could complete the request.");
}

async function buildAnalyticsContext() {
  const summary = await getDashboardSummary();
  const latestTests = summary.tests.slice(-5).map((test) => ({
    title: test.title,
    stage: test.examStage,
    type: test.testType,
    score: test.score,
    totalMarks: test.totalMarks,
  }));

  return JSON.stringify(
    {
      metrics: summary.metrics,
      recentDailyLogs: summary.dailyLogs.slice(0, 7),
      recentMood: summary.moods.slice(0, 7),
      recentTests: latestTests,
    },
    null,
    2,
  );
}

async function getOrCreateConversation() {
  const conversation =
    (await db.aiConversation.findFirst({
      where: { persona: "guru" },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })) ??
    (await db.aiConversation.create({
      data: {
        title: "UPSC Guru",
        persona: "guru",
      },
      include: { messages: true },
    }));

  return conversation;
}

const AI_MEMORY_REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export async function sendGuruMessageAction(formData: FormData) {
  const userMessage = String(formData.get("message") ?? "").trim();
  const attachment = formData.get("attachment");

  if (!userMessage && !(attachment instanceof File && attachment.size > 0)) {
    return;
  }

  const conversation = await getOrCreateConversation();
  let attachmentText = "";

  if (attachment instanceof File && attachment.size > 0 && attachment.type === "application/pdf") {
    const buffer = Buffer.from(await attachment.arrayBuffer());
    const parsed = await pdfParse(buffer);
    attachmentText = parsed.text.slice(0, 15000);
  }

  const analyticsContext = await buildAnalyticsContext();
  const history = conversation.messages
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  const prompt = `You are UPSC Guru, a very strict but fair mentor for Adarsh's third UPSC 2027 attempt.
Keep the tone clean, direct, disciplined and professional.
Prefer short paragraphs, numbered sections and clean markdown tables when structure helps.
Avoid decorative symbols, decorative bullet spam, markdown clutter and unnecessary filler.
Do not start with fake praise or softening language.
Stay strict until progress trends are above 90 percent, then become more moderate.
Use the student metrics below to detect inconsistency, bluffing, low discipline, mood patterns and weak test performance.

Current analytics:
${analyticsContext}

Conversation history:
${history}

PDF context:
${attachmentText || "No PDF was attached."}

Student message:
${userMessage || "Please review the attached PDF and respond."}`;

  await db.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: userMessage || "Uploaded a PDF for review.",
      attachmentText: attachmentText || null,
    },
  });

  const result = await generateWithFallback(prompt);

  await db.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: result.text,
      attachmentText: result.model,
    },
  });

  // Time-gated memory refresh — skip if refreshed within last 5 minutes
  const existingMemory = await db.aiMemoryProfile.findUnique({ where: { persona: "guru" } });
  const lastRefreshed = existingMemory?.updatedAt ?? null;
  const shouldRefresh =
    !lastRefreshed ||
    Date.now() - new Date(lastRefreshed).getTime() > AI_MEMORY_REFRESH_COOLDOWN_MS;

  if (shouldRefresh) {
    await refreshGuruMemoryProfile();
  }

  refreshCorePages("/ai-insight");
}

export async function evaluateEssayAction(formData: FormData) {
  const title = String(formData.get("title") ?? "Essay practice").trim();
  const promptText = String(formData.get("prompt") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!content) {
    return;
  }

  const result = await generateWithFallback(`You are evaluating a UPSC essay.
Assess structure, argument depth, balance, examples, conclusion quality and UPSC suitability.
Return a short heading, a score out of 100, key strengths, key weaknesses and the next rewrite plan.
Do not use markdown bullets with hyphens or asterisks.

Essay prompt:
${promptText}

Essay title:
${title}

Essay:
${content}`);

  const scoreMatch = result.text.match(/(\d{1,3})(?:\/100| out of 100)?/i);

  await db.essaySubmission.create({
    data: {
      title,
      prompt: promptText,
      content,
      feedback: result.text,
      score: scoreMatch ? Number(scoreMatch[1]) : null,
    },
  });

  refreshCorePages("/ai-insight");
}

export async function launchMissionControlAction(formData: FormData) {
  await requireSession();
  const goal = String(formData.get("goal") ?? "").trim();

  await createAgentMission(goal);
  refreshCorePages("/mission-control");
}

export async function activateMissionAction(formData: FormData) {
  await requireSession();
  const missionId = String(formData.get("missionId") ?? "").trim();
  if (!missionId) return;

  await activateMission(missionId);
  refreshCorePages("/mission-control");
}

export async function applyMissionDailyLogAction(formData: FormData) {
  await requireSession();
  const missionId = String(formData.get("missionId") ?? "").trim();
  if (!missionId) return;

  await applyMissionDailyLog(missionId);
  refreshCorePages("/goals");
}

export async function updateMissionTaskStatusAction(formData: FormData) {
  await requireSession();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!taskId || !["TODO", "IN_PROGRESS", "DONE", "SKIPPED"].includes(status)) {
    return;
  }

  await updateAgentTaskStatus(
    taskId,
    status as "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED",
  );
  refreshCorePages("/todo");
}

export async function createManualTodoTaskAction(formData: FormData) {
  await requireSession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await createManualTodoTask({
    title,
    detail: String(formData.get("detail") ?? "").trim(),
    taskType: String(formData.get("taskType") ?? "PLANNING").trim() || "PLANNING",
    priority: String(formData.get("priority") ?? "MEDIUM").trim() || "MEDIUM",
    energyBand: String(formData.get("energyBand") ?? "MEDIUM").trim() || "MEDIUM",
    estimatedMinutes: Number(formData.get("estimatedMinutes") ?? 0) || null,
    dueLabel: String(formData.get("dueLabel") ?? "").trim() || "This week",
    linkedStudyNodeId: String(formData.get("linkedStudyNodeId") ?? "").trim() || null,
  });

  refreshCorePages("/todo");
}

export async function deleteMissionHistoryAction(formData: FormData) {
  await requireSession();
  const missionId = String(formData.get("missionId") ?? "").trim();
  if (!missionId) return;

  await db.agentMission.update({
    where: { id: missionId },
    data: { status: "HIDDEN" },
  });

  refreshCorePages("/mission-control");
}
