import { syllabusTree, type SyllabusNode } from "@/data/syllabus";
import { db } from "@/lib/db";

async function upsertNode(
  node: SyllabusNode,
  parentId: string | null,
  sortOrder: number,
): Promise<string> {
  const record = await db.studyNode.upsert({
    where: { slug: node.slug },
    update: {
      title: node.title,
      type: node.type.toUpperCase(),
      overview: node.overview,
      details: node.details,
      accent: node.accent,
      parentId,
      sortOrder,
    },
    create: {
      title: node.title,
      slug: node.slug,
      type: node.type.toUpperCase(),
      overview: node.overview,
      details: node.details,
      accent: node.accent,
      parentId,
      sortOrder,
    },
  });

  for (const [index, child] of (node.children ?? []).entries()) {
    await upsertNode(child, record.id, index);
  }

  return record.id;
}

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded() {
  const globalAny = global as any;
  if (globalAny.__seedPromise__) return globalAny.__seedPromise__;

  globalAny.__seedPromise__ = (async () => {
    await db.userProfile.upsert({
      where: { email: process.env.AUTH_EMAIL ?? "tiwariadarsh0704@gmail.com" },
      update: {},
      create: {
        email: process.env.AUTH_EMAIL ?? "tiwariadarsh0704@gmail.com",
        displayName: "Adarsh Tiwari",
      },
    });

    const rootCount = await db.studyNode.count({ where: { parentId: null } });
    if (rootCount > 0) {
      return;
    }

    for (const [index, node] of syllabusTree.entries()) {
      await upsertNode(node, null, index);
    }
  })();

  return globalAny.__seedPromise__;
}

export function percent(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}
