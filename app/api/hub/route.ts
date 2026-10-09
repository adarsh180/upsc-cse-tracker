import { NextRequest, NextResponse } from "next/server";

import { applyHubAction, HubError, loadHub, verifyCrossHub } from "@/lib/hub/store";
import { gateGuard } from "@/lib/vault/auth";
import type { Person } from "@/lib/hub/metrics";

export const dynamic = "force-dynamic";

/** Adarsh: UPSC session + personal-hub gate. Misti: a signed request from her NEET site's server. */
async function actorFor(req: NextRequest, raw: string): Promise<Person | null> {
  if (req.headers.has("x-hub-sig")) return verifyCrossHub(req.headers, raw);
  return (await gateGuard("hub")) ? "adarsh" : null;
}

export async function GET(req: NextRequest) {
  const actor = await actorFor(req, "");
  if (!actor) return NextResponse.json({ error: "Locked" }, { status: 401 });
  try {
    return NextResponse.json(await loadHub(actor));
  } catch (error) {
    console.error("[hub] load failed", error);
    return NextResponse.json({ error: "The database is waking up — try again in a moment." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const actor = await actorFor(req, raw);
  if (!actor) return NextResponse.json({ error: "Locked" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    await applyHubAction(actor, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HubError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[hub] write failed", body.action, error);
    return NextResponse.json({ error: "Could not save — the database may be waking up. Try again." }, { status: 503 });
  }
}
