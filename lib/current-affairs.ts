import { generateText } from "ai";

import { db } from "@/lib/db";
import { extractJsonBlock, getGoogleModel } from "@/lib/ai-models";

const RSS_SOURCES = [
  { name: "The Hindu (National)", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
  { name: "PIB", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3" },
  { name: "The Hindu (Business)", url: "https://www.thehindu.com/business/Economy/feeder/default.rss" },
];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Midnight (IST) of today, stored as a UTC Date for use as a stable daily key. */
export function istDayKey(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

type RawHeadline = { title: string; link: string; source: string; description: string };

export type DigestItem = {
  title: string;
  link: string;
  source: string;
  upscAngle: string;
  syllabusTag: string;
};

export type DigestQuizItem = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml: string, source: string, limit: number): RawHeadline[] {
  const items: RawHeadline[] = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const block of itemBlocks.slice(0, limit)) {
    const title = decodeEntities(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link = decodeEntities(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const description = decodeEntities(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "",
    ).slice(0, 280);
    if (title) items.push({ title, link, source, description });
  }
  return items;
}

async function fetchHeadlines(): Promise<RawHeadline[]> {
  const results = await Promise.allSettled(
    RSS_SOURCES.map(async (sourceConfig) => {
      const response = await fetch(sourceConfig.url, {
        headers: { "user-agent": "Mozilla/5.0 (UPSC-Tracker digest bot)" },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`${sourceConfig.name} returned ${response.status}`);
      return parseRssItems(await response.text(), sourceConfig.name, 12);
    }),
  );

  return results
    .filter((result): result is PromiseFulfilledResult<RawHeadline[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);
}

async function generateDigestFromHeadlines(headlines: RawHeadline[]) {
  const prompt = `You are the daily current-affairs analyst for a UPSC CSE aspirant (Prelims + Mains, GS papers, PSIR optional).
From the raw headlines below, select the 6-10 items that genuinely matter for UPSC and produce STRICT JSON (no prose, no markdown fences) with this exact shape:
{
  "summaryText": "5-8 sentence brief of today's UPSC-relevant developments, exam-oriented, no fluff",
  "items": [
    { "title": "...", "link": "...", "source": "...", "upscAngle": "1-2 sentences on why this matters for the exam and how it could be asked", "syllabusTag": "e.g. GS2 Polity / GS3 Economy / GS3 Environment / GS2 IR" }
  ],
  "quiz": [
    { "question": "UPSC-prelims-style MCQ grounded in one of the selected items", "options": ["A","B","C","D"], "answerIndex": 0, "explanation": "short justification" }
  ]
}
Rules: exactly 5 quiz questions, plausible distractors, statement-based formats where natural. Skip celebrity/sports/crime items entirely.

RAW HEADLINES:
${headlines.map((h, i) => `${i + 1}. [${h.source}] ${h.title} — ${h.description}`).join("\n")}`;

  const model = getGoogleModel(process.env.GOOGLE_AI_MODEL_DIGEST);
  const result = await generateText({ model, prompt, temperature: 0.4, maxOutputTokens: 4096 });

  const parsed = extractJsonBlock<{
    summaryText: string;
    items: DigestItem[];
    quiz: DigestQuizItem[];
  }>(result.text);

  if (!parsed?.summaryText || !Array.isArray(parsed.items)) {
    throw new Error("Digest model returned unparseable output.");
  }
  return parsed;
}

/** Idempotent: returns today's digest (IST), generating it if missing. */
export async function getOrCreateTodayDigest() {
  const dayKey = istDayKey();

  const existing = await db.currentAffairsDigest.findUnique({ where: { digestDate: dayKey } });
  if (existing) return { digest: existing, created: false };

  const headlines = await fetchHeadlines();
  if (headlines.length === 0) throw new Error("No headlines could be fetched from RSS sources.");

  const generated = await generateDigestFromHeadlines(headlines);

  const digest = await db.currentAffairsDigest.upsert({
    where: { digestDate: dayKey },
    update: {},
    create: {
      digestDate: dayKey,
      summaryText: generated.summaryText,
      itemsJson: JSON.stringify(generated.items ?? []),
      quizJson: JSON.stringify(generated.quiz ?? []),
      sourcesJson: JSON.stringify(RSS_SOURCES.map((source) => source.name)),
      model: process.env.GOOGLE_AI_MODEL_DIGEST ?? process.env.GOOGLE_AI_MODEL_PRIMARY ?? "gemma-3-27b-it",
    },
  });

  return { digest, created: true };
}

export async function getLatestDigest() {
  return db.currentAffairsDigest.findFirst({ orderBy: { digestDate: "desc" } });
}

/** How many of the last 14 IST days have a digest AND any study touch of current affairs. */
export async function getDigestStreak() {
  const since = new Date(istDayKey().getTime() - 14 * 86_400_000);
  const digests = await db.currentAffairsDigest.count({ where: { digestDate: { gte: since } } });
  return { digestsLast14Days: digests };
}
