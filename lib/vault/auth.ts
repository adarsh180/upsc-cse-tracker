import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { timingSafeEqual } from "@/lib/rate-limit";

/**
 * The AI-ML vault sits behind its own gate: a signed-in UPSC session is not
 * enough — the password is re-entered to open a separate, shorter-lived vault
 * session (12h, scope "vault", strict same-site). The unlock check lives in
 * one function (`verifyVaultFactors`) so a second factor can be added later.
 */

export const VAULT_COOKIE = "upsc-vault";
const VAULT_HOURS = 12;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const rawSecret = process.env.AUTH_SECRET ?? process.env.AUTH_PASSWORD ?? "";
// Derived key: a vault token can never be replayed as an app session or vice versa.
const vaultKey = new TextEncoder().encode(createHash("sha256").update(`vault-scope:${rawSecret}`).digest("hex"));

const hash = (value: string) => createHash("sha256").update(`vault:${rawSecret}:${value}`).digest("hex");

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function logVaultEvent(kind: string) {
  try {
    await db.vaultEvent.create({ data: { kind, ipHash: hash(await clientIp()) } });
  } catch (error) {
    console.error("[vault] event log failed", error);
  }
}

export async function verifyVaultToken(token: string | undefined) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, vaultKey);
    return payload.scope === "vault";
  } catch {
    return false;
  }
}

export async function hasVaultSession() {
  const store = await cookies();
  return verifyVaultToken(store.get(VAULT_COOKIE)?.value);
}

/** Server components / actions: require both the app session and the vault session. */
export async function requireVault() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!(await hasVaultSession())) redirect("/vault/unlock");
  return session;
}

/** Route handlers: same check, answered with 401 instead of a redirect. */
export async function vaultGuard() {
  const session = await getSession();
  return Boolean(session) && (await hasVaultSession());
}

function verifyVaultFactors(password: string) {
  const expected = process.env.AUTH_PASSWORD ?? "";
  return Boolean(expected) && timingSafeEqual(password, expected);
}

export type UnlockResult = { ok: true } | { ok: false; error: string; lockedMinutes?: number };

export async function unlockVault(password: string): Promise<UnlockResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in first." };

  const keyHash = hash(`attempt:${await clientIp()}`);
  const now = new Date();
  const attempt = await db.vaultAttempt.findUnique({ where: { keyHash } }).catch(() => null);
  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    const lockedMinutes = Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 60000);
    return { ok: false, error: `Vault locked after ${MAX_FAILURES} wrong attempts.`, lockedMinutes };
  }

  if (!verifyVaultFactors(password)) {
    const failures = (attempt?.lockedUntil && attempt.lockedUntil <= now ? 0 : attempt?.failures ?? 0) + 1;
    const lockedUntil = failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MINUTES * 60000) : null;
    await db.vaultAttempt
      .upsert({ where: { keyHash }, create: { keyHash, failures, lockedUntil }, update: { failures, lockedUntil } })
      .catch((error) => console.error("[vault] attempt write failed", error));
    await logVaultEvent(lockedUntil ? "locked" : "failed");
    await new Promise((r) => setTimeout(r, 500));
    return lockedUntil
      ? { ok: false, error: `Vault locked after ${MAX_FAILURES} wrong attempts.`, lockedMinutes: LOCK_MINUTES }
      : { ok: false, error: `Wrong password — ${MAX_FAILURES - failures} attempt${MAX_FAILURES - failures === 1 ? "" : "s"} left.` };
  }

  await db.vaultAttempt.deleteMany({ where: { keyHash } }).catch(() => null);
  const token = await new SignJWT({ scope: "vault" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${VAULT_HOURS}h`)
    .sign(vaultKey);
  const store = await cookies();
  store.set(VAULT_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VAULT_HOURS * 3600,
  });
  await logVaultEvent("unlocked");
  return { ok: true };
}

export async function lockVault() {
  const store = await cookies();
  store.delete(VAULT_COOKIE);
  await logVaultEvent("locked-manual");
}
