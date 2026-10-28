import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key } = await params;
  const { enabled } = await req.json();
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  try {
    await (prisma as any).featureFlag.update({
      where: { key },
      data: { enabled: enabled ? 1 : 0 },
    });
  } catch {
    return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  }

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: "FEATURE_FLAG_UPDATED",
    resource: "feature_flags",
    resourceId: key,
    details: { enabled },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, key, enabled });
}
