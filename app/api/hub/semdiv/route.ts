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
async function owner(path: string, method: "GET" | "POST" = "GET") {
  const secret = process.env.OWNER_API_SECRET;
  if (!secret) return NextResponse.json({ error: "The SEMDIV link isn't set up: OWNER_API_SECRET is missing on this site." }, { status: 503 });
  const ts = String(Date.now());
  const sig = createHmac("sha256", secret).update(`${ts}.${path}`).digest("hex");
  try {
    const res = await fetch(ORIGIN + path, { method, headers: { "x-owner-ts": ts, "x-owner-sig": sig }, cache: "no-store", signal: AbortSignal.timeout(25000) });
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
  const actor = await actorFor(req);
  if (!actor) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const view = req.nextUrl.searchParams.get("view") ?? "stats";
  const id = encodeURIComponent(req.nextUrl.searchParams.get("id") ?? "");
  if (view === "person") return owner(`/api/owner/person?id=${id}`);
  if (view === "report") return owner(`/api/owner/report?id=${id}`);
  const [stats, up] = await Promise.all([owner("/api/owner/stats"), health()]);
  if (!stats.ok) return stats;
  const body = await stats.json();
  return NextResponse.json({ ...body, health: up, canEdit: actor === "adarsh" });
}

// POST { action: "pro", id, change: "add"|"until"|"lifetime"|"end", days?, date?, note? }
//      { action: "refund", txnid, removePro, note? } · { action: "reminders" }
// Only Adarsh can change plans and payments; the NEET view stays read-only.
export async function POST(req: NextRequest) {
  const actor = await actorFor(req);
  if (!actor) return NextResponse.json({ error: "Locked" }, { status: 401 });
  if (actor !== "adarsh") return NextResponse.json({ error: "Only Adarsh can change plans and payments." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
  const q = new URLSearchParams();
  let path: string;
  if (b.action === "pro") {
    q.set("id", str(b.id));
    q.set("action", str(b.change));
    if (b.days != null) q.set("days", str(b.days));
    if (b.date) q.set("date", str(b.date));
    if (b.note) q.set("note", str(b.note).slice(0, 200));
    path = "/api/owner/pro";
  } else if (b.action === "refund") {
    q.set("txnid", str(b.txnid));
    q.set("removePro", b.removePro ? "1" : "0");
    if (b.note) q.set("note", str(b.note).slice(0, 200));
    path = "/api/owner/refund";
  } else if (b.action === "reminders") path = "/api/owner/reminders";
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  // The query string is part of what the owner signature covers.
  return owner(q.size ? `${path}?${q}` : path, "POST");
}
