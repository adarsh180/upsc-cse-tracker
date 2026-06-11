import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getOrCreateTodayDigest } from "@/lib/current-affairs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Generate (or return) today's digest on demand — fallback when the 7AM cron misses. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { digest, created } = await getOrCreateTodayDigest();
    return NextResponse.json({ ok: true, created, digestDate: digest.digestDate });
  } catch (error) {
    console.error("[current-affairs] on-demand digest failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Digest generation failed" },
      { status: 500 },
    );
  }
}
