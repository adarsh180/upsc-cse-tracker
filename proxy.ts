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

// Private dashboards (AI-ML vault, personal hub) have their own tokens, signed
// with keys derived from the same secret (see lib/vault/auth.ts) — an app
// session alone never opens them.
const gateKeys = new Map<string, Promise<Uint8Array>>();
function gateKey(scope: string) {
  let key = gateKeys.get(scope);
  if (!key) {
    key = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(`${scope}-scope:${rawSecret}`))
      .then((buf) => new TextEncoder().encode(Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")));
    gateKeys.set(scope, key);
  }
  return key;
}
const GATES = [
  { scope: "vault", cookie: "upsc-vault" },
  { scope: "hub", cookie: "upsc-hub" },
];

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

  for (const gate of GATES) {
    const base = `/${gate.scope}`;
    if ((pathname === base || pathname.startsWith(`${base}/`)) && pathname !== `${base}/unlock`) {
      const gateToken = request.cookies.get(gate.cookie)?.value;
      try {
        if (!gateToken) throw new Error("no gate session");
        const { payload } = await jwtVerify(gateToken, await gateKey(gate.scope));
        if (payload.scope !== gate.scope) throw new Error("wrong scope");
      } catch {
        return NextResponse.redirect(new URL(`${base}/unlock`, request.url));
      }
    }
  }
  return NextResponse.next();
}
