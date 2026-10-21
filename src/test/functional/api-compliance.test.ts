import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/reports/compliance/route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEnabledStandards } from "@/lib/flags";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({
  getEnabledStandards: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    application: {
      findMany: vi.fn(),
    },
    assessment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    standard: {
      findMany: vi.fn(),
    },
    reviewTask: {
      findMany: vi.fn(),
    },
  },
}));

describe("Functional: Compliance Report API Route (/api/reports/compliance)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when user is not authenticated", async () => {
    (getSession as any).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/reports/compliance");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("should return empty arrays when no applications exist", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", role: "viewer" });
    (prisma.application.findMany as any).mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/reports/compliance");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applications).toEqual([]);
    expect(data.selected_application).toBeNull();
  });

  it("should compute overall compliance score, areas for concentric rings, and trend points", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", role: "viewer" });

    const mockApp = {
      id: "app-1",
      name: "RainyDay App",
      short_code: "RD",
      description: "Sample",
      repo_url: "https://github.com/org/repo",
      lifecycle_status: "Production",
      created_at: new Date(),
    };

    (prisma.application.findMany as any).mockResolvedValue([mockApp]);
    (prisma.assessment.findFirst as any).mockResolvedValue({ application_id: "app-1" });
    (getEnabledStandards as any).mockResolvedValue(["Security", "Architecture"]);

    const mockAssessment = {
      id: "ass-1",
      application_id: "app-1",
      category: "Security",
      status: "completed",
      compliance_score: 83.3,
      items_count: 6,
      meets_count: 5,
      partial_count: 0,
      fails_count: 1,
      na_count: 0,
      started_at: new Date("2026-10-20T10:00:00Z"),
      completed_at: new Date("2026-10-20T10:02:00Z"),
      items: [
        {
          id: "item-1",
          standard_id: "SEC-01",
          title: "JWT Authentication",
          category: "Security",
          result: "Meets",
          severity: "High",
          evidence: "Implemented in auth.ts",
          recommendation: null,
        },
      ],
    };

    (prisma.assessment.findMany as any).mockResolvedValue([mockAssessment]);
    (prisma.standard.findMany as any).mockResolvedValue([
      { category: "Security", item_count: 6 },
      { category: "Architecture", item_count: 5 },
    ]);
    (prisma.reviewTask.findMany as any).mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/reports/compliance?appId=app-1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.selected_application.id).toBe("app-1");
    expect(data.compliance_summary).not.toBeNull();
    expect(data.compliance_summary.latest_score).toBe(83);
    expect(data.compliance_summary.target_score).toBe(100);

    // Areas returned for the concentric rings graphic
    expect(data.areas.length).toBeGreaterThanOrEqual(1);
    const secArea = data.areas.find((a: any) => a.category.toLowerCase() === "security");
    expect(secArea).toBeDefined();
    expect(secArea.score).toBe(83);

    // History trend points
    expect(data.history).toHaveLength(1);
    expect(data.history[0].score).toBe(83);
  });
});
