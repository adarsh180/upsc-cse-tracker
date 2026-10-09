import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyGatePassword } from "@/lib/gate-secret";

/**
 * Private dashboards (the AI-ML vault and the personal hub) sit behind their
 * own gate: a signed-in UPSC session is not enough — the dashboard-switch
 * password (stored only as a scrypt hash) opens a separate, short-lived,
 * strict same-site session per dashboard. Five wrong tries lock the gate.
 */

export type GateScope = "vault" | "hub";
export const GATE_COOKIE: Record<GateScope, string> = { vault: "upsc-vault", hub: "upsc-hub" };
const GATE_HOURS: Record<GateScope, number> = { vault: 12, hub: 24 };
export const VAULT_COOKIE = GATE_COOKIE.vault;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const rawSecret = process.env.AUTH_SECRET ?? process.env.AUTH_PASSWORD ?? "";
// Derived keys: a gate token can never be replayed as an app session, or as another gate.
const gateKey = (scope: GateScope) => new TextEncoder().encode(createHash("sha256").update(`${scope}-scope:${rawSecret}`).digest("hex"));

const hash = (value: string) => createHash("sha256").update(`vault:${rawSecret}:${value}`).digest("hex");

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function logVaultEvent(kind: string) {
  try {
    await db.vaultEvent.create({ data: { kind, ipHash: hash(await clientIp()) } });
  } catch (error) {
    console.error("[gate] event log failed", error);
  }
}

export async function verifyGateToken(scope: GateScope, token: string | undefined) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, gateKey(scope));
    return payload.scope === scope;
  } catch {
    return false;
  }
}

export async function hasGateSession(scope: GateScope) {
  const store = await cookies();
  return verifyGateToken(scope, store.get(GATE_COOKIE[scope])?.value);
}
export const hasVaultSession = () => hasGateSession("vault");

/** Server components / actions: require both the app session and the gate session. */
export async function requireGate(scope: GateScope) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!(await hasGateSession(scope))) redirect(`/${scope}/unlock`);
  return session;
}
export const requireVault = () => requireGate("vault");

/** Route handlers: same check, answered with 401 instead of a redirect. */
export async function gateGuard(scope: GateScope) {
  const session = await getSession();
  return Boolean(session) && (await hasGateSession(scope));
}
export const vaultGuard = () => gateGuard("vault");

export type UnlockResult = { ok: true } | { ok: false; error: string; lockedMinutes?: number };

export async function unlockGate(scope: GateScope, password: string): Promise<UnlockResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in first." };

  // One lockout counter per device for every private dashboard.
  const keyHash = hash(`attempt:${await clientIp()}`);
  const now = new Date();
  const attempt = await db.vaultAttempt.findUnique({ where: { keyHash } }).catch(() => null);
  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    const lockedMinutes = Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 60000);
    return { ok: false, error: `Locked after ${MAX_FAILURES} wrong attempts.`, lockedMinutes };
  }

  if (!(await verifyGatePassword("upsc", password))) {
    const failures = (attempt?.lockedUntil && attempt.lockedUntil <= now ? 0 : attempt?.failures ?? 0) + 1;
    const lockedUntil = failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MINUTES * 60000) : null;
    await db.vaultAttempt
      .upsert({ where: { keyHash }, create: { keyHash, failures, lockedUntil }, update: { failures, lockedUntil } })
      .catch((error) => console.error("[gate] attempt write failed", error));
    await logVaultEvent(`${scope}:${lockedUntil ? "locked" : "failed"}`);
    await new Promise((r) => setTimeout(r, 500));
    return lockedUntil
      ? { ok: false, error: `Locked after ${MAX_FAILURES} wrong attempts.`, lockedMinutes: LOCK_MINUTES }
      : { ok: false, error: `Wrong password — ${MAX_FAILURES - failures} attempt${MAX_FAILURES - failures === 1 ? "" : "s"} left.` };
  }

  await db.vaultAttempt.deleteMany({ where: { keyHash } }).catch(() => null);
  const hours = GATE_HOURS[scope];
  const token = await new SignJWT({ scope }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${hours}h`).sign(gateKey(scope));
  const store = await cookies();
  store.set(GATE_COOKIE[scope], token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: hours * 3600 });
  await logVaultEvent(`${scope}:unlocked`);
  return { ok: true };
}
export const unlockVault = (password: string) => unlockGate("vault", password);

export async function lockGate(scope: GateScope) {
  const store = await cookies();
  store.delete(GATE_COOKIE[scope]);
  await logVaultEvent(`${scope}:locked-manual`);
}
export const lockVault = () => lockGate("vault");
