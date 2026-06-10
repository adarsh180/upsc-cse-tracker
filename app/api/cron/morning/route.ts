import { NextRequest, NextResponse } from "next/server";

import { runMorningBriefing } from "@/lib/proactive";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runMorningBriefing();
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[cron/morning] failed:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
