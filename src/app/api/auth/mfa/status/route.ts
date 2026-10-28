import { NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  await initDb();
  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);
  const record = await (prisma as any).userMfa.findUnique({
    where: { user_id: userId },
    select: {
      enabled: true,
      backup_codes: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!record || record.enabled !== 1) {
    return NextResponse.json({
      enabled: false,
      backupCodesRemaining: 0,
      createdAt: null,
    });
  }

  let remaining = 0;
  try {
    if (record.backup_codes) {
      const parsed = JSON.parse(record.backup_codes);
      if (Array.isArray(parsed)) remaining = parsed.length;
    }
  } catch {}

  return NextResponse.json({
    enabled: true,
    backupCodesRemaining: remaining,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  });
}
