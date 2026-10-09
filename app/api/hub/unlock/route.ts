import { NextRequest, NextResponse } from "next/server";

import { unlockGate } from "@/lib/vault/auth";

export const dynamic = "force-dynamic";

/** Opens Saath for 24 hours on this device with the dashboard-switch password. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await unlockGate("hub", String(body.password ?? ""));
  if (!result.ok) return NextResponse.json({ error: result.error, lockedMinutes: result.lockedMinutes ?? null }, { status: result.lockedMinutes ? 429 : 401 });
  return NextResponse.json({ ok: true });
}
