import { syllabusTree, type SyllabusNode } from "@/data/syllabus";
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";

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

export async function ensureSeeded() {
  const globalAny = global as any;
  if (globalAny.__seedPromise__) return globalAny.__seedPromise__;

  globalAny.__seedPromise__ = withDbRetry(async () => {
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
  });

  try {
    return await globalAny.__seedPromise__;
  } catch (error) {
    globalAny.__seedPromise__ = null;
    throw error;
  }
}

/** Find the top-level static syllabus branch that contains a slug (at any depth). */
function findBranchContainingSlug(slug: string): SyllabusNode | null {
  const containsSlug = (node: SyllabusNode): boolean =>
    node.slug === slug || (node.children ?? []).some((child) => containsSlug(child));

  return syllabusTree.find((paper) => containsSlug(paper)) ?? null;
}

/**
 * Self-healing seeder: if a known syllabus slug is missing from the DB
 * (e.g. partial seeding because roots already existed), upsert just that
 * paper branch so the page resolves instead of 404ing.
 */
export async function seedBranchForSlug(slug: string): Promise<boolean> {
  const branch = findBranchContainingSlug(slug);
  if (!branch) return false;

  const sortOrder = syllabusTree.indexOf(branch);

  await withDbRetry(async () => {
    await upsertNode(branch, null, sortOrder);
  });

  return true;
}

export function percent(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}
