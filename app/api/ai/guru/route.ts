import { stepCountIs, streamText, tool } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  buildAttachmentContextText,
  buildAttachmentDisplayLabel,
  processIncomingAttachments,
} from "@/lib/ai-attachments";
import {
  buildAgentMemoryDigest,
  getPrepPulse,
  getWeakAreas,
  logCrossExamQuestion,
  MEMORY_KINDS,
  recallAgentMemories,
  recordCrossExamAnswer,
  saveAgentMemory,
  updateAgentMemory,
} from "@/lib/agent-memory";
import {
  buildUPSCContext,
  buildUPSCSystemPrompt,
  refreshGuruMemoryProfile,
} from "@/lib/ai-context-builder";
import { normalizeGoogleModelId } from "@/lib/ai-models";
import { getSession } from "@/lib/auth";
import { addPyqQuestion, markPyqAsked, searchPyqQuestions } from "@/lib/pyq";
import { getDueRevisions } from "@/lib/spaced-revision";
import { computeMoodPerformanceCorrelation } from "@/lib/weekly-review";
import { db } from "@/lib/db";
import { createManualTodoTask, deleteAgentTask, updateAgentTaskStatus } from "@/lib/mission-control";
import {
  createStudyNode,
  deleteStudyNode,
  resolveNodeForCreate,
  resolveStudyNode,
  setStudyNodeCompletion,
  updateStudyNode,
} from "@/lib/study-tree";

export const runtime = "nodejs"; // agentic guru

const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    "",
});

function resolveModel(mode: "guru" | "deep-analytics" | "essay-checker") {
  const primary = process.env.GOOGLE_AI_MODEL_PRIMARY ?? "gemma-3-27b-it";
  const fallback = process.env.GOOGLE_AI_MODEL_FALLBACK ?? "gemma-3-12b-it";

  if (mode === "deep-analytics") {
    return process.env.GOOGLE_AI_MODEL_ANALYTICS ?? primary;
  }

  if (mode === "essay-checker") {
    return process.env.GOOGLE_AI_MODEL_ESSAY ?? primary;
  }

  return primary || fallback;
}

function resolveTemperature(mode: "guru" | "deep-analytics" | "essay-checker") {
  if (mode === "deep-analytics") return 0.4;
  if (mode === "essay-checker") return 0.6;
  return 0.7;
}

function shouldForceVisualForMessage(message: string, mode: "guru" | "deep-analytics" | "essay-checker") {
  if (mode !== "guru") return false;

  const normalized = message.toLowerCase();
  if (!normalized) return false;

  const visualIntentPatterns = [
    /\bexplain\b/,
    /\bhow\b/,
    /\bwhy\b/,
    /\bprocess\b/,
    /\bflow\b/,
    /\bworking\b/,
    /\bmechanism\b/,
    /\bcycle\b/,
    /\bstages?\b/,
    /\bsteps?\b/,
    /\bjourney\b/,
    /\bcompare\b/,
    /\bdifference\b/,
    /\bvs\b/,
    /\bdiagram\b/,
    /\bvisuali[sz]e\b/,
  ];

  const nonVisualPatterns = [
    /\btodo\b/,
    /\btask\b/,
    /\badd\b.+\b(topic|sub-topic|subtopic|chapter|subject)\b/,
    /\bdelete\b.+\b(topic|sub-topic|subtopic|chapter|subject)\b/,
    /\bupdate\b.+\b(topic|sub-topic|subtopic|chapter|subject)\b/,
    /\bmark\b.+\bcomplete\b/,
    /\bscore\b/,
    /\brank\b/,
    /\banalytics\b/,
  ];

  if (nonVisualPatterns.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  return visualIntentPatterns.some((pattern) => pattern.test(normalized));
}

function refreshStudyViews() {
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/ai-insight");
}

function revalidateStudyNodeChain(node: {
  slug: string;
  parent?: {
    slug: string;
    parent?: {
      slug: string;
      parent?: {
        slug: string;
      } | null;
    } | null;
  } | null;
}) {
  revalidatePath(`/study/${node.slug}`);

  if (node.parent?.slug) {
    revalidatePath(`/study/${node.parent.slug}`);
  }

  if (node.parent?.parent?.slug) {
    revalidatePath(`/study/${node.parent.parent.slug}`);
  }

  if (node.parent?.parent?.parent?.slug) {
    revalidatePath(`/study/${node.parent.parent.parent.slug}`);
  }
}

const syllabusOperationSchema = z.object({
  action: z.enum(["create", "update", "delete", "set_progress"]),
  targetType: z.enum(["subject", "chapter", "topic", "subtopic"]),
  paperTitle: z.string().optional(),
  subjectTitle: z.string().optional(),
  chapterTitle: z.string().optional(),
  topicTitle: z.string().optional(),
  subTopicTitle: z.string().optional(),
  title: z.string().optional(),
  newTitle: z.string().optional(),
  overview: z.string().optional(),
  details: z.string().optional(),
  completed: z.boolean().optional(),
});

const todoOperationSchema = z.object({
  action: z.enum(["create", "delete", "set_status"]),
  title: z.string().optional(),
  detail: z.string().optional(),
  taskType: z.enum(["PLANNING", "REVISION", "PRACTICE", "TEST", "ESSAY", "RECOVERY", "ANALYSIS"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  energyBand: z.enum(["LIGHT", "MEDIUM", "DEEP"]).optional(),
  dueLabel: z.string().optional(),
  estimatedMinutes: z.number().int().min(10).max(240).optional(),
  taskId: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "SKIPPED"]).optional(),
  paperTitle: z.string().optional(),
  subjectTitle: z.string().optional(),
  chapterTitle: z.string().optional(),
  topicTitle: z.string().optional(),
  subTopicTitle: z.string().optional(),
  targetType: z.enum(["subject", "chapter", "topic", "subtopic"]).optional(),
});

async function executeSyllabusOperation(input: z.infer<typeof syllabusOperationSchema>) {
  if (input.action === "create") {
    const parentNode = await resolveNodeForCreate({
      paperTitle: input.paperTitle,
      subjectTitle: input.subjectTitle,
      chapterTitle: input.targetType === "topic" || input.targetType === "subtopic" ? input.chapterTitle : undefined,
      topicTitle: input.targetType === "subtopic" ? input.topicTitle : undefined,
    });

    const title = String(
      input.title ??
        (input.targetType === "subject"
          ? input.subjectTitle
          : input.targetType === "chapter"
            ? input.chapterTitle
            : input.targetType === "topic"
              ? input.topicTitle
              : input.subTopicTitle) ??
        "",
    ).trim();
    if (!title) {
      throw new Error("A title is required to create a study node.");
    }

    const created = await createStudyNode({
      parentId: parentNode.id,
      title,
      overview: input.overview ?? null,
    });
    refreshStudyViews();
    revalidatePath(`/study/${parentNode.slug}`);
    revalidateStudyNodeChain(parentNode);

    return {
      ok: true,
      action: input.action,
      targetType: input.targetType,
      node: {
        id: created.node.id,
        title: created.node.title,
        slug: created.node.slug,
        type: created.node.type,
      },
      parent: {
        id: parentNode.id,
        title: parentNode.title,
        type: parentNode.type,
      },
      created: created.created,
    };
  }

  const resolved = await resolveStudyNode({
    paperTitle: input.paperTitle,
    subjectTitle: input.targetType === "subject" ? input.subjectTitle ?? input.title : input.subjectTitle,
    chapterTitle: input.targetType === "chapter" ? input.chapterTitle ?? input.title : input.chapterTitle,
    topicTitle: input.targetType === "topic" ? input.topicTitle ?? input.title : input.topicTitle,
    subTopicTitle: input.targetType === "subtopic" ? input.subTopicTitle ?? input.title : input.subTopicTitle,
    nodeTitle:
      input.targetType === "subject"
        ? input.subjectTitle ?? input.title
        : input.targetType === "chapter"
          ? input.chapterTitle ?? input.title
          : input.targetType === "topic"
            ? input.topicTitle ?? input.title
            : input.subTopicTitle ?? input.title,
  });

  if (input.action === "update") {
    const updated = await updateStudyNode({
      id: resolved.id,
      title: input.newTitle,
      overview: input.overview,
      details: input.details,
    });
    refreshStudyViews();
    revalidateStudyNodeChain(resolved);
    revalidatePath(`/study/${updated.slug}`);

    return {
      ok: true,
      action: input.action,
      targetType: input.targetType,
      node: {
        id: updated.id,
        title: updated.title,
        slug: updated.slug,
        type: updated.type,
      },
    };
  }

  if (input.action === "delete") {
    await deleteStudyNode(resolved.id);
    refreshStudyViews();
    revalidateStudyNodeChain(resolved);
    return {
      ok: true,
      action: input.action,
      targetType: input.targetType,
      deleted: {
        id: resolved.id,
        title: resolved.title,
        slug: resolved.slug,
      },
    };
  }

  if (input.completed === undefined) {
    throw new Error("A completion value is required for progress changes.");
  }

  const progressResult = await setStudyNodeCompletion({
    nodeId: resolved.id,
    completed: input.completed,
    cascade: input.targetType !== "subtopic",
  });
  refreshStudyViews();
  revalidateStudyNodeChain(resolved);

  return {
    ok: true,
    action: input.action,
    targetType: input.targetType,
    node: {
      id: resolved.id,
      title: resolved.title,
      slug: resolved.slug,
      type: resolved.type,
    },
    completion: input.completed,
    affectedNodes: progressResult.affectedNodes,
  };
}

async function resolveLinkedStudyNodeIdForTodo(input: z.infer<typeof todoOperationSchema>) {
  if (!input.targetType) return null;

  const resolved = await resolveStudyNode({
    paperTitle: input.paperTitle,
    subjectTitle: input.subjectTitle,
    chapterTitle: input.targetType === "chapter" || input.targetType === "topic" || input.targetType === "subtopic" ? input.chapterTitle : undefined,
    topicTitle: input.targetType === "topic" || input.targetType === "subtopic" ? input.topicTitle : undefined,
    subTopicTitle: input.targetType === "subtopic" ? input.subTopicTitle : undefined,
    nodeTitle:
      input.targetType === "subject"
        ? input.subjectTitle
        : input.targetType === "chapter"
          ? input.chapterTitle
          : input.targetType === "topic"
            ? input.topicTitle
            : input.subTopicTitle,
  });

  return resolved.id;
}

async function executeTodoOperation(input: z.infer<typeof todoOperationSchema>) {
  if (input.action === "create") {
    const title = String(input.title ?? "").trim();
    if (!title) {
      throw new Error("A todo title is required.");
    }

    const linkedStudyNodeId = await resolveLinkedStudyNodeIdForTodo(input);
    const task = await createManualTodoTask({
      title,
      detail: input.detail?.trim(),
      taskType: input.taskType ?? "PLANNING",
      priority: input.priority ?? "MEDIUM",
      energyBand: input.energyBand ?? "MEDIUM",
      dueLabel: input.dueLabel?.trim() || "This week",
      estimatedMinutes: input.estimatedMinutes ?? null,
      linkedStudyNodeId,
    });

    return { ok: true, action: input.action, task };
  }

  if (input.action === "delete") {
    if (!input.taskId) {
      throw new Error("A taskId is required to delete a todo.");
    }
    const deleted = await deleteAgentTask(input.taskId);
    return { action: input.action, ...deleted };
  }

  if (!input.taskId || !input.status) {
    throw new Error("A taskId and status are required to update a todo.");
  }

  const task = await updateAgentTaskStatus(input.taskId, input.status);
  return { ok: true, action: input.action, task };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const modeValue = formData.get("mode");
  const conversationIdValue = formData.get("conversationId");
  const messageValue = formData.get("message");
  const incomingFiles = formData
    .getAll("attachments")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const mode =
    modeValue === "deep-analytics" || modeValue === "essay-checker" || modeValue === "guru"
      ? modeValue
      : "guru";
  const conversationId = typeof conversationIdValue === "string" ? conversationIdValue : undefined;
  const userMessage = typeof messageValue === "string" ? messageValue.trim() : "";

  if (!userMessage && incomingFiles.length === 0) {
    return new Response("Message or file is required.", { status: 400 });
  }

  await refreshGuruMemoryProfile();

  const attachments = await processIncomingAttachments(incomingFiles);
  const attachmentText = buildAttachmentContextText(attachments);
  const attachmentLabel = buildAttachmentDisplayLabel(attachments);
  const shouldForceVisual = shouldForceVisualForMessage(userMessage, mode);

  const [context, memoryDigest] = await Promise.all([buildUPSCContext(), buildAgentMemoryDigest()]);
  const system = `${buildUPSCSystemPrompt(context, mode)}

LONG-TERM AGENT MEMORY (everything you have personally observed and chosen to remember about him):
${memoryDigest}

Agentic operating loop (JARVIS protocol):
- You are a stateful companion, not a stateless chatbot. Before advising, pull live evidence with get_prep_pulse, get_weak_areas, or recall_memories when the answer depends on his actual behavior, and reason over the results in follow-up steps.
- Memory discipline: whenever he reveals something durable (a personal fact, relationship update, emotional pattern, commitment, recurring mistake, strength, preference, current-affairs habit), persist it with save_memory in the same turn. Correct or retire stale memories with update_memory. Never re-ask things you already remember.
- Cross-examination: when he claims to have studied or mastered something, or when a weak topic resurfaces, challenge him with one sharp question and log it with ask_cross_exam_question. Prefer real previous-year questions: call search_pyqs first and use a matching PYQ verbatim (then mark it with mark_pyq_asked); generate a question only when no PYQ fits. When his message answers a pending cross-exam question (listed above), grade it honestly with record_cross_exam_answer (verdict, score /10, feedback) before responding. Failed questions come back for re-testing; re-ask them naturally.
- Directive mode: when asked "what should I do now" or similar, never answer generically. Call get_prep_pulse and get_weak_areas first, then give one specific, time-boxed prescription tied to his data, and create the todo for it.
- Personal radar: track mood, stress, relationship and life context from memory and mood data. If stress or distraction is trending up, address it before the academic question, with care, not lectures.
- Keep tool usage purposeful: at most a few calls per turn, then commit to a final answer.

Tooling rules for syllabus operations:
- If the user asks to add, edit, delete, or mark complete/incomplete any subject, chapter, topic, or sub-topic, use the syllabus management tool instead of only describing the steps.
- If the user explicitly asks to add a topic or sub-topic, create only that requested level. If the user asks to add a chapter, create only a chapter. Do not silently swap target types.
- If the user asks for multiple syllabus changes in one message, execute all of them with the batch syllabus tool.
- Treat "status" as completion progress.
- For subject, chapter, and topic completion changes, update the full subtree unless the user explicitly asks for only one item. Sub-topic completion changes affect only that sub-topic.
- Duplicate names are allowed at subject, chapter, topic, and sub-topic level; use the user's requested title as a new node when the intent is creation.
- If the user asks to create, update, or delete todos, use the todo tool instead of only describing the steps.
- If a target reference is ambiguous, ask a short clarifying question in the final answer.`;

  const conversation =
    (conversationId
      ? await db.aiConversation.findUnique({
          where: { id: conversationId },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              include: { attachments: true },
            },
          },
        })
      : null) ??
    (await db.aiConversation.create({
      data: {
        title: userMessage.slice(0, 72) || attachmentLabel || "UPSC Guru",
        persona: "guru",
      },
      include: { messages: { include: { attachments: true } } },
    }));

  const savedUserMessage = await db.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: userMessage || `Attached files: ${attachmentLabel || "attachments"}`,
      attachmentText: attachmentText || null,
      attachments: {
        create: attachments.map((attachment) => ({
          kind: attachment.kind.toUpperCase(),
          name: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          extractedText: attachment.extractedText,
        })),
      },
    },
  });

  const modelId = normalizeGoogleModelId(resolveModel(mode));
  const result = streamText({
    model: google(modelId),
    system,
    messages: [
      ...conversation.messages.slice(-12).map((message) => ({
        role: message.role as "user" | "assistant",
        content: [
          {
            type: "text" as const,
            text: message.attachmentText
              ? `${message.content}\n\nAttachment context:\n${message.attachmentText}`
              : message.content,
          },
        ],
      })),
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `Live UPSC context JSON:
${JSON.stringify(context, null, 2)}

Current attachment context:
${attachmentText || "No attachment text extracted."}

Student message:
${userMessage || "Analyze all attached files carefully and answer accurately."}

Instructions for this turn:
- If multiple images or PDFs are attached, examine all of them before concluding.
- For academic and study questions, keep the tone moderate to strict, never harsh for the sake of harshness.
- If the files and the question conflict, state that explicitly and explain why.
- For concept explanation, process explanation, or mechanism-style questions, first answer normally in clean markdown.
- ${shouldForceVisual ? "This student message clearly benefits from a visual explanation, so append one visual schema block after the prose answer." : "After the normal answer, optionally append one visual schema block if it would genuinely help understanding."}
- The visual schema must use this exact format with valid JSON and no code fence:
<guru_visual>
{"title":"short topic title","summary":"one-line recap","theme":"economy","view":"chain","focus":"one-line main mechanism","highlights":["key idea one","key idea two"],"nodes":[{"id":"n1","label":"Repo Rate","detail":"RBI raises benchmark rate","kind":"institution","accent":"gold","zone":"RBI"},{"id":"n2","label":"Cost of Credit","detail":"Borrowing becomes costlier","kind":"pressure","accent":"sage","zone":"Banks"}],"edges":[{"from":"n1","to":"n2","label":"tightens"}],"steps":[{"title":"step title","detail":"one short explanation","accent":"gold","cue":"short cue"},{"title":"step title","detail":"one short explanation","accent":"blue","cue":"short cue"}]}
</guru_visual>
- Allowed view values are "chain", "compare", "cycle", or "layers".
- Allowed theme values are "generic", "geopolitics", "geography", "polity", "economy", "science", "history", "society", "environment", or "ethics".
- Allowed node kind values are "actor", "institution", "region", "pressure", "input", "output", "process", and "outcome".
- Use "chain" for sequential mechanisms, "compare" for contrast questions, "cycle" for recurring loops, and "layers" for stacked institutional or conceptual explanations.
- For climate, geography, economy, polity, biology, or science mechanism topics, prefer "chain" and write each step detail as "what changes; main outcome".
- Do not use "compare" unless the user explicitly asks for differences, contrast, versus, or side-by-side comparison.
- Rendering-depth decision rule:
  1. Choose the visual structure that will help the student understand this topic most clearly.
  2. Use step or card scenes when the idea is linear, compact, and best understood as a clean sequence.
  3. Use semantic nodes and edges when the explanation depends on actors, regions, institutions, pressure transmission, branching, routing, or multiple interacting entities.
  4. If node-edge structure would add clutter without adding clarity, do not use it.
  5. If the topic is mechanism-heavy but still simple, use a compact scene rather than forcing graph output.
  6. If the topic is system-heavy, map-heavy, governance-heavy, or transmission-heavy, prefer nodes and edges when that improves comprehension.
  7. Do not follow any fixed hierarchy between cards and graphs. Select purely on explanatory fit for this exact topic.
- Keep "focus" short and high-signal. Keep "highlights" to 2 to 4 short phrases.
- Keep each "cue" under 18 characters.
- For economy, geography, and polity topics, prefer adding semantic "nodes" and "edges" as well, not only "steps".
- For economy, use node kinds like institution, pressure, input, output, and outcome.
- For geography, use node kinds like process, region, input, and outcome.
- For polity, use node kinds like actor, institution, process, and output.
- For history, prefer chronology-oriented nodes and outcome nodes.
- For society, prefer actor, pressure, institution, and outcome nodes.
- For environment, prefer process, region, input, pressure, and outcome nodes.
- For ethics, prefer actor, process, input, and outcome nodes.
- Keep "nodes" between 2 and 8 and "edges" between 1 and 12.
- Keep the visual schema lightweight: 3 to 5 steps, each detail under 140 characters.
- If both steps and nodes are present, make them consistent views of the same explanation, not two separate stories.
- Never mention the JSON block in the prose. Never output more than one <guru_visual> block.`,
          },
          ...attachments.map((attachment) => attachment.contentPart),
        ],
      },
    ],
    temperature: resolveTemperature(mode),
    maxOutputTokens: 4096,
    stopWhen: stepCountIs(8),
    tools: {
      get_prep_pulse: tool({
        description:
          "Read the live preparation pulse: study frequency and streak over the last 14 days, current-affairs consistency, mood and stress trend, recent test scores, distraction screen-time, and cross-exam accuracy. Call this before giving any 'what should I do now' or performance advice.",
        inputSchema: z.object({}),
        execute: async () => getPrepPulse(),
      }),
      get_weak_areas: tool({
        description:
          "Read his current weak areas: topics with the most wrong/skipped questions from the last 60 days of test logs (with error types), plus completed topics overdue for revision.",
        inputSchema: z.object({}),
        execute: async () => getWeakAreas(),
      }),
      save_memory: tool({
        description:
          "Persist a durable observation about Adarsh into long-term memory: personal facts, relationship updates, emotional patterns, commitments he makes, recurring mistakes, strengths, preferences, or current-affairs habits. Use whenever he reveals something worth remembering across conversations.",
        inputSchema: z.object({
          kind: z.enum(MEMORY_KINDS),
          content: z.string().min(8).max(600).describe("One self-contained sentence stating the fact or pattern."),
          sourceNote: z.string().max(255).optional().describe("Where this came from, e.g. 'chat 2026-06-10'."),
          importance: z.number().int().min(1).max(5).optional(),
        }),
        execute: async (input) => saveAgentMemory(input),
      }),
      update_memory: tool({
        description: "Correct a stale memory's content or importance, or archive it when no longer true.",
        inputSchema: z.object({
          memoryId: z.string(),
          content: z.string().max(600).optional(),
          importance: z.number().int().min(1).max(5).optional(),
          archive: z.boolean().optional(),
        }),
        execute: async (input) => updateAgentMemory(input),
      }),
      recall_memories: tool({
        description:
          "Search long-term memory beyond the digest in the system prompt. Use keyword query and/or kind filter when you need older or more specific memories.",
        inputSchema: z.object({
          query: z.string().max(200).optional(),
          kind: z.enum(MEMORY_KINDS).optional(),
          limit: z.number().int().min(1).max(30).optional(),
        }),
        execute: async (input) => recallAgentMemories(input),
      }),
      ask_cross_exam_question: tool({
        description:
          "Log a cross-examination question you are asking him in this reply, so his future answer can be graded and weak answers re-tested later. Include the model answer points.",
        inputSchema: z.object({
          question: z.string().min(10).max(800),
          expectedPoints: z.string().max(1200).optional(),
          topicLabel: z.string().max(255).optional(),
          subjectLabel: z.string().max(120).optional(),
        }),
        execute: async (input) => logCrossExamQuestion(input),
      }),
      search_pyqs: tool({
        description:
          "Search the stored bank of real UPSC previous-year questions by keywords, subject, topic, or exam stage. Use before cross-examining so you quiz with authentic PYQs.",
        inputSchema: z.object({
          query: z.string().max(200).optional(),
          subject: z.string().max(120).optional(),
          topic: z.string().max(255).optional(),
          examStage: z.enum(["PRELIMS", "MAINS"]).optional(),
          limit: z.number().int().min(1).max(20).optional(),
        }),
        execute: async (input) => searchPyqQuestions(input),
      }),
      add_pyq: tool({
        description:
          "Store a real UPSC previous-year question into the PYQ bank (e.g. when the user pastes PYQs or you encounter one in an attached PDF). These feed the simulator and cross-exam.",
        inputSchema: z.object({
          year: z.number().int().min(1995).max(2030),
          examStage: z.enum(["PRELIMS", "MAINS"]).optional(),
          paper: z.string().max(80).optional(),
          subject: z.string().max(120).optional(),
          topic: z.string().max(255).optional(),
          question: z.string().min(10).max(3000),
          options: z.array(z.string()).max(6).optional(),
          correctAnswer: z.string().max(1000).optional(),
          explanation: z.string().max(2000).optional(),
        }),
        execute: async (input) => addPyqQuestion(input),
      }),
      mark_pyq_asked: tool({
        description: "Mark a PYQ as used after asking it in a cross-examination, so it rotates fairly.",
        inputSchema: z.object({ pyqId: z.string() }),
        execute: async (input) => markPyqAsked(input.pyqId),
      }),
      get_mood_performance_correlation: tool({
        description:
          "Compute Pearson correlations between his mood signals (stress, energy, confidence) and performance (study hours, focus, test scores) over the last 60 days. Use when discussing burnout, consistency, or mood-linked performance patterns.",
        inputSchema: z.object({}),
        execute: async () => computeMoodPerformanceCorrelation(),
      }),
      get_due_revisions: tool({
        description:
          "List topics overdue for spaced-repetition revision (intervals 1/3/7/21/45/90 days). Use when planning his day or auditing revision discipline.",
        inputSchema: z.object({ limit: z.number().int().min(1).max(20).optional() }),
        execute: async (input) => getDueRevisions(input.limit ?? 12),
      }),
      record_cross_exam_answer: tool({
        description:
          "Grade his answer to a pending cross-exam question (entry IDs are listed in the system prompt). Wrong or partial answers are automatically scheduled for re-testing.",
        inputSchema: z.object({
          entryId: z.string(),
          userAnswer: z.string().min(1).max(4000),
          verdict: z.enum(["CORRECT", "PARTIAL", "INCORRECT"]),
          score: z.number().int().min(0).max(10).optional(),
          feedback: z.string().max(1200).optional(),
        }),
        execute: async (input) => recordCrossExamAnswer(input),
      }),
      manage_syllabus: tool({
        description:
          "Add, edit, delete, or change completion progress for a subject, chapter, topic, or sub-topic in the UPSC study tree.",
        inputSchema: syllabusOperationSchema,
        execute: executeSyllabusOperation,
      }),
      manage_syllabus_batch: tool({
        description:
          "Execute multiple syllabus operations in one request, such as adding several topics or sub-topics across different subjects and chapters.",
        inputSchema: z.object({
          operations: z.array(syllabusOperationSchema).min(1).max(20),
        }),
        execute: async (input) => {
          const results = [];
          for (const operation of input.operations) {
            results.push(await executeSyllabusOperation(operation));
          }
          return { ok: true, count: results.length, results };
        },
      }),
      manage_todos: tool({
        description:
          "Create, update status, or delete a todo task. Use this when the user asks to create a todo or modify a task.",
        inputSchema: todoOperationSchema,
        execute: executeTodoOperation,
      }),
      manage_todos_batch: tool({
        description:
          "Execute multiple todo operations in one request, such as creating several todos tied to different subjects or chapters.",
        inputSchema: z.object({
          operations: z.array(todoOperationSchema).min(1).max(20),
        }),
        execute: async (input) => {
          const results = [];
          for (const operation of input.operations) {
            results.push(await executeTodoOperation(operation));
          }
          return { ok: true, count: results.length, results };
        },
      }),
    },
    onFinish: async (event) => {
      await db.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: event.text,
          attachmentText: null,
        },
      });

      await refreshGuruMemoryProfile();

      await db.aiConversation.update({
        where: { id: conversation.id },
        data: {
          title:
            conversation.title === "UPSC Guru" || conversation.title === "New chat"
              ? (userMessage || attachmentLabel || "UPSC Guru").slice(0, 72)
              : conversation.title,
        },
      });
    },
  });

  return result.toTextStreamResponse({
    headers: {
      "x-conversation-id": conversation.id,
      "x-user-message-id": savedUserMessage.id,
    },
  });
}
