import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { approveDayPlan, dismissDayPlan, generateDayPlan, getTodayPlan } from "@/lib/day-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    planId: z.string(),
    taskIndexes: z.array(z.number().int().min(0)).optional(),
  }),
  z.object({ action: z.literal("dismiss"), planId: z.string() }),
  z.object({ action: z.literal("regenerate") }),
]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await getTodayPlan();
  return NextResponse.json({ plan });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    if (parsed.data.action === "approve") {
      const result = await approveDayPlan(parsed.data.planId, parsed.data.taskIndexes);
      return NextResponse.json(result);
    }
    if (parsed.data.action === "dismiss") {
      const result = await dismissDayPlan(parsed.data.planId);
      return NextResponse.json(result);
    }
    const { plan } = await generateDayPlan(true);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error("[day-plan] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
