import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const totalUsers = await (prisma as any).user.count();
  const pendingUsers = await (prisma as any).user.count({ where: { status: "pending" } });
  const auditEvents = await (prisma as any).auditLog.count();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newUsers = await (prisma as any).user.findMany({
    where: {
      OR: [
        { status: "pending" },
        { created_at: { gte: sevenDaysAgo } },
      ],
    },
    orderBy: { created_at: "desc" },
    take: 5,
    select: { id: true, email: true, name: true, status: true, created_at: true },
  });

  const auditLogs = await (prisma as any).auditLog.findMany({
    orderBy: { created_at: "desc" },
    take: 8,
    select: {
      id: true,
      action: true,
      created_at: true,
      user: {
        select: { email: true },
      },
    },
  });

  const recentAudit = auditLogs.map((al: any) => ({
    id: al.id,
    action: al.action,
    created_at: al.created_at,
    user_email: al.user?.email ?? null,
  }));

  return NextResponse.json({
    totalUsers,
    pendingUsers,
    auditEvents,
    newUsers,
    recentAudit,
  });
}
