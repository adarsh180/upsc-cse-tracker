import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { createManualTodoTask, getTodoBoardSnapshot } from "@/lib/mission-control";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getTodoBoardSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    detail?: string;
    taskType?: string;
    priority?: string;
    energyBand?: string;
    estimatedMinutes?: number | null;
    dueLabel?: string;
    linkedStudyNodeId?: string | null;
  };

  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const task = await createManualTodoTask({
    title,
    detail: String(body.detail ?? "").trim(),
    taskType: String(body.taskType ?? "PLANNING"),
    priority: String(body.priority ?? "MEDIUM"),
    energyBand: String(body.energyBand ?? "MEDIUM"),
    estimatedMinutes:
      typeof body.estimatedMinutes === "number" && Number.isFinite(body.estimatedMinutes)
        ? body.estimatedMinutes
        : null,
    dueLabel: String(body.dueLabel ?? "This week"),
    linkedStudyNodeId: body.linkedStudyNodeId ? String(body.linkedStudyNodeId) : null,
  });

  return NextResponse.json(task);
}
