import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("application_id") || undefined;
  const category = searchParams.get("category") || undefined;
  const status = searchParams.get("status") || undefined;

  const where: any = {};
  if (applicationId) where.application_id = applicationId;
  if (category && category !== "all") where.category = category;
  if (status && status !== "all") where.status = status;

  try {
    const [assessments, total] = await Promise.all([
      prisma.assessment.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              name: true,
              short_code: true,
              category: true,
              type: true,
              lifecycle_status: true,
              repo_url: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        take: 100,
      }),
      prisma.assessment.count({ where }),
    ]);

    return NextResponse.json({ assessments, total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await prisma.assessment.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
