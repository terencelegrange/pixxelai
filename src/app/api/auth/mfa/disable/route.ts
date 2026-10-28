import { NextRequest, NextResponse } from "next/server";
import { initDb, verifyPassword } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp, getUserAgent, parseUserAgent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  await initDb();
  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);
  const body = await req.json();
  const password = body.password;

  if (!password) {
    return NextResponse.json({ error: "Password confirmation is required" }, { status: 400 });
  }

  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { id: true, password_hash: true },
  });
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  await (prisma as any).userMfa.deleteMany({
    where: { user_id: userId },
  });

  const ua = getUserAgent(req);
  const parsed = parseUserAgent(ua);

  await auditLog({
    userId,
    action: "MFA_DISABLED",
    resource: "user_mfa",
    details: { browser: parsed.browser, os: parsed.os },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
