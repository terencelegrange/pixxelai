import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { isMfaEnabled } from "@/lib/mfa";

export async function GET() {
  await initDb();
  const enabled = await isMfaEnabled();

  const totalEnrolled = await (prisma as any).userMfa.count({
    where: { enabled: 1 },
  }).catch(() => 0);

  return NextResponse.json({
    enabled,
    stats: {
      totalEnrolledUsers: Number(totalEnrolled),
    },
  });
}

export async function PATCH(req: NextRequest) {
  await initDb();
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const enabled = body.enabled ? 1 : 0;

  await (prisma as any).featureFlag.upsert({
    where: { key: "mfa" },
    update: { enabled },
    create: {
      key: "mfa",
      enabled,
      label: "Multi-Factor Authentication (MFA)",
      description: "Allow users to configure and sign in with TOTP Authenticator Apps",
      category: "system",
    },
  });

  await auditLog({
    userId: session.sub === "apikey" ? undefined : Number(session.sub),
    action: enabled ? "MFA_ENABLED_SYSTEM" : "MFA_DISABLED_SYSTEM",
    resource: "security_config",
    details: { enabled: !!enabled },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, enabled: !!enabled });
}
