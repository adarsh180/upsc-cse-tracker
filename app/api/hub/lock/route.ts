import { NextResponse } from "next/server";

import { lockGate } from "@/lib/vault/auth";

export const dynamic = "force-dynamic";

/** Closes the personal hub on this device (the UPSC session stays signed in). */
export async function POST() {
  await lockGate("hub");
  return NextResponse.json({ ok: true });
}
