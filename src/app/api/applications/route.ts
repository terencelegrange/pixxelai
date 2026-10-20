import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const category = searchParams.get("category") || "all";
  const lifecycle = searchParams.get("lifecycle") || "all";
  const type = searchParams.get("type") || "all";

  const where: any = {};

  if (category !== "all") {
    where.category = category;
  }
  if (lifecycle !== "all") {
    where.lifecycle_status = lifecycle;
  }
  if (type !== "all") {
    where.type = type;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { short_code: { contains: search } },
      { description: { contains: search } },
      { vendor: { contains: search } },
      { repo_url: { contains: search } },
    ];
  }

  const [applications, totalCount, allCategories, allLifecycles, configuredCount] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { name: "asc" },
    }),
    prisma.application.count(),
    prisma.application.findMany({
      select: { category: true },
      distinct: ["category"],
    }),
    prisma.application.findMany({
      select: { lifecycle_status: true },
      distinct: ["lifecycle_status"],
    }),
    prisma.application.count({
      where: {
        OR: [
          { repo_url: { not: null } },
          { knowledge_base_url: { not: null } },
          { regulatory_sources: { not: null } },
        ],
      },
    }),
  ]);

  return NextResponse.json({
    applications,
    total: totalCount,
    configured_count: configuredCount,
    categories: allCategories.map((c) => c.category).filter(Boolean),
    lifecycles: allLifecycles.map((l) => l.lifecycle_status).filter(Boolean),
  });
}
