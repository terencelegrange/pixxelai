import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const totalUsers = await (prisma as any).user.count();
  const pendingUsers = await (prisma as any).user.count({ where: { status: "pending" } });
  const approvedUsers = await (prisma as any).user.count({ where: { status: "approved" } });
  const auditCount = await (prisma as any).auditLog.count();

  const recentUsers = await (prisma as any).user.findMany({
    orderBy: { created_at: "desc" },
    take: 5,
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      created_at: true,
    },
  });

  return NextResponse.json({
    totalUsers,
    pendingUsers,
    approvedUsers,
    auditCount,
    recentUsers,
  });
}
