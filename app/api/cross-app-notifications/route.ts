import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { pruneExpiredNotifications } from "@/lib/notification-retention";
import { sendDiscordNotification } from "@/lib/discord";
import { sendWebPushNotification } from "@/lib/web-push";

export const dynamic = "force-dynamic";

const TONES = new Set(["focus", "urgent", "care", "win"]);

function clean(value: unknown, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function authorized(request: NextRequest) {
  const secret = process.env.CROSS_APP_NOTIFY_SECRET?.trim();
  const header = request.headers.get("x-cross-app-secret")?.trim();
  if (!secret || !header) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Messages from the NEET desk. `{ ping: true }` only checks the link and stores nothing. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    console.error("[cross-app-notifications] rejected: secret", process.env.CROSS_APP_NOTIFY_SECRET ? "configured" : "missing", "· header", request.headers.get("x-cross-app-secret") ? "present" : "missing");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  if (payload?.ping === true) return NextResponse.json({ ok: true, pong: "upsc" });

  await pruneExpiredNotifications();

  const title = clean(payload.title).slice(0, 90);
  const body = clean(payload.body).slice(0, 420);
  const senderLabel = clean(payload.senderLabel, "Partner").slice(0, 42);
  const senderClientId = clean(payload.senderClientId).slice(0, 80) || null;
  const tone = TONES.has(clean(payload.tone)) ? clean(payload.tone) : "focus";

  if (!title || !body) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
  }

  const notification = await db.appNotification.create({ data: { title, body, tone, senderLabel, senderClientId } });
  const push = await sendWebPushNotification(notification, senderClientId);

  // Await the Discord dispatch so Vercel doesn't freeze the execution thread before it completes
  await sendDiscordNotification({ title, body, senderLabel, tone }, request.nextUrl.origin).catch((err) => {
    console.error("[cross-app-notifications] Discord background dispatch error:", err);
  });

  return NextResponse.json({ notification, push }, { status: 201 });
}
