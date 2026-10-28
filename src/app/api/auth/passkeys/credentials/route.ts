import { NextRequest, NextResponse } from "next/server";
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
  const rows = await (prisma as any).passkeyCredential.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      name: true,
      device_type: true,
      backed_up: true,
      transports: true,
      created_at: true,
      last_used: true,
    },
  });

  return NextResponse.json({
    credentials: rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      deviceType: r.device_type,
      backedUp: r.backed_up === 1,
      transports: r.transports ? JSON.parse(r.transports) : [],
      createdAt: r.created_at,
      lastUsed: r.last_used,
    })),
  });
}
