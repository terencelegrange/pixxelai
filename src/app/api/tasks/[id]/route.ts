import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const task = await prisma.reviewTask.findUnique({
      where: { id },
      include: {
        application: true,
        assessment: true,
        assessment_item: true,
        assigned_user: {
          select: { id: true, name: true, email: true, role: true },
        },
        activities: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const { action, status, resolution_notes, clarification_req, assigned_to_user_id, comment } = body;

    const existing = await prisma.reviewTask.findUnique({
      where: { id },
      include: { assessment_item: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    let targetStatus = status || existing.status;
    let actionName = action || "status_change";

    if (action === "approve") {
      targetStatus = "approved";
      actionName = "approved";
    } else if (action === "reject") {
      targetStatus = "rejected";
      actionName = "rejected";
    } else if (action === "seek_clarification") {
      targetStatus = "clarification_needed";
      actionName = "seek_clarification";
    } else if (action === "assign_developer") {
      targetStatus = "assigned_to_developer";
      actionName = "assigned_to_developer";
    }

    const updatedTask = await prisma.reviewTask.update({
      where: { id },
      data: {
        status: targetStatus,
        resolution_notes: resolution_notes !== undefined ? resolution_notes : existing.resolution_notes,
        clarification_req: clarification_req !== undefined ? clarification_req : existing.clarification_req,
        assigned_to_user_id: assigned_to_user_id !== undefined ? assigned_to_user_id : existing.assigned_to_user_id,
      },
      include: {
        application: true,
        assigned_user: { select: { id: true, name: true, email: true } },
      },
    });

    // Record activity audit trail
    const userId = parseInt(session.sub, 10) || null;
    await prisma.taskActivity.create({
      data: {
        task_id: id,
        user_id: userId,
        action: actionName,
        from_status: existing.status,
        to_status: targetStatus,
        comment: comment || resolution_notes || clarification_req || `Status changed from ${existing.status} to ${targetStatus}.`,
      },
    });

    return NextResponse.json({ ok: true, task: updatedTask });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
