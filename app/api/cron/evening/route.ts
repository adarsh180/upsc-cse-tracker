import { NextRequest, NextResponse } from "next/server";

import { runEveningGuard } from "@/lib/proactive";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runEveningGuard();
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
  } catch (error) {
    console.error("[cron/evening] failed:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
