import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { ROLES } from "@/data/nav";

/** GET — returns full permissions matrix: { viewer: ["dashboard"], editor: [...], admin: [...] } */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await (prisma as any).rolePermission.findMany({
    orderBy: [
      { role: "asc" },
      { nav_key: "asc" },
    ],
    select: { role: true, nav_key: true },
  });

  const result: Record<string, string[]> = {};
  for (const { key } of ROLES) result[key] = [];
  for (const { role, nav_key } of rows) {
    if (!result[role]) result[role] = [];
    result[role].push(nav_key);
  }

  return NextResponse.json(result);
}

/** PUT — replace all permissions for all roles */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const permissions: Record<string, string[]> = await req.json();

  // Delete all existing and re-insert
  await (prisma as any).rolePermission.deleteMany();
  for (const [role, keys] of Object.entries(permissions)) {
    if (Array.isArray(keys)) {
      for (const nav_key of keys) {
        await (prisma as any).rolePermission.create({
          data: { role, nav_key },
        });
      }
    }
  }

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: "RBAC_UPDATED",
    resource: "role_permissions",
    details: permissions,
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
