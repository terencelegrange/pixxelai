import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

interface UserRow {
  id: number; email: string; name: string | null;
  role: string; status: string; created_at: Date;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await (prisma as any).user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
  });

  const statusPriority: Record<string, number> = { pending: 1, approved: 2, rejected: 3 };
  users.sort((a: any, b: any) => {
    const prioA = statusPriority[a.status] ?? 99;
    const prioB = statusPriority[b.status] ?? 99;
    if (prioA !== prioB) return prioA - prioB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json(users);
}
