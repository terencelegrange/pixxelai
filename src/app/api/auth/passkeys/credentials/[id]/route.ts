import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDb();
  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);
  const { id } = await params;
  const body = await req.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await (prisma as any).passkeyCredential.updateMany({
    where: { id, user_id: userId },
    data: { name },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  await auditLog({
    userId,
    action: "PASSKEY_RENAMED",
    resource: "passkey_credentials",
    details: { credentialId: id, newName: name },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, name });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDb();
  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);
  const { id } = await params;

  // Check existing for audit
  const existing = await (prisma as any).passkeyCredential.findFirst({
    where: { id, user_id: userId },
    select: { name: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  await (prisma as any).passkeyCredential.deleteMany({
    where: { id, user_id: userId },
  });

  await auditLog({
    userId,
    action: "PASSKEY_DELETED",
    resource: "passkey_credentials",
    details: { credentialId: id, credentialName: existing[0].name },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
