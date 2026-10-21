import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEnabledStandards } from "@/lib/flags";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const requestedAppId = searchParams.get("appId");

    // Fetch all applications
    const apps = await prisma.application.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        short_code: true,
        description: true,
        repo_url: true,
        lifecycle_status: true,
        created_at: true,
      },
    });

    if (apps.length === 0) {
      return NextResponse.json({
        applications: [],
        selected_application: null,
        compliance_summary: null,
        areas: [],
        history: [],
        latest_controls: [],
        all_assessments: [],
      });
    }

    // Determine selected app:
    // If appId passed, use it. Otherwise, look for an app with completed assessments, or fallback to first.
    let selectedAppId = requestedAppId;
    if (!selectedAppId) {
      const recentCompleted = await prisma.assessment.findFirst({
        where: { status: "completed", compliance_score: { not: null } },
        orderBy: { completed_at: "desc" },
        select: { application_id: true },
      });
      selectedAppId = recentCompleted ? recentCompleted.application_id : apps[0].id;
    }

    const selectedApp = apps.find((a) => a.id === selectedAppId) || apps[0];

    // Fetch enabled categories from feature flags
    const enabledCategories = await getEnabledStandards();
    const enabledSet = new Set(enabledCategories.map((c) => c.toLowerCase()));

    // Fetch assessments for this selected app
    const assessments = await prisma.assessment.findMany({
      where: {
        application_id: selectedApp.id,
      },
      orderBy: { created_at: "desc" },
      include: {
        items: true,
      },
    });

    // Filter to completed assessments for trend history
    const completedAssessments = assessments
      .filter((a) => a.status === "completed" && a.compliance_score !== null)
      .sort((a, b) => {
        const timeA = a.completed_at ? new Date(a.completed_at).getTime() : new Date(a.created_at).getTime();
        const timeB = b.completed_at ? new Date(b.completed_at).getTime() : new Date(b.created_at).getTime();
        return timeA - timeB; // Chronological ascending for chart
      });

    // Fetch review tasks for this app
    const tasks = await prisma.reviewTask.findMany({
      where: { application_id: selectedApp.id },
      select: { id: true, assessment_item_id: true, status: true, severity: true },
    });

    const openTasksCount = tasks.filter((t) => t.status !== "approved" && t.status !== "rejected").length;
    const completedTasksCount = tasks.filter((t) => t.status === "approved" || t.status === "rejected").length;

    // Latest completed assessment
    const latestCompleted = completedAssessments.length > 0
      ? completedAssessments[completedAssessments.length - 1]
      : null;

    const latestScore = latestCompleted?.compliance_score ?? null;
    const targetScore = 100;
    const gap = latestScore !== null ? Math.max(0, 100 - latestScore) : null;

    let trend: "improving" | "stable" | "declining" | "initial" | "no_data" = "no_data";
    if (completedAssessments.length > 1) {
      const prev = completedAssessments[completedAssessments.length - 2].compliance_score ?? 0;
      const curr = latestScore ?? 0;
      if (curr > prev) trend = "improving";
      else if (curr < prev) trend = "declining";
      else trend = "stable";
    } else if (completedAssessments.length === 1) {
      trend = "initial";
    }

    // Build History Points for Chart
    const history = completedAssessments.map((a) => {
      const dateObj = a.completed_at ? new Date(a.completed_at) : new Date(a.created_at);
      return {
        id: a.id,
        timestamp: dateObj.toISOString(),
        formatted_date: dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        full_date: dateObj.toLocaleString("en-US"),
        score: Math.round(a.compliance_score ?? 0),
        category: a.category,
        items_count: a.items_count,
        meets_count: a.meets_count,
        partial_count: a.partial_count,
        fails_count: a.fails_count,
        na_count: a.na_count,
        llm_model: a.llm_model,
        status: a.status,
      };
    });

    // Governance Areas breakdown
    const areas = enabledCategories.map((cat) => {
      const isSecurity = cat.toLowerCase() === "security";
      const catAssessments = completedAssessments.filter(
        (a) => a.category.toLowerCase() === cat.toLowerCase()
      );
      const latestInCat = catAssessments.length > 0 ? catAssessments[catAssessments.length - 1] : null;

      return {
        category: cat,
        score: latestInCat ? Math.round(latestInCat.compliance_score ?? 0) : null,
        status: isSecurity ? "active" : "planned",
        controls_count: latestInCat?.items_count ?? 0,
        meets_count: latestInCat?.meets_count ?? 0,
        partial_count: latestInCat?.partial_count ?? 0,
        fails_count: latestInCat?.fails_count ?? 0,
        last_assessed_at: latestInCat?.completed_at || latestInCat?.created_at || null,
      };
    });

    // Latest Controls with task links
    const taskMap = new Map<string, string>();
    tasks.forEach((t) => taskMap.set(t.assessment_item_id, t.status));

    const latestControls = latestCompleted
      ? latestCompleted.items.map((item) => ({
          id: item.id,
          standard_id: item.standard_id,
          title: item.title,
          category: item.category,
          result: item.result,
          severity: item.severity,
          evidence: item.evidence,
          recommendation: item.recommendation,
          task_status: taskMap.get(item.id) || null,
        }))
      : [];

    // All assessments list for table
    const allAssessments = assessments.map((a) => ({
      id: a.id,
      category: a.category,
      status: a.status,
      compliance_score: a.compliance_score,
      items_count: a.items_count,
      meets_count: a.meets_count,
      partial_count: a.partial_count,
      fails_count: a.fails_count,
      llm_provider: a.llm_provider,
      llm_model: a.llm_model,
      created_at: a.created_at,
      completed_at: a.completed_at,
    }));

    // Enrich applications list with latest score & assessment count
    const appSummaries = await Promise.all(
      apps.map(async (app) => {
        const count = await prisma.assessment.count({
          where: { application_id: app.id },
        });
        const latest = await prisma.assessment.findFirst({
          where: { application_id: app.id, status: "completed", compliance_score: { not: null } },
          orderBy: { completed_at: "desc" },
          select: { compliance_score: true, completed_at: true },
        });

        return {
          id: app.id,
          name: app.name,
          short_code: app.short_code,
          assessments_count: count,
          latest_score: latest?.compliance_score ?? null,
          last_assessed_at: latest?.completed_at ?? null,
        };
      })
    );

    return NextResponse.json({
      applications: appSummaries,
      selected_application: selectedApp,
      compliance_summary: {
        latest_score: latestScore !== null ? Math.round(latestScore) : null,
        target_score: targetScore,
        gap,
        trend,
        total_controls: latestCompleted?.items_count ?? 0,
        meets_count: latestCompleted?.meets_count ?? 0,
        partial_count: latestCompleted?.partial_count ?? 0,
        fails_count: latestCompleted?.fails_count ?? 0,
        na_count: latestCompleted?.na_count ?? 0,
        open_tasks_count: openTasksCount,
        completed_tasks_count: completedTasksCount,
        last_assessed_at: latestCompleted?.completed_at || latestCompleted?.created_at || null,
      },
      areas,
      history,
      latest_controls: latestControls,
      all_assessments: allAssessments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
