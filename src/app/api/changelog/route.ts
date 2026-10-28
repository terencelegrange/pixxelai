import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/initDb";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initDb();

  const entries = await (prisma as any).changelog.findMany({
    orderBy: [
      { date: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
      date: true,
      description: true,
    },
  });

  const formatted = entries.map((e: any) => ({
    id: e.id,
    date: e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10),
    description: e.description,
  }));

  return NextResponse.json(formatted);
}
