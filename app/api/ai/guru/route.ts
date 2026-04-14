import pdfParse from "pdf-parse";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import {
  buildUPSCContext,
  buildUPSCSystemPrompt,
  refreshGuruMemoryProfile,
} from "@/lib/ai-context-builder";
import { normalizeGoogleModelId } from "@/lib/ai-models";
import { db } from "@/lib/db";

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
  const system = buildUPSCSystemPrompt(context, mode);

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
