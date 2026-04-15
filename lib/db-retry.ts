const RETRYABLE_CODES = new Set(["ECONNRESET", "UND_ERR_CONNECT_TIMEOUT", "ETIMEDOUT"]);

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;

  const directCode = "code" in error ? error.code : null;
  if (typeof directCode === "string") return directCode;

  const cause = "cause" in error ? error.cause : null;
  if (cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string") {
    return cause.code;
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

function isRetryableDbError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    (code !== null && RETRYABLE_CODES.has(code)) ||
    message.includes("fetch failed") ||
    message.includes("econnreset")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDbRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableDbError(error) || attempt === attempts) {
        throw error;
      }

      await sleep(150 * attempt);
    }
  }

  throw lastError;
}
