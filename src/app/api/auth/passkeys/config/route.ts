import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";

export async function GET(req: NextRequest) {
  await initDb();
  const enabled = await isPasskeysEnabled();
  const { rpName, rpID } = getRPConfig(req);

  // Also query count of credentials and registered users for admin telemetry
  const totalCredentials = await (prisma as any).passkeyCredential.count().catch(() => 0);
  const distinctUsers = await (prisma as any).passkeyCredential.findMany({
    distinct: ["user_id"],
    select: { user_id: true },
  }).catch(() => []);

  return NextResponse.json({
    enabled,
    rpName,
    rpID,
    stats: {
      totalCredentials: Number(totalCredentials),
      totalUsersWithPasskeys: distinctUsers.length,
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
    where: { key: "passkeys" },
    update: { enabled },
    create: {
      key: "passkeys",
      enabled,
      label: "Passkeys (FIDO2/WebAuthn)",
      description: "Allow users to register and sign in with biometric passkeys and security keys",
      category: "system",
    },
  });

  await auditLog({
    userId: session.sub === "apikey" ? undefined : Number(session.sub),
    action: enabled ? "PASSKEYS_ENABLED" : "PASSKEYS_DISABLED",
    resource: "security_config",
    details: { enabled: !!enabled },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, enabled: !!enabled });
}
