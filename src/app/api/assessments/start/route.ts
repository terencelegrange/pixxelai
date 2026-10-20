import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runAssessment } from "@/lib/assessmentEngine";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { application_id, category = "Security" } = body;

    if (!application_id) {
      return NextResponse.json({ error: "application_id is required" }, { status: 400 });
    }

    const app = await prisma.application.findUnique({
      where: { id: application_id },
    });

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Check if an active assessment is already running for this application
    const active = await prisma.assessment.findFirst({
      where: {
        application_id,
        status: { in: ["queued", "cloning", "analyzing"] },
      },
    });

    if (active) {
      return NextResponse.json({
        ok: true,
        already_running: true,
        assessment_id: active.id,
        status: active.status,
        message: "An assessment is already actively running for this application.",
      });
    }

    // Create new assessment record
    const assessment = await prisma.assessment.create({
      data: {
        application_id,
        category,
        status: "queued",
        started_at: new Date(),
      },
    });

    // Fire background execution asynchronously without blocking the HTTP response
    runAssessment(assessment.id).catch((err) => {
      console.error(`[api/assessments/start] Background run error for ${assessment.id}:`, err);
    });

    return NextResponse.json({
      ok: true,
      assessment_id: assessment.id,
      status: "queued",
      application: {
        id: app.id,
        name: app.name,
      },
    });
  } catch (err: any) {
    console.error("[api/assessments/start] error:", err);
    return NextResponse.json({ error: err.message || "Failed to start assessment" }, { status: 500 });
  }
}
