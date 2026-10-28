import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

interface AuditRow {
  id: number; action: string; resource: string; resource_id: string | null;
  details: string | null; ip: string | null; created_at: Date;
  user_email: string | null; user_name: string | null;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const offset = (page - 1) * limit;
  const action = searchParams.get("action") ?? "";

  const where = action ? { action } : {};

  const auditLogs = await (prisma as any).auditLog.findMany({
    where,
    orderBy: { created_at: "desc" },
    skip: offset,
    take: limit,
    select: {
      id: true,
      action: true,
      resource: true,
      resource_id: true,
      details: true,
      ip: true,
      created_at: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  const rows = auditLogs.map((a: any) => ({
    id: a.id,
    action: a.action,
    resource: a.resource,
    resource_id: a.resource_id,
    details: a.details,
    ip: a.ip,
    created_at: a.created_at,
    user_email: a.user?.email ?? null,
    user_name: a.user?.name ?? null,
  }));

  const total = await (prisma as any).auditLog.count({ where });

  return NextResponse.json({ rows, total, page, limit });
}
