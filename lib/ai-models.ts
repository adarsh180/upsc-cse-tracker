import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const GOOGLE_MODEL_ALIASES: Record<string, string> = {
  "gemma-4-31b": "gemma-4-31b-it",
  "gemma-4-26b": "gemma-4-26b-a4b-it",
  "gemma-4-26b-it": "gemma-4-26b-a4b-it",
  // gemma-3 was retired from the Generative Language API (404s as of mid-2026);
  // remap stale env values to a live fast model instead of failing.
  "gemma-3-27b": "gemini-flash-latest",
  "gemma-3-27b-it": "gemini-flash-latest",
  "gemma-3-12b": "gemini-flash-lite-latest",
  "gemma-3-12b-it": "gemini-flash-lite-latest",
};

export function normalizeGoogleModelId(modelId: string) {
  return GOOGLE_MODEL_ALIASES[modelId] ?? modelId;
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
});

/** Shared Google model instance for background/agentic jobs. */
export function getGoogleModel(envOverride?: string) {
  const modelId = envOverride ?? process.env.GOOGLE_AI_MODEL_PRIMARY ?? "gemma-4-31b-it";
  return google(normalizeGoogleModelId(modelId));
}

/**
 * generateText with a hard per-attempt timeout and automatic fallback chain.
 * Gemma-4 models come first (preferred voice/quality) with a generous time
 * budget; Gemini flash models are the LAST RESORT only, with a short timeout.
 * Background cron jobs must never hang on a single slow model call: the whole
 * serverless function gets killed at maxDuration (300s Vercel ceiling) and
 * every step after it is silently lost.
 */
export async function generateTextResilient(options: {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Time budget for the PRIMARY (gemma) attempt; fallbacks get shorter slices. */
  timeoutMs?: number;
  modelEnvOverride?: string;
}) {
  const chain = [
    options.modelEnvOverride ?? process.env.GOOGLE_AI_MODEL_PRIMARY ?? "gemma-4-31b-it",
    process.env.GOOGLE_AI_MODEL_FALLBACK ?? "gemma-4-26b-a4b-it",
    process.env.GOOGLE_AI_MODEL_SECOND_FALLBACK ?? "gemini-flash-latest",
    // Absolute last resort: the lite flash model stays responsive even when
    // the bigger models are overloaded (503) at peak hours.
    "gemini-flash-lite-latest",
  ].filter((id): id is string => Boolean(id));

  const primaryTimeout = options.timeoutMs ?? 150_000;
  let lastError: unknown;
  let attempt = 0;
  for (const modelId of [...new Set(chain.map(normalizeGoogleModelId))]) {
    // First (gemma) attempt gets the full budget; each fallback gets a tighter
    // slice so the chain still finishes inside the function's maxDuration.
    const timeoutMs = attempt === 0 ? primaryTimeout : Math.min(primaryTimeout, attempt === 1 ? 90_000 : 45_000);
    attempt += 1;
    try {
      return await generateText({
        model: google(modelId),
        prompt: options.prompt,
        temperature: options.temperature ?? 0.5,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        abortSignal: AbortSignal.timeout(timeoutMs),
        // Gemini flash models default to extended thinking, which silently eats
        // the output-token budget and multiplies latency. These are structured
        // JSON jobs — disable thinking.
        providerOptions: modelId.includes("gemini")
          ? { google: { thinkingConfig: { thinkingBudget: 0 } } }
          : undefined,
      });
    } catch (error) {
      lastError = error;
      console.error(`[ai-models] ${modelId} failed, trying next in chain:`, error instanceof Error ? error.message : error);
    }
  }
  throw lastError;
}

/** Extract the first JSON object/array from a model response that may include prose or fences. */
export function extractJsonBlock<T>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = Math.min(
    ...[cleaned.indexOf("{"), cleaned.indexOf("[")].filter((index) => index >= 0),
  );
  if (!Number.isFinite(start)) return null;
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
