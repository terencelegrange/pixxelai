import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { initDb } from "@/lib/initDb";
import { createHash, randomBytes } from "crypto";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await initDb();

  const keys = await (prisma as any).apiKey.findMany({
    include: {
      user: { select: { email: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(
    keys.map((k: any) => ({
      id: k.id,
      prefix: k.prefix,
      name: k.name,
      contact: k.contact,
      expires_at: k.expires_at,
      created_at: k.created_at,
      last_used: k.last_used,
      active: k.active === 1,
      created_by_email: k.user?.email ?? null,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await initDb();

  const { name, contact, expiresAt } = await req.json();
  if (!name?.trim() || !contact?.trim()) {
    return NextResponse.json({ error: "Name and contact are required" }, { status: 400 });
  }

  // Generate key: bp_<32 hex chars>
  const rawKey = "bp_" + randomBytes(16).toString("hex");
  const prefix = rawKey.slice(0, 12);
  const keyHash = hashKey(rawKey);
  const userId = parseInt(session.sub, 10);
  const expires = expiresAt ? new Date(expiresAt) : null;

  const inserted = await (prisma as any).apiKey.create({
    data: {
      key_hash: keyHash,
      prefix,
      name: name.trim(),
      contact: contact.trim(),
      expires_at: expires,
      created_by: userId,
      created_at: new Date(),
    },
  });

  await auditLog({
    userId,
    action: "API_KEY_CREATED",
    resource: "api_keys",
    resourceId: String(inserted.id),
    details: { name: name.trim(), contact: contact.trim() },
    ip: getIp(req),
  });

  // Return the raw key ONCE — never stored in plaintext
  return NextResponse.json({ ok: true, id: inserted.id, key: rawKey, prefix });
}
