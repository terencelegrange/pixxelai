import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/setup",
  "/api/setup",
  "/api/health",
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/device",
  "/avatars",
];

async function verifyEdgeToken(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // If JWT_SECRET is not in env (e.g. auto-generated on disk in Node runtime),
    // we cannot verify the cryptographic signature in Edge runtime without the key.
    // Check basic JWT structure and unexpired payload; full auth is enforced by Node server-side routes.
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return false;
      const claims = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return typeof claims.exp === "number" && claims.exp >= Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  }

  try {
    const key = new TextEncoder().encode(secret);
    await jwtVerify(token, key);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("pixxelai_token")?.value ?? req.cookies.get("bp_token")?.value;
  if (!token || !(await verifyEdgeToken(token))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)"],
};
