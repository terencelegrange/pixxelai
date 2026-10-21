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

    const enriched = active.map((item) => {
      let approx_percent = 15;
      if (item.status === "cloning") approx_percent = 45;
      else if (item.status === "analyzing") approx_percent = 80;

      const startTime = item.started_at
        ? new Date(item.started_at).getTime()
        : new Date(item.created_at).getTime();
      const elapsed_seconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));

      return {
        ...item,
        approx_percent,
        elapsed_seconds,
      };
    });

    return NextResponse.json({
      active: enriched,
      count: enriched.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
