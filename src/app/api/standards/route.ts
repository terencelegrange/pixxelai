import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const where: any = {};
  if (category && category !== "all") {
    where.category = category;
  }

  const standards = await prisma.standard.findMany({
    where,
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });

  const categories = await prisma.standard.findMany({
    select: { category: true },
    distinct: ["category"],
  });

  return NextResponse.json({
    standards,
    categories: Array.from(new Set(categories.map((c) => c.category))).filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, category = "Security", slug, description, content } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const cleanSlug = (slug || title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const existing = await prisma.standard.findUnique({
    where: { slug: cleanSlug },
  });

  if (existing) {
    return NextResponse.json({ error: `A standard with slug '${cleanSlug}' already exists.` }, { status: 400 });
  }

  // Count checklist items or headers in markdown content
  const markdownText = content || `# ${title}\n\nStandard requirements and guidelines.\n`;
  const itemCount = (markdownText.match(/^- \[[ x]\]/gm) || []).length;

  const standard = await prisma.standard.create({
    data: {
      category: category.trim(),
      title: title.trim(),
      slug: cleanSlug,
      description: description?.trim() || null,
      content: markdownText,
      source: "custom",
      item_count: itemCount,
    },
  });

  await auditLog({
    userId: parseInt(session.sub, 10) || null,
    action: "STANDARD_CREATED",
    resource: "standards",
    resourceId: standard.id,
    details: { title: standard.title, category: standard.category, slug: standard.slug },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, standard }, { status: 201 });
}
