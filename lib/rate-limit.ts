/**
 * Minimal in-memory rate limiter — zero dependencies, free.
 * Note: on serverless this resets per cold start, but it still slows
 * automated brute force to a crawl within each warm instance, and this
 * is a single-user app behind a strong secret.
 */

type Bucket = {
  count: number;
  firstAttemptAt: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMinutes: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.firstAttemptAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now });
    return { allowed: true, retryAfterMinutes: 0 };
  }

  bucket.count += 1;

  if (bucket.count > MAX_ATTEMPTS) {
    const retryAfterMinutes = Math.ceil((bucket.firstAttemptAt + WINDOW_MS - now) / 60000);
    return { allowed: false, retryAfterMinutes };
  }

  return { allowed: true, retryAfterMinutes: 0 };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

/** Constant-time string comparison to avoid timing side channels. */
export function timingSafeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  let result = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return result === 0;
}
