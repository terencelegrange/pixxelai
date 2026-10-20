import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const standard = await prisma.standard.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
    },
  });

  if (!standard) {
    return NextResponse.json({ error: "Standard not found" }, { status: 404 });
  }

  return NextResponse.json({ standard });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, category, description, content } = body;

  const existing = await prisma.standard.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Standard not found" }, { status: 404 });
  }

  const updateData: any = {};
  if (title !== undefined) updateData.title = title.trim();
  if (category !== undefined) updateData.category = category.trim();
  if (description !== undefined) updateData.description = description?.trim() || null;
  if (content !== undefined) {
    updateData.content = content;
    updateData.item_count = (content.match(/^- \[[ x]\]/gm) || []).length || existing.item_count;
  }

  const updated = await prisma.standard.update({
    where: { id: existing.id },
    data: updateData,
  });

  await auditLog({
    userId: parseInt(session.sub, 10) || null,
    action: "STANDARD_UPDATED",
    resource: "standards",
    resourceId: existing.id,
    details: { title: updated.title, category: updated.category, slug: updated.slug },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, standard: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin role required to delete standards" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.standard.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Standard not found" }, { status: 404 });
  }

  if (existing.slug === "security") {
    return NextResponse.json({ error: "The core Security standard cannot be deleted." }, { status: 400 });
  }

  await prisma.standard.delete({
    where: { id: existing.id },
  });

  await auditLog({
    userId: parseInt(session.sub, 10) || null,
    action: "STANDARD_DELETED",
    resource: "standards",
    resourceId: existing.id,
    details: { title: existing.title, slug: existing.slug },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, message: "Standard deleted successfully" });
}
