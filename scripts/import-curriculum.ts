import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildDesiredCurriculum, type DesiredCurriculumNode } from "@/lib/curriculum-manifest";
import { db } from "@/lib/db";

type NodeRecord = {
  id: string;
  title: string;
  slug: string;
  type: string;
  nodeKind: string | null;
  curriculumKey: string | null;
  curriculumVersion: string | null;
  curriculumTitle: string | null;
  userEditedAt: Date | null;
  overview: string | null;
  parentId: string | null;
  sortOrder: number;
};

type PlannedOperation = {
  action: "create" | "update" | "unchanged";
  key: string;
  title: string;
  matchedBy?: string;
  existingId?: string;
  fromParentId?: string | null;
  toParentId?: string | null;
  renamed?: boolean;
  preservedUserTitle?: boolean;
};

type Conflict = {
  key: string;
  title: string;
  reason: string;
  candidates?: Array<{ id: string; title: string; slug: string; curriculumKey: string | null }>;
};

const args = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, ...rest] = entry.split("=");
    return [key, rest.join("=") || "true"];
  }),
);
const apply = args.has("--apply");
const backupPath = args.get("--backup");

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[’‘]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function desiredValues(
  desired: DesiredCurriculumNode,
  parentId: string | null,
  version: string,
  existing?: NodeRecord,
) {
  const preserveUserTitle = Boolean(existing?.userEditedAt);
  return {
    title: preserveUserTitle ? existing!.title : desired.title,
    type: desired.type,
    nodeKind: desired.nodeKind,
    curriculumKey: desired.key,
    curriculumVersion: version,
    curriculumTitle: desired.curriculumTitle,
    parentId,
    sortOrder: desired.sortOrder,
    overview: existing?.overview ?? desired.overview ?? null,
  };
}

function changed(existing: NodeRecord, values: ReturnType<typeof desiredValues>) {
  return (
    existing.title !== values.title ||
    existing.type !== values.type ||
    existing.nodeKind !== values.nodeKind ||
    existing.curriculumKey !== values.curriculumKey ||
    existing.curriculumVersion !== values.curriculumVersion ||
    existing.curriculumTitle !== values.curriculumTitle ||
    existing.parentId !== values.parentId ||
    existing.sortOrder !== values.sortOrder ||
    existing.overview !== values.overview
  );
}

function candidatesFor(
  desired: DesiredCurriculumNode,
  parentId: string | null,
  nodes: NodeRecord[],
  assignedIds: Set<string>,
) {
  const available = nodes.filter((node) => !assignedIds.has(node.id));
  const byKey = available.filter((node) => node.curriculumKey === desired.key);
  if (byKey.length) return { candidates: byKey, matchedBy: "curriculumKey" };

  const preferredSlugs = unique([desired.slug, ...(desired.preferredSlugs ?? [])]);
  const bySlug = available.filter((node) => preferredSlugs.includes(node.slug));
  if (bySlug.length) return { candidates: bySlug, matchedBy: "stableSlug" };

  const titles = unique([desired.title, desired.curriculumTitle, ...(desired.aliases ?? [])]).map(normalize);
  const bySiblingTitle = available.filter(
    (node) => node.parentId === parentId && titles.includes(normalize(node.title)),
  );
  return { candidates: bySiblingTitle, matchedBy: "exactSiblingTitle" };
}

function virtualRecord(desired: DesiredCurriculumNode, parentId: string | null, version: string): NodeRecord {
  return {
    id: `virtual:${desired.key}`,
    title: desired.title,
    slug: desired.slug,
    type: desired.type,
    nodeKind: desired.nodeKind,
    curriculumKey: desired.key,
    curriculumVersion: version,
    curriculumTitle: desired.curriculumTitle,
    userEditedAt: null,
    overview: desired.overview ?? null,
    parentId,
    sortOrder: desired.sortOrder,
  };
}

async function verifyBackup(filePath: string) {
  const resolved = path.resolve(filePath);
  const [contents, checksumFile] = await Promise.all([
    readFile(resolved),
    readFile(`${resolved}.sha256`, "utf8"),
  ]);
  const expected = checksumFile.trim().split(/\s+/)[0]?.toLowerCase();
  const actual = createHash("sha256").update(contents).digest("hex");
  if (!expected || expected !== actual) throw new Error("Backup checksum verification failed.");
  const parsed = JSON.parse(contents.toString("utf8")) as { format?: string };
  if (parsed.format !== "upsc-study-data-backup/v1") throw new Error("Unsupported backup format.");
  return { resolved, checksum: actual };
}

async function protectedCounts() {
  const [topicProgress, studyLogs, testRecords, agentTasks, pyqQuestions] = await Promise.all([
    db.topicProgress.count(),
    db.studyLog.count(),
    db.testRecord.count(),
    db.agentTask.count(),
    db.pyqQuestion.count(),
  ]);
  return { topicProgress, studyLogs, testRecords, agentTasks, pyqQuestions };
}

async function loadNodes() {
  return db.studyNode.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      nodeKind: true,
      curriculumKey: true,
      curriculumVersion: true,
      curriculumTitle: true,
      userEditedAt: true,
      overview: true,
      parentId: true,
      sortOrder: true,
    },
  });
}

async function execute() {
  const { version, nodes: desiredNodes } = buildDesiredCurriculum();
  const beforeProtected = await protectedCounts();
  let nodes = await loadNodes();
  const beforeNodeCount = nodes.length;
  const assignedIds = new Set<string>();
  const resolved = new Map<string, NodeRecord>();
  const operations: PlannedOperation[] = [];
  const conflicts: Conflict[] = [];

  let verifiedBackup: { resolved: string; checksum: string } | null = null;
  if (apply) {
    if (!backupPath || backupPath === "true") {
      throw new Error("Apply mode requires --backup=<path-to-verified-json>.");
    }
    verifiedBackup = await verifyBackup(backupPath);
  }

  for (const [index, desired] of desiredNodes.entries()) {
    const parent = desired.parentKey ? resolved.get(desired.parentKey) : null;
    if (desired.parentKey && !parent) {
      conflicts.push({ key: desired.key, title: desired.title, reason: `Parent was not resolved: ${desired.parentKey}` });
      continue;
    }
    const parentId = parent?.id ?? null;
    const match = candidatesFor(desired, parentId, nodes, assignedIds);
    if (match.candidates.length > 1) {
      conflicts.push({
        key: desired.key,
        title: desired.title,
        reason: `Ambiguous ${match.matchedBy} match`,
        candidates: match.candidates.map(({ id, title, slug, curriculumKey }) => ({ id, title, slug, curriculumKey })),
      });
      continue;
    }

    const existing = match.candidates[0];
    if (existing?.curriculumKey && existing.curriculumKey !== desired.key) {
      conflicts.push({
        key: desired.key,
        title: desired.title,
        reason: `Matched node already belongs to ${existing.curriculumKey}`,
        candidates: [{ id: existing.id, title: existing.title, slug: existing.slug, curriculumKey: existing.curriculumKey }],
      });
      continue;
    }

    const values = desiredValues(desired, parentId, version, existing);
    if (!existing) {
      if (apply) {
        const created = await db.studyNode.create({
          data: {
            ...values,
            slug: desired.slug,
          },
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            nodeKind: true,
            curriculumKey: true,
            curriculumVersion: true,
            curriculumTitle: true,
            userEditedAt: true,
            overview: true,
            parentId: true,
            sortOrder: true,
          },
        });
        nodes.push(created);
        resolved.set(desired.key, created);
        assignedIds.add(created.id);
      } else {
        const virtual = virtualRecord(desired, parentId, version);
        nodes.push(virtual);
        resolved.set(desired.key, virtual);
        assignedIds.add(virtual.id);
      }
      operations.push({ action: "create", key: desired.key, title: desired.title, toParentId: parentId });
    } else {
      const needsUpdate = changed(existing, values);
      let materialized: NodeRecord = { ...existing, ...values };
      if (apply && needsUpdate) {
        materialized = await db.studyNode.update({
          where: { id: existing.id },
          data: values,
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            nodeKind: true,
            curriculumKey: true,
            curriculumVersion: true,
            curriculumTitle: true,
            userEditedAt: true,
            overview: true,
            parentId: true,
            sortOrder: true,
          },
        });
      }
      nodes = nodes.map((node) => (node.id === existing.id ? materialized : node));
      resolved.set(desired.key, materialized);
      assignedIds.add(existing.id);
      operations.push({
        action: needsUpdate ? "update" : "unchanged",
        key: desired.key,
        title: desired.title,
        matchedBy: match.matchedBy,
        existingId: existing.id,
        fromParentId: existing.parentId,
        toParentId: parentId,
        renamed: existing.title !== values.title,
        preservedUserTitle: Boolean(existing.userEditedAt && existing.title !== desired.title),
      });
    }

    if (apply && (index + 1) % 250 === 0) {
      console.log(`Applied ${index + 1}/${desiredNodes.length} curriculum nodes...`);
    }
  }

  const counts = operations.reduce<Record<string, number>>((acc, operation) => {
    acc[operation.action] = (acc[operation.action] ?? 0) + 1;
    if (operation.fromParentId !== operation.toParentId && operation.action === "update") acc.reparented = (acc.reparented ?? 0) + 1;
    if (operation.renamed) acc.renamed = (acc.renamed ?? 0) + 1;
    if (operation.preservedUserTitle) acc.preservedUserTitles = (acc.preservedUserTitles ?? 0) + 1;
    return acc;
  }, {});

  if (apply && conflicts.length) {
    throw new Error(`Import stopped with ${conflicts.length} conflict(s). Re-run dry mode and inspect the report.`);
  }

  const afterProtected = await protectedCounts();
  if (JSON.stringify(beforeProtected) !== JSON.stringify(afterProtected)) {
    throw new Error(`Protected record counts changed: before=${JSON.stringify(beforeProtected)} after=${JSON.stringify(afterProtected)}`);
  }

  const persistedNodeCount = apply ? await db.studyNode.count() : beforeNodeCount;
  if (apply && persistedNodeCount !== beforeNodeCount + (counts.create ?? 0)) {
    throw new Error(`Study node count invariant failed: before=${beforeNodeCount} created=${counts.create ?? 0} after=${persistedNodeCount}`);
  }

  if (apply) {
    const importedCount = await db.studyNode.count({ where: { curriculumVersion: version } });
    if (importedCount !== desiredNodes.length) {
      throw new Error(`Import completeness failed: expected=${desiredNodes.length} found=${importedCount}`);
    }
  }

  const report = {
    mode: apply ? "apply" : "dry-run",
    version,
    createdAt: new Date().toISOString(),
    desiredNodes: desiredNodes.length,
    beforeNodeCount,
    persistedNodeCount,
    protectedCounts: { before: beforeProtected, after: afterProtected },
    backup: verifiedBackup,
    counts,
    conflictCount: conflicts.length,
    conflicts,
    operations,
  };
  const directory = path.join(process.cwd(), "tmp", "curriculum-import");
  await mkdir(directory, { recursive: true });
  const reportPath = path.join(directory, `${report.mode}-${report.createdAt.replaceAll(":", "-").replaceAll(".", "-")}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    reportPath,
    mode: report.mode,
    desiredNodes: report.desiredNodes,
    counts,
    conflicts: conflicts.length,
    protectedCountsUnchanged: JSON.stringify(beforeProtected) === JSON.stringify(afterProtected),
  }, null, 2));

  if (conflicts.length) process.exitCode = 2;
}


execute()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
