import "dotenv/config";

import { buildDesiredCurriculum } from "@/lib/curriculum-manifest";
import { db } from "@/lib/db";


async function main() {
  const desired = buildDesiredCurriculum();
  const nodes = await db.studyNode.findMany({
    select: {
      id: true,
      title: true,
      parentId: true,
      curriculumKey: true,
      curriculumVersion: true,
      curriculumTitle: true,
      userEditedAt: true,
      nodeKind: true,
    },
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const byKey = new Map(nodes.filter((node) => node.curriculumKey).map((node) => [node.curriculumKey!, node]));
  const desiredByKey = new Map(desired.nodes.map((node) => [node.key, node]));

  const missing: string[] = [];
  const parentMismatches: Array<{ key: string; expected: string | null; actual: string | null }> = [];
  const metadataMismatches: string[] = [];
  for (const expected of desired.nodes) {
    const actual = byKey.get(expected.key);
    if (!actual) {
      missing.push(expected.key);
      continue;
    }
    const actualParentKey = actual.parentId ? byId.get(actual.parentId)?.curriculumKey ?? null : null;
    if (actualParentKey !== expected.parentKey) {
      parentMismatches.push({ key: expected.key, expected: expected.parentKey, actual: actualParentKey });
    }
    if (
      actual.curriculumVersion !== desired.version ||
      actual.curriculumTitle !== expected.curriculumTitle ||
      actual.nodeKind !== expected.nodeKind ||
      (!actual.userEditedAt && actual.title !== expected.title)
    ) {
      metadataMismatches.push(expected.key);
    }
  }

  const unexpectedCanonical = nodes
    .filter((node) => node.curriculumKey && !desiredByKey.has(node.curriculumKey))
    .map((node) => node.curriculumKey!);
  const orphanIds = nodes.filter((node) => node.parentId && !byId.has(node.parentId)).map((node) => node.id);
  const cycles: string[] = [];
  for (const node of nodes) {
    const seen = new Set<string>();
    let current = node;
    while (current.parentId) {
      if (seen.has(current.id)) {
        cycles.push(node.id);
        break;
      }
      seen.add(current.id);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
  }

  const [progress, checked, revised, logs, linkedLogs, tests, linkedTests] = await Promise.all([
    db.topicProgress.count(),
    db.topicProgress.count({ where: { checked: true } }),
    db.topicProgress.count({ where: { revisionCount: { gt: 0 } } }),
    db.studyLog.count(),
    db.studyLog.count({ where: { studyNodeId: { not: null } } }),
    db.testRecord.count(),
    db.testRecord.count({ where: { studyNodeId: { not: null } } }),
  ]);

  const result = {
    ok: !missing.length && !parentMismatches.length && !metadataMismatches.length && !orphanIds.length && !cycles.length,
    version: desired.version,
    desiredNodes: desired.nodes.length,
    canonicalNodes: nodes.filter((node) => node.curriculumVersion === desired.version).length,
    personalOrLegacyNodes: nodes.filter((node) => !node.curriculumKey).length,
    totalNodes: nodes.length,
    issues: { missing, parentMismatches, metadataMismatches, unexpectedCanonical, orphanIds, cycles },
    protectedRecords: { progress, checked, revised, logs, linkedLogs, tests, linkedTests },
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}


main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
