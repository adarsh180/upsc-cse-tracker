import { createGoogleGenerativeAI } from "@ai-sdk/google";

const GOOGLE_MODEL_ALIASES: Record<string, string> = {
  "gemma-4-31b": "gemma-4-31b-it",
  "gemma-4-26b": "gemma-4-26b-a4b-it",
  "gemma-3-27b": "gemma-3-27b-it",
  "gemma-3-12b": "gemma-3-12b-it",
};

export function normalizeGoogleModelId(modelId: string) {
  return GOOGLE_MODEL_ALIASES[modelId] ?? modelId;
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
});

/** Shared Google model instance for background/agentic jobs. */
export function getGoogleModel(envOverride?: string) {
  const modelId = envOverride ?? process.env.GOOGLE_AI_MODEL_PRIMARY ?? "gemma-3-27b-it";
  return google(normalizeGoogleModelId(modelId));
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
