import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { deleteAgentTask, updateAgentTaskStatus } from "@/lib/mission-control";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as { status?: string };
  const status = String(body.status ?? "").trim();

  if (!["TODO", "IN_PROGRESS", "DONE", "SKIPPED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const task = await updateAgentTaskStatus(
    id,
    status as "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED",
  );

  return NextResponse.json(task);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteAgentTask(id);
  return NextResponse.json(result);
}
