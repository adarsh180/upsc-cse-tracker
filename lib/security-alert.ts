import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

import { db } from "@/lib/db";
import { sendWebPushNotification } from "@/lib/web-push";

/**
 * Security alerts and a database-backed brute-force limit for the sign-in
 * (an in-memory counter resets on every new serverless instance; this one
 * does not). Alerts land in the message panel and as a push on your devices.
 */

const KNOWN_COOKIE = "upsc-known-device";
const rawSecret = process.env.AUTH_SECRET ?? process.env.AUTH_PASSWORD ?? "";
const hash = (v: string) => createHash("sha256").update(`sec:${rawSecret}:${v}`).digest("hex");

export async function requestInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const ua = h.get("user-agent") ?? "";
  const device = /iphone|ipad/i.test(ua) ? "iPhone/iPad" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "Mac" : /linux/i.test(ua) ? "Linux" : "unknown device";
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome\//i.test(ua) ? "Chrome" : /firefox\//i.test(ua) ? "Firefox" : /safari\//i.test(ua) ? "Safari" : "a browser";
  const city = h.get("x-vercel-ip-city");
  const where = city ? `${decodeURIComponent(city)}${h.get("x-vercel-ip-country") ? `, ${h.get("x-vercel-ip-country")}` : ""}` : null;
  return { ip, label: `${browser} on ${device}${where ? ` near ${where}` : ""}` };
}

export async function securityAlert(title: string, body: string, tone: "urgent" | "care" | "focus" = "urgent") {
  try {
    const n = await db.appNotification.create({ data: { title, body, tone, senderLabel: "Security", senderClientId: null } });
    await sendWebPushNotification(n, null);
  } catch (error) {
    console.error("[security] alert failed", error);
  }
}

/** True the first time this browser passes a gate; marks it known for a year. */
export async function isNewDevice() {
  const store = await cookies();
  if (store.get(KNOWN_COOKIE)?.value) return false;
  store.set(KNOWN_COOKIE, randomBytes(16).toString("hex"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86400 });
  return true;
}

const MAX = 5;
const LOCK_MIN = 15;

/** Sign-in limit kept in the database: 5 wrong tries per network lock it for 15 minutes. */
export async function signInLimit(ip: string) {
  const keyHash = hash(`signin:${ip}`);
  const row = await db.vaultAttempt.findUnique({ where: { keyHash } }).catch(() => null);
  const now = new Date();
  return {
    locked: Boolean(row?.lockedUntil && row.lockedUntil > now),
    async fail() {
      const failures = (row?.lockedUntil && row.lockedUntil <= now ? 0 : row?.failures ?? 0) + 1;
      const lockedUntil = failures >= MAX ? new Date(now.getTime() + LOCK_MIN * 60000) : null;
      await db.vaultAttempt.upsert({ where: { keyHash }, create: { keyHash, failures, lockedUntil }, update: { failures, lockedUntil } }).catch(() => null);
      return Boolean(lockedUntil);
    },
    async clear() {
      await db.vaultAttempt.deleteMany({ where: { keyHash } }).catch(() => null);
    },
  };
}
