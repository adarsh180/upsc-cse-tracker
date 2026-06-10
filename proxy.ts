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
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
}
