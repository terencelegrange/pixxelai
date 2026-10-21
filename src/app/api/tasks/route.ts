import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all";
  const applicationId = searchParams.get("application_id") || undefined;
  const category = searchParams.get("category") || undefined;
  const roleFilter = searchParams.get("role") || undefined;

  const where: any = {};

  const currentUserId = parseInt(session.sub, 10) || 0;
  const currentUserRole = session.role;

  // If not admin, restrict to tasks assigned to their role or directly assigned to their user ID
  if (currentUserRole !== "admin") {
    where.OR = [
      { assigned_role: currentUserRole },
      ...(currentUserId ? [{ assigned_to_user_id: currentUserId }] : []),
    ];
  } else if (roleFilter && roleFilter !== "all") {
    where.assigned_role = roleFilter;
  }

  if (status !== "all") {
    where.status = status;
  }
  if (applicationId) {
    where.application_id = applicationId;
  }
  if (category && category !== "all") {
    where.category = category;
  }

  try {
    const [tasks, total, statusCounts, users] = await Promise.all([
      prisma.reviewTask.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              name: true,
              short_code: true,
              category: true,
              type: true,
              repo_url: true,
            },
          },
          assessment_item: {
            select: {
              id: true,
              result: true,
              severity: true,
              evidence: true,
              recommendation: true,
            },
          },
          assigned_user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ created_at: "desc" }],
        take: 100,
      }),
      prisma.reviewTask.count({ where }),
      prisma.reviewTask.groupBy({
        by: ["status"],
        _count: { status: true },
        where: currentUserRole !== "admin" ? {
          OR: [
            { assigned_role: currentUserRole },
            ...(currentUserId ? [{ assigned_to_user_id: currentUserId }] : []),
          ],
        } : {},
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const counts: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      clarification_needed: 0,
      assigned_to_developer: 0,
    };
    for (const sc of statusCounts) {
      counts[sc.status] = sc._count.status;
    }

    return NextResponse.json({
      tasks,
      total,
      counts,
      users,
      user_role: currentUserRole,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
