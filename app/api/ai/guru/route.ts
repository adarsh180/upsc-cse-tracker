import pdfParse from "pdf-parse";
import { streamText, tool } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  buildUPSCContext,
  buildUPSCSystemPrompt,
  refreshGuruMemoryProfile,
} from "@/lib/ai-context-builder";
import { normalizeGoogleModelId } from "@/lib/ai-models";
import { db } from "@/lib/db";
import {
  createStudyNode,
  deleteStudyNode,
  resolveNodeForCreate,
  resolveStudyNode,
  setStudyNodeCompletion,
  updateStudyNode,
} from "@/lib/study-tree";

export const runtime = "nodejs";

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
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    conversationId?: string;
    message?: string;
    file?: { base64: string; mimeType: string; name: string } | null;
    mode?: "guru" | "deep-analytics" | "essay-checker";
  };

  const mode = body.mode ?? "guru";
  const userMessage = String(body.message ?? "").trim();
  const file = body.file;

  if (!userMessage && !file) {
    return new Response("Message or file is required.", { status: 400 });
  }

  await refreshGuruMemoryProfile();

  let attachmentText = "";
  if (file?.base64 && file.mimeType === "application/pdf") {
    const buffer = Buffer.from(file.base64, "base64");
    const parsed = await pdfParse(buffer);
    attachmentText = parsed.text.slice(0, 20000);
  }

  const context = await buildUPSCContext();
  const system = `${buildUPSCSystemPrompt(context, mode)}

Tooling rules for syllabus operations:
- If the user asks to add, edit, delete, or mark complete/incomplete any subject, chapter, or topic, use the syllabus management tool instead of only describing the steps.
- Treat "status" as completion progress.
- For subject and chapter completion changes, update the full subtree unless the user explicitly asks for only one item.
- If a target reference is ambiguous, ask a short clarifying question in the final answer.`;

  const conversation =
    (body.conversationId
      ? await db.aiConversation.findUnique({
          where: { id: body.conversationId },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        })
      : null) ??
    (await db.aiConversation.create({
      data: {
        title: userMessage.slice(0, 72) || file?.name || "UPSC Guru",
        persona: "guru",
      },
      include: { messages: true },
    }));

  const history = conversation.messages
    .slice(-12)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  const savedUserMessage = await db.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: userMessage || `Uploaded file: ${file?.name ?? "attachment"}`,
      attachmentText: attachmentText || null,
    },
  });

  const modelId = normalizeGoogleModelId(resolveModel(mode));
  const result = streamText({
    model: google(modelId),
    system,
    prompt: `Live UPSC context JSON:
${JSON.stringify(context, null, 2)}

Conversation history:
${history || "No prior messages."}

PDF context:
${attachmentText || "No PDF attached."}

Student message:
    ${userMessage || `Please analyze the attached file: ${file?.name ?? "attachment"}`}`,
    temperature: resolveTemperature(mode),
    maxOutputTokens: 4096,
    tools: {
      manage_syllabus: tool({
        description:
          "Add, edit, delete, or change completion progress for a subject, chapter, or topic in the UPSC study tree.",
        inputSchema: z.object({
          action: z.enum(["create", "update", "delete", "set_progress"]),
          targetType: z.enum(["subject", "chapter", "topic"]),
          paperTitle: z.string().optional(),
          subjectTitle: z.string().optional(),
          chapterTitle: z.string().optional(),
          topicTitle: z.string().optional(),
          title: z.string().optional(),
          newTitle: z.string().optional(),
          overview: z.string().optional(),
          details: z.string().optional(),
          completed: z.boolean().optional(),
        }),
        execute: async (input) => {
          if (input.action === "create") {
            const parentNode = await resolveNodeForCreate({
              paperTitle: input.paperTitle,
              subjectTitle: input.subjectTitle,
              chapterTitle: input.chapterTitle,
            });

            const title = String(
              input.title ??
                (input.targetType === "subject"
                  ? input.subjectTitle
                  : input.targetType === "chapter"
                    ? input.chapterTitle
                    : input.topicTitle) ??
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

            return {
              ok: true,
              action: input.action,
              targetType: input.targetType,
              node: {
                id: created.id,
                title: created.title,
                slug: created.slug,
                type: created.type,
              },
              parent: {
                id: parentNode.id,
                title: parentNode.title,
                type: parentNode.type,
              },
            };
          }

          const resolved = await resolveStudyNode({
            paperTitle: input.paperTitle,
            subjectTitle: input.targetType === "subject" ? input.subjectTitle ?? input.title : input.subjectTitle,
            chapterTitle: input.targetType === "chapter" ? input.chapterTitle ?? input.title : input.chapterTitle,
            topicTitle: input.targetType === "topic" ? input.topicTitle ?? input.title : input.topicTitle,
            nodeTitle:
              input.targetType === "subject"
                ? input.subjectTitle ?? input.title
                : input.targetType === "chapter"
                  ? input.chapterTitle ?? input.title
                  : input.topicTitle ?? input.title,
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
            cascade: input.targetType !== "topic",
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
        },
      }),
    },
    onFinish: async (event) => {
      await db.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: event.text,
          attachmentText: modelId,
        },
      });

      await refreshGuruMemoryProfile();

      await db.aiConversation.update({
        where: { id: conversation.id },
        data: {
          title:
            conversation.title === "UPSC Guru" || conversation.title === "New chat"
              ? (userMessage || file?.name || "UPSC Guru").slice(0, 72)
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
