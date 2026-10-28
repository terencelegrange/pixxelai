import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { signToken, hashDeviceToken, COOKIE, THEME_COOKIE } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

interface DeviceLoginRow {
  device_id: number;
  id: number; email: string; role: string; status: string; theme: string;
  name: string | null; avatar: number | null;
}

// POST — silent login for a "trusted" device: exchanges a device token
// (issued at login time when the user checked "Trust this device") for a
// session, skipping the password step entirely.
export async function POST(req: NextRequest) {
  await initDb();
  const { email, token } = await req.json();

  if (!email || !token) {
    return NextResponse.json({ error: "Email and token required" }, { status: 400 });
  }

  const now = new Date();
  const tokenRecord = await (prisma as any).deviceToken.findFirst({
    where: {
      token_hash: hashDeviceToken(token),
      expires_at: { gt: now },
      user: { email },
    },
    include: {
      user: true,
    },
  });

  if (!tokenRecord || !tokenRecord.user) {
    return NextResponse.json({ error: "This device is no longer trusted — please sign in with your password" }, { status: 401 });
  }
  const user = tokenRecord.user;
  if (user.status !== "approved") {
    return NextResponse.json({ error: "Your account is not active" }, { status: 403 });
  }

  await (prisma as any).deviceToken.update({
    where: { id: tokenRecord.id },
    data: { last_used: new Date() },
  }).catch(() => {});

  const jwt = await signToken({ sub: String(user.id), email: user.email, role: user.role, name: user.name });
  await auditLog({ userId: user.id, action: "LOGIN", resource: "sessions", details: { method: "trusted_device" }, ip: getIp(req) });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
  });
  res.cookies.set(COOKIE, jwt, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  res.cookies.set(THEME_COOKIE, user.theme, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}

// DELETE — revokes a device token (the login screen's "forget" action).
export async function DELETE(req: NextRequest) {
  await initDb();
  const { email, token } = await req.json();

  if (!email || !token) {
    return NextResponse.json({ error: "Email and token required" }, { status: 400 });
  }

  const user = await (prisma as any).user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    await (prisma as any).deviceToken.deleteMany({
      where: {
        user_id: user.id,
        token_hash: hashDeviceToken(token),
      },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
