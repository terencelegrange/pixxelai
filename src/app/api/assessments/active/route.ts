import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const active = await prisma.assessment.findMany({
      where: {
        status: { in: ["queued", "cloning", "analyzing"] },
      },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            short_code: true,
          },
        },
      },
      orderBy: { started_at: "desc" },
      take: 5,
    });

    return NextResponse.json({
      active,
      count: active.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
