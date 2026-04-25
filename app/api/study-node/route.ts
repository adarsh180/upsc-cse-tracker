import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createStudyNode, deleteStudyNode, reorderStudyNodes, updateStudyNode } from "@/lib/study-tree";

function revalidateStudySurfaces(pathname?: string) {
  if (pathname) revalidatePath(pathname);
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/", "layout");
}

async function requireApiSession() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// POST — create a new child node
export async function POST(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const fd = await req.formData();
    const parentId = String(fd.get("parentId") ?? "").trim();
    const title = String(fd.get("title") ?? "").trim();
    const overview = String(fd.get("overview") ?? "").trim();
    const pathname = String(fd.get("pathname") ?? "");

    if (!parentId || !title) {
      return NextResponse.json({ error: "parentId and title required" }, { status: 400 });
    }

    const result = await createStudyNode({
      parentId,
      title,
      overview,
    });

    revalidateStudySurfaces(pathname);

    return NextResponse.json({
      id: result.node.id,
      title: result.node.title,
      slug: result.node.slug,
      parentId: result.node.parentId,
      created: result.created,
    });
  } catch (err) {
    console.error("[study-node POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PUT - reorder children under a parent node
export async function PUT(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const parentId = String(body.parentId ?? "").trim();
    const pathname = String(body.pathname ?? "").trim();
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map((id: unknown) => String(id)) : [];

    if (!parentId || orderedIds.length === 0) {
      return NextResponse.json({ error: "parentId and orderedIds required" }, { status: 400 });
    }

    const result = await reorderStudyNodes({
      parentId,
      orderedIds,
    });

    revalidateStudySurfaces(pathname);

    return NextResponse.json({ ok: true, orderedIds: result.orderedIds });
  } catch (err) {
    console.error("[study-node PUT]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH — rename (update title/overview)
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const fd = await req.formData();
    const id = String(fd.get("id") ?? "").trim();
    const title = String(fd.get("title") ?? "").trim();
    const overview = String(fd.get("overview") ?? "").trim();
    const details = String(fd.get("details") ?? "").trim();
    const pathname = String(fd.get("pathname") ?? "");

    if (!id || !title) {
      return NextResponse.json({ error: "id and title required" }, { status: 400 });
    }

    await updateStudyNode({
      id,
      title,
      overview,
      details,
    });

    revalidateStudySurfaces(pathname);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[study-node PATCH]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE — remove a node
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") ?? "";
    const pathname = searchParams.get("pathname") ?? "";

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await deleteStudyNode(id);

    revalidateStudySurfaces(pathname);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[study-node DELETE]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
