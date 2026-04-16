import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const conversation = await db.aiConversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          attachments: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      attachments: message.attachments.map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind.toLowerCase(),
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      })),
      createdAt: message.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await db.aiConversation.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { title?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const updated = await db.aiConversation.update({
    where: { id },
    data: { title: title.slice(0, 72) },
  });

  return NextResponse.json({
    ok: true,
    id: updated.id,
    title: updated.title,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
