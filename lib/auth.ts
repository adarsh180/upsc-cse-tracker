import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "upsc-session";

/**
 * Session signing key.
 * Set AUTH_SECRET on Vercel (any long random string, e.g. `openssl rand -base64 48`).
 * Falls back to AUTH_PASSWORD only so existing deployments keep working —
 * there is intentionally NO hardcoded fallback.
 */
const rawSecret = process.env.AUTH_SECRET ?? process.env.AUTH_PASSWORD;

if (!rawSecret) {
  throw new Error(
    "AUTH_SECRET (or AUTH_PASSWORD) must be set. Refusing to start with no session secret.",
  );
}

const secret = new TextEncoder().encode(rawSecret);

type SessionPayload = {
  email: string;
};

export async function createSession(email: string) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify<SessionPayload>(token, secret);
    return verified.payload;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}
