import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Fetch actively executing assessments
    const runningAssessments = await prisma.assessment.findMany({
      where: {
        status: { in: ["cloning", "analyzing"] },
      },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            short_code: true,
            category: true,
            repo_url: true,
          },
        },
      },
      orderBy: { started_at: "asc" },
    });

    // 2. Fetch queued assessments (FIFO order)
    const queuedAssessments = await prisma.assessment.findMany({
      where: {
        status: "queued",
      },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            short_code: true,
            category: true,
            repo_url: true,
          },
        },
      },
      orderBy: { created_at: "asc" },
    });

    // 3. Fetch recently completed or failed assessments for activity timeline
    const recentAssessments = await prisma.assessment.findMany({
      where: {
        status: { in: ["completed", "failed"] },
      },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            short_code: true,
          },
        },
      },
      orderBy: { completed_at: "desc" },
      take: 6,
    });

    // 4. Enrich running assessments with elapsed time and approximate progress
    const running = runningAssessments.map((item) => {
      let approx_percent = 45;
      let phase_label = "Cloning Repository...";

      if (item.status === "analyzing") {
        approx_percent = 80;
        phase_label = "AI Reviewing Standards & Code...";
      }

      const startTime = item.started_at
        ? new Date(item.started_at).getTime()
        : new Date(item.created_at).getTime();
      const elapsed_seconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));

      return {
        ...item,
        approx_percent,
        phase_label,
        elapsed_seconds,
      };
    });

    // 5. Enrich queued assessments with queue position and wait duration
    const queued = queuedAssessments.map((item, index) => {
      const wait_seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(item.created_at).getTime()) / 1000)
      );

      return {
        ...item,
        queue_position: index + 1,
        wait_seconds,
      };
    });

    // 6. Queue metrics
    const stats = {
      running_count: running.length,
      queued_count: queued.length,
      total_in_flight: running.length + queued.length,
      active_workers: running.length > 0 ? Math.min(running.length, 3) : 1,
      estimated_wait_seconds: queued.length * 35,
    };

    return NextResponse.json({
      stats,
      running,
      queued,
      recent: recentAssessments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role === "viewer") {
    return NextResponse.json({ error: "Forbidden: Reviewer or Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Assessment ID required" }, { status: 400 });
  }

  try {
    const existing = await prisma.assessment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (existing.status !== "queued") {
      return NextResponse.json(
        { error: "Only queued assessments can be cancelled before execution" },
        { status: 400 }
      );
    }

    await prisma.assessment.delete({
      where: { id },
    });

    await auditLog({
      userId: parseInt(session.sub, 10),
      action: "ASSESSMENT_CANCELLED",
      resource: "assessments",
      resourceId: id,
      ip: getIp(req),
    });

    return NextResponse.json({ ok: true, success: true, cancelled_id: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
