import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { DEFAULT_ROLE_PERMISSIONS } from "@/data/nav";

/** Returns the nav keys the current user is allowed to see based on their role */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.role;

  // "admin" always gets all permissions regardless of DB (safety net)
  if (role === "admin") {
    const rows = await (prisma as any).rolePermission.findMany({
      where: { role: "admin" },
      select: { nav_key: true },
    });
    const keys = rows.length > 0 ? rows.map((r: any) => r.nav_key) : DEFAULT_ROLE_PERMISSIONS.admin;
    return NextResponse.json({ role, navKeys: keys });
  }

  // Map legacy "user" role to "viewer"
  const effectiveRole = role === "user" ? "viewer" : role;

  const rows = await (prisma as any).rolePermission.findMany({
    where: { role: effectiveRole },
    select: { nav_key: true },
  });

  const keys = rows.length > 0
    ? rows.map((r: any) => r.nav_key)
    : DEFAULT_ROLE_PERMISSIONS[effectiveRole] ?? ["dashboard"];

  return NextResponse.json({ role: effectiveRole, navKeys: keys });
}
