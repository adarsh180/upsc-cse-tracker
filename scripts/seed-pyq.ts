import "dotenv/config";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { addPyqQuestion } from "@/lib/pyq";

type SeedPyq = {
  year: number;
  examStage: "PRELIMS" | "MAINS";
  paper: string;
  subject: string;
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

async function run() {
  const raw = readFileSync(join(process.cwd(), "data", "pyq-seed.json"), "utf8");
  const questions = JSON.parse(raw) as SeedPyq[];

  let added = 0;
  let skipped = 0;
  for (const question of questions) {
    if (!question.options.includes(question.correctAnswer)) {
      console.warn(`SKIP (answer not in options): ${question.question.slice(0, 60)}`);
      skipped += 1;
      continue;
    }
    const result = await addPyqQuestion(question);
    if (result.deduplicated) skipped += 1;
    else added += 1;
  }
  console.log(`PYQ seed complete: ${added} added, ${skipped} skipped (duplicates/invalid).`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
