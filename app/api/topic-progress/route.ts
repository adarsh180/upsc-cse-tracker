import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireApiSession() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// GET /api/topic-progress?parentId=xxx
// Returns checked + revisionCount map for all descendants of a parent node
export async function GET(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const parentId = req.nextUrl.searchParams.get("parentId");

    if (!parentId) {
      return NextResponse.json({ error: "parentId required" }, { status: 400 });
    }

    const root = await db.studyNode.findUnique({
      where: { id: parentId },
      select: { id: true },
    });

    if (!root) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const nodes = await db.studyNode.findMany({
      select: {
        id: true,
        parentId: true,
      },
    });

    const childrenByParent = new Map<string, string[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      const children = childrenByParent.get(node.parentId) ?? [];
      children.push(node.id);
      childrenByParent.set(node.parentId, children);
    }

    const allIds: string[] = [];
    const queue = [...(childrenByParent.get(parentId) ?? [])];
    while (queue.length) {
      const id = queue.shift()!;
      allIds.push(id);
      queue.push(...(childrenByParent.get(id) ?? []));
    }

    const records = await db.topicProgress.findMany({
      where: { studyNodeId: { in: allIds } },
    });

    const progressMap: Record<string, boolean> = {};
    const revisionMap: Record<string, number> = {};
    for (const r of records) {
      progressMap[r.studyNodeId] = r.checked;
      revisionMap[r.studyNodeId] = r.revisionCount;
    }

    return NextResponse.json({ progress: progressMap, revisions: revisionMap });
  } catch (e) {
    console.error("[topic-progress GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/topic-progress
// Body: { studyNodeId: string, checked?: boolean, revisionDelta?: number }
// revisionDelta: +1 to increment, -1 to decrement (clamped 0-20)
export async function POST(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as {
      studyNodeId: string;
      checked?: boolean;
      revisionDelta?: number;
      pathname?: string;
    };

    const { studyNodeId, checked, revisionDelta, pathname } = body;

    if (!studyNodeId) {
      return NextResponse.json({ error: "studyNodeId required" }, { status: 400 });
    }

    // Get existing record to compute new revision count
    const existing = await db.topicProgress.findUnique({ where: { studyNodeId } });
    const currentRevisions = existing?.revisionCount ?? 0;

    let newRevisionCount = currentRevisions;
    if (revisionDelta !== undefined) {
      newRevisionCount = Math.max(0, Math.min(20, currentRevisions + revisionDelta));
    }

    const updateData: Record<string, unknown> = {
      revisionCount: newRevisionCount,
    };

    if (checked !== undefined) {
      updateData.checked = checked;
      updateData.checkedAt = checked ? new Date() : null;
    }

    if (revisionDelta !== undefined && revisionDelta > 0) {
      updateData.lastRevisedAt = new Date();
    }

    const record = await db.topicProgress.upsert({
      where: { studyNodeId },
      update: updateData,
      create: {
        studyNodeId,
        checked: (checked as boolean | undefined) ?? false,
        checkedAt: checked ? new Date() : null,
        revisionCount: newRevisionCount,
        lastRevisedAt: revisionDelta && revisionDelta > 0 ? new Date() : null,
      },
    });

    if (pathname) {
      revalidatePath(pathname);
    }
    revalidatePath("/dashboard");
    revalidatePath("/");
    revalidatePath("/", "layout");

    return NextResponse.json({ success: true, record });
  } catch (e) {
    console.error("[topic-progress POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
