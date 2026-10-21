import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/data/nav";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [configs, standards, categories] = await Promise.all([
      prisma.workflowConfig.findMany({
        orderBy: { category: "asc" },
      }),
      prisma.standard.findMany({
        select: { id: true, title: true, category: true, slug: true },
        orderBy: { title: "asc" },
      }),
      prisma.standard.findMany({
        select: { category: true },
        distinct: ["category"],
      }),
    ]);

    // Ensure baseline categories exist in workflow_configs
    const existingCategories = new Set(configs.map((c) => c.category));
    const allCategories = Array.from(
      new Set(["Security", "Architecture", "Privacy", "Compliance", ...categories.map((c) => c.category)])
    );

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
