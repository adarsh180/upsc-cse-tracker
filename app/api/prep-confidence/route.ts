import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getUPSCPrepConfidence } from "@/lib/prep-confidence";

export const dynamic = "force-dynamic";

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Private endpoint: requires either a signed-in session (your browser)
 * or the shared cross-app secret header (the NEET tracker instance).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  const crossAppSecret = process.env.CROSS_APP_NOTIFY_SECRET;
  const header = request.headers.get("x-cross-app-secret") ?? "";
  const crossAppAuthorized = Boolean(
    crossAppSecret && header && timingSafeEqual(header, crossAppSecret),
  );

  if (!session && !crossAppAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const data = await getUPSCPrepConfidence();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[prep-confidence]", error);
    return NextResponse.json(
      { error: "Failed to load live prep confidence" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
