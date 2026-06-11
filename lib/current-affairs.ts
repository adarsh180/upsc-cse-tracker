import { db } from "@/lib/db";
import { extractJsonBlock, generateTextResilient } from "@/lib/ai-models";

type SourceKind = "news" | "editorial" | "explainer" | "govt" | "policy";

const RSS_SOURCES: Array<{ name: string; url: string; kind: SourceKind; limit: number }> = [
  { name: "The Hindu (National)", url: "https://www.thehindu.com/news/national/feeder/default.rss", kind: "news", limit: 12 },
  { name: "The Hindu (Business)", url: "https://www.thehindu.com/business/Economy/feeder/default.rss", kind: "news", limit: 8 },
  { name: "The Hindu (Editorial)", url: "https://www.thehindu.com/opinion/editorial/feeder/default.rss", kind: "editorial", limit: 6 },
  { name: "Indian Express (India)", url: "https://indianexpress.com/section/india/feed/", kind: "news", limit: 12 },
  { name: "Indian Express (Explained)", url: "https://indianexpress.com/section/explained/feed/", kind: "explainer", limit: 10 },
  { name: "Indian Express (Editorials)", url: "https://indianexpress.com/section/opinion/editorials/feed/", kind: "editorial", limit: 6 },
  { name: "PIB", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3", kind: "govt", limit: 12 },
  { name: "PRS Legislative Research", url: "https://prsindia.org/theprsblog/feed", kind: "policy", limit: 6 },
  { name: "Down To Earth", url: "https://www.downtoearth.org.in/rss/india", kind: "policy", limit: 6 },
];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Midnight (IST) of today, stored as a UTC Date for use as a stable daily key. */
export function istDayKey(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

type RawHeadline = { title: string; link: string; source: string; kind: SourceKind; description: string };

export type DigestItem = {
  title: string;
  link: string;
  source: string;
  upscAngle: string;
  syllabusTag: string;
  keyPoints?: string[];
  prelimsPointer?: string;
  mainsAngle?: string;
};

export type EditorialPick = {
  title: string;
  source: string;
  link: string;
  gsPapers: string;
  coreArgument: string;
  keyArguments: string[];
  usableQuote?: string;
  whyReadIt: string;
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

function parseRssItems(xml: string, source: string, kind: SourceKind, limit: number): RawHeadline[] {
  const items: RawHeadline[] = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const block of itemBlocks.slice(0, limit)) {
    const title = decodeEntities(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link = decodeEntities(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const description = decodeEntities(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "",
    ).slice(0, kind === "editorial" ? 450 : 280);
    if (title) items.push({ title, link, source, kind, description });
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
      return parseRssItems(await response.text(), sourceConfig.name, sourceConfig.kind, sourceConfig.limit);
    }),
  );

  return results
    .filter((result): result is PromiseFulfilledResult<RawHeadline[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);
}

async function generateDigestFromHeadlines(headlines: RawHeadline[]) {
  const newsHeadlines = headlines.filter((headline) => headline.kind !== "editorial");
  const editorialHeadlines = headlines.filter((headline) => headline.kind === "editorial");

  const prompt = `You are the daily current-affairs analyst for a UPSC CSE aspirant (Prelims + Mains, GS papers, PSIR optional). Your digest replaces his newspaper reading time, so it must be precise and information-dense — exact names, numbers, articles of the Constitution, scheme names, ministries, committee names, report titles. Never vague.

From the raw headlines below, select the 8-12 NEWS items that genuinely matter for UPSC and the 2-3 EDITORIALS most worth his reading time, then produce STRICT JSON (no prose, no markdown fences) with this exact shape:
{
  "summaryText": "8-12 sentence exam-oriented brief of today's UPSC-relevant developments. Dense with specifics, no fluff.",
  "items": [
    {
      "title": "...",
      "link": "...",
      "source": "...",
      "syllabusTag": "GS2 Polity / GS3 Economy / GS3 Environment / GS2 IR / GS1 Society / GS3 S&T / GS3 Security / PSIR",
      "upscAngle": "1-2 sentences: why this matters for the exam and how it could be asked",
      "keyPoints": ["3-5 precise factual bullets — the exact data, names, provisions, definitions worth noting down"],
      "prelimsPointer": "the single most testable prelims fact in one line",
      "mainsAngle": "how to use this in a mains answer: which question themes, what argument or example it supports"
    }
  ],
  "editorials": [
    {
      "title": "...",
      "source": "...",
      "link": "...",
      "gsPapers": "e.g. GS2 Governance + Essay",
      "coreArgument": "2-3 sentence distillation of the editorial's thesis",
      "keyArguments": ["3-4 bullets of its strongest arguments/evidence usable in mains answers"],
      "usableQuote": "one short quotable line if present, else omit",
      "whyReadIt": "1 line: why this editorial is worth his limited time today"
    }
  ],
  "quiz": [
    { "question": "UPSC-prelims-style MCQ grounded in one of the selected items", "options": ["A","B","C","D"], "answerIndex": 0, "explanation": "short justification" }
  ]
}
Rules: exactly 5 quiz questions, plausible distractors, statement-based formats ("Consider the following statements...") where natural. Skip celebrity/sports/crime/local-politics items entirely. For keyPoints, prefer verifiable specifics from the headline/description; do not invent statistics that are not implied by the text. Cover a spread of GS papers when the day's news allows. Where a theme matches Yojana/Kurukshetra magazine themes (rural development, governance schemes), say so inside mainsAngle.

NEWS & GOVT/POLICY HEADLINES:
${newsHeadlines.map((h, i) => `${i + 1}. [${h.source}] ${h.title} — ${h.description}`).join("\n")}

TODAY'S EDITORIALS:
${editorialHeadlines.map((h, i) => `${i + 1}. [${h.source}] ${h.title} — ${h.description}`).join("\n")}`;

  // The digest needs a large output (8K tokens) — the 31B Gemma models are too
  // slow for that within a cron budget, so default to a fast flash model.
  const result = await generateTextResilient({
    prompt,
    temperature: 0.4,
    maxOutputTokens: 8192,
    timeoutMs: 90_000,
    modelEnvOverride: process.env.GOOGLE_AI_MODEL_DIGEST ?? "gemini-flash-latest",
  });

  const parsed = extractJsonBlock<{
    summaryText: string;
    items: DigestItem[];
    editorials?: EditorialPick[];
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
      editorialsJson: JSON.stringify(generated.editorials ?? []),
      sourcesJson: JSON.stringify(RSS_SOURCES.map((source) => source.name)),
      model: process.env.GOOGLE_AI_MODEL_DIGEST ?? "gemini-flash-latest",
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
