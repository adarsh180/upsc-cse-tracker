import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendWebPushNotification } from "@/lib/web-push";

export const dynamic = "force-dynamic";

const TONES = new Set(["focus", "urgent", "care", "win"]);

function clean(value: unknown, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await db.appNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return NextResponse.json({ notifications });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const title = clean(payload.title).slice(0, 90);
  const body = clean(payload.body).slice(0, 420);
  const senderLabel = clean(payload.senderLabel, session.email.split("@")[0] || "UPSC desk").slice(0, 42);
  const senderClientId = clean(payload.senderClientId).slice(0, 80) || null;
  const tone = TONES.has(clean(payload.tone)) ? clean(payload.tone) : "focus";

  if (!title || !body) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
  }

  const notification = await db.appNotification.create({
    data: {
      title,
      body,
      tone,
      senderLabel,
      senderClientId,
    },
  });

  const push = await sendWebPushNotification(notification, senderClientId);

  return NextResponse.json({ notification, push }, { status: 201 });
}
