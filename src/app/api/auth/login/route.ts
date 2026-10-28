import { NextRequest, NextResponse } from "next/server";
import { initDb, verifyPassword } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { signToken, createDeviceToken, COOKIE, THEME_COOKIE } from "@/lib/auth";
import { auditLog, getIp, getUserAgent, parseUserAgent } from "@/lib/audit";
import { isMfaEnabled } from "@/lib/mfa";

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  theme: string;
  name: string | null;
  avatar: number | null;
}

export async function POST(req: NextRequest) {
  await initDb();
  const { email, password, trustDevice } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await (prisma as any).user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password_hash: true,
      role: true,
      status: true,
      theme: true,
      name: true,
      avatar: true,
    },
  });
  const ua = getUserAgent(req);
  const parsed = parseUserAgent(ua);

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await auditLog({
      action: "LOGIN_FAILED",
      resource: "sessions",
      details: { email, method: "password", browser: parsed.browser, os: parsed.os, userAgent: ua },
      ip: getIp(req),
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.status === "pending") {
    return NextResponse.json({ error: "Your account is awaiting approval" }, { status: 403 });
  }
  if (user.status === "rejected") {
    return NextResponse.json({ error: "Your account has been rejected" }, { status: 403 });
  }

  // Check if MFA is active system-wide AND configured for this user
  const mfaActiveSystemWide = await isMfaEnabled();
  if (mfaActiveSystemWide) {
    const mfa = await (prisma as any).userMfa.findUnique({
      where: { user_id: user.id },
      select: { enabled: true },
    });
    if (mfa && mfa.enabled === 1) {
      // Issue short-lived challenge token for 2FA step
      const mfaToken = await signToken({
        sub: String(user.id),
        email: user.email,
        role: user.role,
        name: user.name,
        type: "mfa_pending",
      } as any);

      return NextResponse.json({
        ok: true,
        mfaRequired: true,
        mfaToken,
        user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      });
    }
  }

  // Standard password login
  const token = await signToken({ sub: String(user.id), email: user.email, role: user.role, name: user.name });

  await auditLog({
    userId: user.id,
    action: "LOGIN",
    resource: "sessions",
    details: { method: "password", browser: parsed.browser, os: parsed.os, userAgent: ua },
    ip: getIp(req),
  });

  const deviceToken = trustDevice ? await createDeviceToken(user.id) : undefined;
  if (deviceToken) {
    await auditLog({ userId: user.id, action: "DEVICE_TRUSTED", resource: "device_tokens", ip: getIp(req) });
  }

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role: user.role },
    ...(deviceToken ? { deviceToken } : {}),
  });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  res.cookies.set(THEME_COOKIE, user.theme || "dark", { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
