import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = ["/", "/sign-in"];

const rawSecret = process.env.AUTH_SECRET ?? process.env.AUTH_PASSWORD;

if (!rawSecret) {
  throw new Error(
    "AUTH_SECRET (or AUTH_PASSWORD) must be set. Refusing to start with no session secret.",
  );
}

const secret = new TextEncoder().encode(rawSecret);

// The AI-ML vault has its own token, signed with a key derived from the same
// secret (see lib/vault/auth.ts) — an app session alone never opens it.
let vaultKeyPromise: Promise<Uint8Array> | null = null;
function vaultKey() {
  vaultKeyPromise ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`vault-scope:${rawSecret}`))
    .then((buf) => new TextEncoder().encode(Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")));
  return vaultKeyPromise;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("upsc-session")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  try {
    await jwtVerify(token, secret);
  } catch {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (pathname.startsWith("/vault") && pathname !== "/vault/unlock") {
    const vaultToken = request.cookies.get("upsc-vault")?.value;
    try {
      if (!vaultToken) throw new Error("no vault session");
      const { payload } = await jwtVerify(vaultToken, await vaultKey());
      if (payload.scope !== "vault") throw new Error("wrong scope");
    } catch {
      return NextResponse.redirect(new URL("/vault/unlock", request.url));
    }
  }
  return NextResponse.next();
}
