import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const application = await prisma.application.findFirst({
    where: {
      OR: [{ id }, { pixxel_asset_id: id }],
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({ application });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { repo_url, knowledge_base_url, regulatory_sources, description, notes } = body;

  const existing = await prisma.application.findFirst({
    where: {
      OR: [{ id }, { pixxel_asset_id: id }],
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const updateData: any = {};
  if (repo_url !== undefined) updateData.repo_url = repo_url ? repo_url.trim() : null;
  if (knowledge_base_url !== undefined) updateData.knowledge_base_url = knowledge_base_url ? knowledge_base_url.trim() : null;
  if (regulatory_sources !== undefined) updateData.regulatory_sources = regulatory_sources ? regulatory_sources.trim() : null;
  if (description !== undefined) updateData.description = description ? description.trim() : null;

  const updated = await prisma.application.update({
    where: { id: existing.id },
    data: updateData,
  });

  await auditLog({
    userId: parseInt(session.sub, 10) || null,
    action: "APPLICATION_CONFIG_UPDATED",
    resource: "applications",
    resourceId: existing.id,
    details: {
      application_name: existing.name,
      repo_url: updateData.repo_url,
      knowledge_base_url: updateData.knowledge_base_url,
      regulatory_sources: updateData.regulatory_sources,
    },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, application: updated });
}
