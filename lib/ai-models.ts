const GOOGLE_MODEL_ALIASES: Record<string, string> = {
  "gemma-4-31b": "gemma-4-31b-it",
  "gemma-4-26b": "gemma-4-26b-a4b-it",
  "gemma-3-27b": "gemma-3-27b-it",
  "gemma-3-12b": "gemma-3-12b-it",
};

export function normalizeGoogleModelId(modelId: string) {
  return GOOGLE_MODEL_ALIASES[modelId] ?? modelId;
}
