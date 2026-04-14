import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/topic-progress?parentId=xxx
// Returns checked + revisionCount map for all descendants of a parent node
export async function GET(req: NextRequest) {
  try {
    const parentId = req.nextUrl.searchParams.get("parentId");

    if (!parentId) {
      return NextResponse.json({ error: "parentId required" }, { status: 400 });
    }

    const parent = await db.studyNode.findUnique({
      where: { id: parentId },
      include: {
        children: {
          include: { children: true },
        },
      },
    });

    if (!parent) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const allIds: string[] = [];
    for (const child of parent.children) {
      allIds.push(child.id);
      for (const g of child.children) allIds.push(g.id);
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
  try {
    const body = (await req.json()) as {
      studyNodeId: string;
      checked?: boolean;
      revisionDelta?: number;
    };

    const { studyNodeId, checked, revisionDelta } = body;

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

    // Invalidate the entire path to update dashboard and subjects real-time
    revalidatePath("/", "layout");

    return NextResponse.json({ success: true, record });
  } catch (e) {
    console.error("[topic-progress POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
