import { NextResponse } from "next/server";

import { listGuruConversations } from "@/lib/ai-context-builder";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const conversations = await listGuruConversations();
  return NextResponse.json(conversations);
}

export async function DELETE() {
  await db.aiConversation.deleteMany({
    where: { persona: "guru" },
  });

  return NextResponse.json({ ok: true });
}
