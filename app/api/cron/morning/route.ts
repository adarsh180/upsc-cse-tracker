import { NextRequest, NextResponse } from "next/server";

import { runMorningBriefing } from "@/lib/proactive";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runKitchenAlerts } from "@/lib/hub/alerts";

export const dynamic = "force-dynamic";
// Worst case (Sunday + 1st of month): digest + day plan + two report cards,
// each AI call individually time-boxed. 300s is the Hobby/Fluid ceiling.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runMorningBriefing();
    // Saath kitchen reminders ride on the same job; fenced so they can never break it.
    const kitchen = await runKitchenAlerts("morning").catch((error) => ({ error: String(error) }));
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results, kitchen });
  } catch (error) {
    console.error("[cron/morning] failed:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
