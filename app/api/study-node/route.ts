import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { revalidatePath } from "next/cache";

async function uniqueSlug(base: string): Promise<string> {
  const normalized = slugify(base);
  let candidate = normalized;
  let counter = 2;
  while (await db.studyNode.findUnique({ where: { slug: candidate } })) {
    candidate = `${normalized}-${counter}`;
    counter += 1;
  }
  return candidate;
}

// POST — create a new child node
export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const parentId = String(fd.get("parentId") ?? "").trim();
    const title = String(fd.get("title") ?? "").trim();
    const overview = String(fd.get("overview") ?? "").trim();
    const pathname = String(fd.get("pathname") ?? "");

    if (!parentId || !title) {
      return NextResponse.json({ error: "parentId and title required" }, { status: 400 });
    }

    const node = await db.studyNode.create({
      data: {
        parentId,
        title,
        slug: await uniqueSlug(title),
        type: "MODULE",
        overview: overview || null,
        sortOrder: (await db.studyNode.count({ where: { parentId } })) + 1,
      },
    });

    if (pathname) revalidatePath(pathname);

    return NextResponse.json({ id: node.id, title: node.title, slug: node.slug });
  } catch (err) {
    console.error("[study-node POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH — rename (update title/overview)
export async function PATCH(req: NextRequest) {
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

    await db.studyNode.update({
      where: { id },
      data: { title, overview: overview || null, details: details || null },
    });

    if (pathname) revalidatePath(pathname);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[study-node PATCH]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE — remove a node
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") ?? "";
    const pathname = searchParams.get("pathname") ?? "";

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db.studyNode.delete({ where: { id } });

    if (pathname) revalidatePath(pathname);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[study-node DELETE]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
