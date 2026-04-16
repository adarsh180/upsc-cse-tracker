import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

type StudyNodeRecord = {
  id: string;
  title: string;
  slug: string;
  type: string;
  overview: string | null;
  details: string | null;
  parentId: string | null;
  sortOrder: number;
  parent: {
    id: string;
    title: string;
    slug: string;
    type: string;
    parentId: string | null;
    parent: {
      id: string;
      title: string;
      slug: string;
      type: string;
      parentId: string | null;
    } | null;
  } | null;
};

type StudyNodeReference = {
  paperTitle?: string;
  subjectTitle?: string;
  chapterTitle?: string;
  topicTitle?: string;
  nodeTitle?: string;
  nodeSlug?: string;
};

function getChapterNode(node: StudyNodeRecord) {
  if (node.type !== "MODULE") return null;
  if (node.parent?.type === "SUBJECT") return node;
  if (node.parent?.type === "MODULE") return node.parent as StudyNodeRecord;
  return null;
}

function getSubjectNode(node: StudyNodeRecord) {
  if (node.type === "SUBJECT") return node;
  if (node.parent?.type === "SUBJECT") return node.parent as StudyNodeRecord;
  if (node.parent?.parent?.type === "SUBJECT") return node.parent.parent as StudyNodeRecord;
  return null;
}

function getPaperNode(node: StudyNodeRecord) {
  if (node.type === "PAPER") return node;
  const subjectNode = getSubjectNode(node);
  if (subjectNode?.parent?.type === "PAPER") return subjectNode.parent as StudyNodeRecord;
  if (node.parent?.type === "PAPER") return node.parent as StudyNodeRecord;
  return null;
}

function normalizeTitleInput(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string | null | undefined) {
  return slugify(normalizeTitleInput(value));
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function isFuzzyMatch(left: string, right: string) {
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;

  const distance = levenshteinDistance(left, right);
  const threshold = Math.max(1, Math.floor(Math.max(left.length, right.length) * 0.2));
  return distance <= threshold;
}

async function uniqueStudySlug(base: string) {
  const normalized = slugify(base);
  let candidate = normalized;
  let counter = 2;

  while (await db.studyNode.findUnique({ where: { slug: candidate } })) {
    candidate = `${normalized}-${counter}`;
    counter += 1;
  }

  return candidate;
}

async function findSimilarSibling(input: { parentId: string; title: string }) {
  const normalizedTitle = normalizeKey(input.title);
  const siblings = await db.studyNode.findMany({
    where: { parentId: input.parentId },
    orderBy: { sortOrder: "asc" },
  });

  return (
    siblings.find((node) => {
      const candidateTitle = normalizeKey(node.title);
      const candidateSlug = normalizeKey(node.slug);
      return (
        candidateTitle === normalizedTitle ||
        candidateSlug === normalizedTitle ||
        isFuzzyMatch(candidateTitle, normalizedTitle) ||
        isFuzzyMatch(candidateSlug, normalizedTitle)
      );
    }) ?? null
  );
}

async function getNodeForMutation(id: string) {
  return db.studyNode.findUnique({
    where: { id },
    include: {
      parent: {
        include: {
          parent: true,
        },
      },
    },
  });
}

function matchesNode(node: StudyNodeRecord, titleOrSlug: string) {
  const normalized = normalizeKey(titleOrSlug);
  const title = normalizeKey(node.title);
  const slug = normalizeKey(node.slug);
  return title === normalized || slug === normalized || isFuzzyMatch(title, normalized) || isFuzzyMatch(slug, normalized);
}

function scoreNodeMatch(node: StudyNodeRecord, reference: StudyNodeReference) {
  let score = 0;

  const scoreField = (target: StudyNodeRecord | null, value: string | undefined, exactPoints: number, fuzzyPoints: number) => {
    if (!target || !value) return Number.NEGATIVE_INFINITY;
    const normalized = normalizeKey(value);
    const title = normalizeKey(target.title);
    const slug = normalizeKey(target.slug);
    if (title === normalized || slug === normalized) return exactPoints;
    if (isFuzzyMatch(title, normalized) || isFuzzyMatch(slug, normalized)) return fuzzyPoints;
    return Number.NEGATIVE_INFINITY;
  };

  if (reference.nodeSlug) {
    const slugScore = scoreField(node, reference.nodeSlug, 120, 50);
    if (slugScore === Number.NEGATIVE_INFINITY) return Number.NEGATIVE_INFINITY;
    score += slugScore;
  }

  if (reference.nodeTitle) {
    const nodeScore = scoreField(node, reference.nodeTitle, 80, 35);
    if (nodeScore === Number.NEGATIVE_INFINITY) return Number.NEGATIVE_INFINITY;
    score += nodeScore;
  }

  if (reference.topicTitle) {
    const topicScore = scoreField(node, reference.topicTitle, 75, 30);
    if (topicScore === Number.NEGATIVE_INFINITY) return Number.NEGATIVE_INFINITY;
    score += topicScore;
  }

  if (reference.chapterTitle) {
    const chapterScore = scoreField(getChapterNode(node), reference.chapterTitle, 60, 24);
    if (chapterScore === Number.NEGATIVE_INFINITY) return Number.NEGATIVE_INFINITY;
    score += chapterScore;
  }

  if (reference.subjectTitle) {
    const subjectScore = scoreField(getSubjectNode(node), reference.subjectTitle, 45, 18);
    if (subjectScore === Number.NEGATIVE_INFINITY) return Number.NEGATIVE_INFINITY;
    score += subjectScore;
  }

  if (reference.paperTitle) {
    const paperScore = scoreField(getPaperNode(node), reference.paperTitle, 30, 12);
    if (paperScore === Number.NEGATIVE_INFINITY) return Number.NEGATIVE_INFINITY;
    score += paperScore;
  }

  return score;
}

function matchesChain(node: StudyNodeRecord, reference: StudyNodeReference) {
  if (reference.nodeSlug && normalizeKey(node.slug) !== normalizeKey(reference.nodeSlug)) {
    return false;
  }

  if (reference.nodeTitle && !matchesNode(node, reference.nodeTitle)) {
    return false;
  }

  if (reference.topicTitle && !matchesNode(node, reference.topicTitle)) {
    return false;
  }

  if (reference.chapterTitle) {
    const chapterNode = getChapterNode(node);
    if (!chapterNode || !matchesNode(chapterNode, reference.chapterTitle)) {
      return false;
    }
  }

  if (reference.subjectTitle) {
    const subjectNode = getSubjectNode(node);
    if (!subjectNode || !matchesNode(subjectNode as StudyNodeRecord, reference.subjectTitle)) {
      return false;
    }
  }

  if (reference.paperTitle) {
    const paperNode = getPaperNode(node);
    if (!paperNode || !matchesNode(paperNode as StudyNodeRecord, reference.paperTitle)) {
      return false;
    }
  }

  return true;
}

export async function resolveStudyNode(reference: StudyNodeReference) {
  if (reference.nodeSlug) {
    const bySlug = await db.studyNode.findUnique({
      where: { slug: reference.nodeSlug },
      select: { id: true },
    });
    const direct = bySlug ? await getNodeForMutation(bySlug.id) : null;

    if (direct && matchesChain(direct as StudyNodeRecord, reference)) {
      return direct;
    }
  }

  const candidates = await db.studyNode.findMany({
    include: {
      parent: {
        include: {
          parent: true,
        },
      },
    },
  });

  const matched = candidates.filter((node) => matchesChain(node as StudyNodeRecord, reference));

  if (matched.length === 1) {
    return matched[0];
  }

  if (matched.length > 1) {
    const ranked = matched
      .map((node) => ({
        node,
        score: scoreNodeMatch(node as StudyNodeRecord, reference),
      }))
      .sort((left, right) => right.score - left.score);

    if (ranked[0] && ranked[0].score > Number.NEGATIVE_INFINITY) {
      const best = ranked[0];
      const second = ranked[1];

      if (!second || best.score > second.score) {
        return best.node;
      }
    }

    throw new Error("Multiple study nodes matched. Please specify the paper, subject, or chapter more clearly.");
  }

  throw new Error("Study node not found.");
}

export async function createStudyNode(input: {
  parentId: string;
  title: string;
  overview?: string | null;
}) {
  const cleanTitle = normalizeTitleInput(input.title);
  const parent = await db.studyNode.findUnique({
    where: { id: input.parentId },
    select: { id: true, type: true },
  });

  if (!parent) {
    throw new Error("Parent study node not found.");
  }

  const existing = await findSimilarSibling({
    parentId: input.parentId,
    title: cleanTitle,
  });

  if (existing) {
    return { node: existing, created: false as const };
  }

  const nextType = parent.type === "PAPER" ? "SUBJECT" : "MODULE";

  const node = await db.studyNode.create({
    data: {
      parentId: input.parentId,
      title: cleanTitle,
      slug: await uniqueStudySlug(cleanTitle),
      type: nextType,
      overview: input.overview?.trim() || null,
      sortOrder: (await db.studyNode.count({ where: { parentId: input.parentId } })) + 1,
    },
  });

  return { node, created: true as const };
}

export async function updateStudyNode(input: {
  id: string;
  title?: string;
  overview?: string | null;
  details?: string | null;
}) {
  const existing = await db.studyNode.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      title: true,
      overview: true,
      details: true,
    },
  });

  if (!existing) {
    throw new Error("Study node not found.");
  }

  const title = input.title?.trim() || existing.title;

  return db.studyNode.update({
    where: { id: input.id },
    data: {
      title,
      overview: input.overview !== undefined ? input.overview?.trim() || null : existing.overview,
      details: input.details !== undefined ? input.details?.trim() || null : existing.details,
    },
  });
}

export async function deleteStudyNode(id: string) {
  await db.studyNode.delete({
    where: { id },
  });
}

export async function reorderStudyNodes(input: {
  parentId: string;
  orderedIds: string[];
}) {
  const siblings = await db.studyNode.findMany({
    where: { parentId: input.parentId },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });

  if (!siblings.length) {
    throw new Error("No study nodes found for this parent.");
  }

  const siblingIds = siblings.map((node) => node.id);
  const uniqueOrderedIds = Array.from(new Set(input.orderedIds)).filter((id) => siblingIds.includes(id));
  const remainingIds = siblingIds.filter((id) => !uniqueOrderedIds.includes(id));
  const finalIds = [...uniqueOrderedIds, ...remainingIds];

  await db.$transaction(
    finalIds.map((id, index) =>
      db.studyNode.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  return { orderedIds: finalIds };
}

export async function setStudyNodeCompletion(input: {
  nodeId: string;
  completed: boolean;
  cascade?: boolean;
}) {
  const allNodes = await db.studyNode.findMany({
    select: {
      id: true,
      parentId: true,
    },
  });

  const descendantsByParent = allNodes.reduce<Record<string, string[]>>((acc, node) => {
    if (!node.parentId) return acc;
    acc[node.parentId] = acc[node.parentId] ? [...acc[node.parentId], node.id] : [node.id];
    return acc;
  }, {});

  const ids = [input.nodeId];
  if (input.cascade !== false) {
    const queue = [input.nodeId];
    while (queue.length) {
      const current = queue.shift()!;
      const children = descendantsByParent[current] ?? [];
      for (const childId of children) {
        ids.push(childId);
        queue.push(childId);
      }
    }
  }

  const timestamp = input.completed ? new Date() : null;

  await db.$transaction(
    ids.map((studyNodeId) =>
      db.topicProgress.upsert({
        where: { studyNodeId },
        update: {
          checked: input.completed,
          checkedAt: timestamp,
        },
        create: {
          studyNodeId,
          checked: input.completed,
          checkedAt: timestamp,
        },
      }),
    ),
  );

  return { affectedNodes: ids.length };
}

export async function resolveNodeForCreate(input: {
  paperTitle?: string;
  subjectTitle?: string;
  chapterTitle?: string;
}) {
  if (input.chapterTitle) {
    return resolveStudyNode({
      paperTitle: input.paperTitle,
      subjectTitle: input.subjectTitle,
      chapterTitle: input.chapterTitle,
    });
  }

  if (input.subjectTitle) {
    return resolveStudyNode({
      paperTitle: input.paperTitle,
      subjectTitle: input.subjectTitle,
    });
  }

  if (input.paperTitle) {
    return resolveStudyNode({
      paperTitle: input.paperTitle,
      nodeTitle: input.paperTitle,
    });
  }

  throw new Error("A parent paper, subject, or chapter is required.");
}
