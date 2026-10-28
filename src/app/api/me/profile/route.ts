import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, signToken, COOKIE } from "@/lib/auth";
import { verifyPassword, hashPassword } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.sub, 10);
  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatar: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.sub, 10);
  const { name, email, currentPassword, newPassword, avatar } = await req.json();

  // If changing password, verify current one first
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 400 });
    }
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { password_hash: true },
    });
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
  }

  // Build update
  const data: Record<string, unknown> = {};

  if (name !== undefined) { data.name = name || null; }
  if (email) { data.email = email; }
  if (newPassword) {
    data.password_hash = await hashPassword(newPassword);
  }

  if (avatar !== undefined && Number.isInteger(avatar) && avatar >= 1 && avatar <= 127) {
    data.avatar = avatar;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  data.updated_at = new Date();

  const u = await (prisma as any).user.update({
    where: { id: userId },
    data,
    select: { email: true, role: true, name: true },
  });

  await auditLog({ userId, action: "USER_UPDATED", resource: "users", resourceId: String(userId), ip: getIp(req) });

  const token = await signToken({ sub: String(userId), email: u.email, role: u.role, name: u.name });

  const res = NextResponse.json({ ok: true, name: u.name, email: u.email });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}
