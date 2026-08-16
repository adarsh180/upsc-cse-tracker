import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "@/lib/db";


async function main() {
  const [studyNodes, topicProgress, studyLogs, testRecords, agentTasks, pyqQuestions] = await Promise.all([
    db.studyNode.findMany({ orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }] }),
    db.topicProgress.findMany({ orderBy: { id: "asc" } }),
    db.studyLog.findMany({ orderBy: { id: "asc" } }),
    db.testRecord.findMany({ orderBy: { id: "asc" } }),
    db.agentTask.findMany({ orderBy: { id: "asc" } }),
    db.pyqQuestion.findMany({ orderBy: { id: "asc" } }),
  ]);

  const createdAt = new Date().toISOString();
  const payload = {
    format: "upsc-study-data-backup/v1",
    createdAt,
    tables: { studyNodes, topicProgress, studyLogs, testRecords, agentTasks, pyqQuestions },
  };
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  const checksum = createHash("sha256").update(serialized).digest("hex");
  const directory = path.join(process.cwd(), "tmp", "backups");
  const stamp = createdAt.replaceAll(":", "-").replaceAll(".", "-");
  const output = path.join(directory, `study-data-${stamp}.json`);

  await mkdir(directory, { recursive: true });
  await writeFile(output, serialized, "utf8");
  await writeFile(`${output}.sha256`, `${checksum}  ${path.basename(output)}\n`, "utf8");

  console.log(JSON.stringify({
    output,
    checksum,
    counts: {
      studyNodes: studyNodes.length,
      topicProgress: topicProgress.length,
      studyLogs: studyLogs.length,
      testRecords: testRecords.length,
      agentTasks: agentTasks.length,
      pyqQuestions: pyqQuestions.length,
    },
  }, null, 2));
}


main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
