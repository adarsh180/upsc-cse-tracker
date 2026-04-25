import { NextResponse } from "next/server";

import { listGuruConversations } from "@/lib/ai-context-builder";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listGuruConversations();
  return NextResponse.json(conversations);
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.aiConversation.deleteMany({
    where: { persona: "guru" },
  });

  return NextResponse.json({ ok: true });
}
