import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { verifyCrossHub } from "@/lib/hub/store";
import type { Person } from "@/lib/hub/metrics";
import { gateGuard } from "@/lib/vault/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Adarsh: UPSC session + hub gate. Misti: a signed request from her NEET site's server. */
async function actorFor(req: NextRequest): Promise<Person | null> {
  if (req.headers.has("x-hub-sig")) return verifyCrossHub(req.headers, "");
  return (await gateGuard("hub")) ? "adarsh" : null;
}

const ORIGIN = (process.env.SEMDIV_ORIGIN || "https://www.semdiv.com").replace(/\/$/, "");

/** Calls SEMDIV's owner API, signed with the shared OWNER_API_SECRET. */
async function owner(path: string) {
  const secret = process.env.OWNER_API_SECRET;
  if (!secret) return NextResponse.json({ error: "The SEMDIV link isn't set up: OWNER_API_SECRET is missing on this site." }, { status: 503 });
  const ts = String(Date.now());
  const sig = createHmac("sha256", secret).update(`${ts}.${path}`).digest("hex");
  try {
    const res = await fetch(ORIGIN + path, { headers: { "x-owner-ts": ts, "x-owner-sig": sig }, cache: "no-store", signal: AbortSignal.timeout(25000) });
    if (res.status === 401) return NextResponse.json({ error: "SEMDIV refused the request — OWNER_API_SECRET differs between SEMDIV and this site." }, { status: 502 });
    return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Couldn't reach SEMDIV right now." }, { status: 504 });
  }
}

/** Is www.semdiv.com up, and how quickly does it answer? */
async function health() {
  const t0 = Date.now();
  try {
    const res = await fetch(ORIGIN + "/robots.txt", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    return { up: res.ok, status: res.status, ms: Date.now() - t0, checkedAt: new Date().toISOString() };
  } catch {
    return { up: false, status: 0, ms: Date.now() - t0, checkedAt: new Date().toISOString() };
  }
}

// GET ?view=stats | person&id=… | report&id=…
export async function GET(req: NextRequest) {
  if (!(await actorFor(req))) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const view = req.nextUrl.searchParams.get("view") ?? "stats";
  const id = encodeURIComponent(req.nextUrl.searchParams.get("id") ?? "");
  if (view === "person") return owner(`/api/owner/person?id=${id}`);
  if (view === "report") return owner(`/api/owner/report?id=${id}`);
  const [stats, up] = await Promise.all([owner("/api/owner/stats"), health()]);
  if (!stats.ok) return stats;
  const body = await stats.json();
  return NextResponse.json({ ...body, health: up });
}
