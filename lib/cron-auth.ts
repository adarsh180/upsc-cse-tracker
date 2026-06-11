import { NextRequest } from "next/server";

/**
 * Authorizes a cron/diagnostic request either via the Vercel-injected
 * "Authorization: Bearer <CRON_SECRET>" header (automatic cron runs) or a
 * "?key=<CRON_SECRET>" query param (manual browser trigger for testing).
 */
export function isCronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("key") === secret;
}
