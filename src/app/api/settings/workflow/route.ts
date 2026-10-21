import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/data/nav";
import { getEnabledStandards } from "@/lib/flags";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const includeDisabled = req.nextUrl.searchParams.get("includeDisabled") === "true";
  const enabledCategories = await getEnabledStandards();

  try {
    const [configs, standards, categories] = await Promise.all([
      prisma.workflowConfig.findMany({
        where: !includeDisabled ? { category: { in: enabledCategories } } : {},
        orderBy: { category: "asc" },
      }),
      prisma.standard.findMany({
        where: !includeDisabled ? { category: { in: enabledCategories } } : {},
        select: { id: true, title: true, category: true, slug: true },
        orderBy: { title: "asc" },
      }),
      prisma.standard.findMany({
        where: !includeDisabled ? { category: { in: enabledCategories } } : {},
        select: { category: true },
        distinct: ["category"],
      }),
    ]);

    const allCategories = includeDisabled
      ? Array.from(
          new Set(["Security", "Architecture", "Privacy", "Compliance", "Legal", "Quality", ...categories.map((c) => c.category)])
        )
      : enabledCategories;

    return NextResponse.json({
      configs,
      standards,
      categories: allCategories,
      available_roles: ROLES.map((r) => ({ key: r.key, label: r.label, description: r.description })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { configs } = body;

    if (!Array.isArray(configs)) {
      return NextResponse.json({ error: "configs array required" }, { status: 400 });
    }

    for (const item of configs) {
      if (!item.category) continue;

      const id = item.id || `wf-${item.category.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      await prisma.workflowConfig.upsert({
        where: { id },
        update: {
          assigned_role: item.assigned_role || "security",
          auto_create_tasks: item.auto_create_tasks !== undefined ? (item.auto_create_tasks ? 1 : 0) : 1,
        },
        create: {
          id,
          category: item.category,
          standard_id: item.standard_id || null,
          assigned_role: item.assigned_role || "security",
          auto_create_tasks: item.auto_create_tasks !== undefined ? (item.auto_create_tasks ? 1 : 0) : 1,
        },
      });
    }

    const updated = await prisma.workflowConfig.findMany();
    return NextResponse.json({ ok: true, configs: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
