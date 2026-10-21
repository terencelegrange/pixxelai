import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE } from "@/app/api/reporting/processing/route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn(),
  getIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    assessment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("Functional: Assessment Processing API Route (/api/reporting/processing)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when unauthenticated on GET", async () => {
    (getSession as any).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/reporting/processing");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("should return running, queued, recent assessments and stats on GET", async () => {
    (getSession as any).mockResolvedValue({ id: "user-1", email: "user@example.com", role: "editor" });

    // Mock running
    (prisma.assessment.findMany as any)
      .mockResolvedValueOnce([
        {
          id: "ass-1",
          status: "analyzing",
          category: "Security",
          started_at: new Date(Date.now() - 30000).toISOString(),
          created_at: new Date(Date.now() - 40000).toISOString(),
          application: { id: "app-1", name: "Alpha", short_code: "ALP" },
        },
      ])
      // Mock queued
      .mockResolvedValueOnce([
        {
          id: "ass-2",
          status: "queued",
          category: "Architecture",
          created_at: new Date(Date.now() - 10000).toISOString(),
          application: { id: "app-2", name: "Beta", short_code: "BET" },
        },
      ])
      // Mock recent
      .mockResolvedValueOnce([
        {
          id: "ass-3",
          status: "completed",
          category: "Compliance",
          compliance_score: 88,
          completed_at: new Date().toISOString(),
          application: { id: "app-3", name: "Gamma", short_code: "GAM" },
        },
      ]);

    const req = new NextRequest("http://localhost:3000/api/reporting/processing");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.stats.running_count).toBe(1);
    expect(data.stats.queued_count).toBe(1);
    expect(data.stats.total_in_flight).toBe(2);
    expect(data.running[0].phase_label).toBe("AI Reviewing Standards & Code...");
    expect(data.running[0].approx_percent).toBe(80);
    expect(data.queued[0].queue_position).toBe(1);
    expect(data.recent[0].status).toBe("completed");
  });

  it("should enforce RBAC on DELETE — reject viewer role", async () => {
    (getSession as any).mockResolvedValue({ id: "user-1", email: "viewer@example.com", role: "viewer" });

    const req = new NextRequest("http://localhost:3000/api/reporting/processing?id=ass-1", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Forbidden");
  });

  it("should prevent cancelling an already running assessment on DELETE", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", id: "user-1", email: "admin@example.com", role: "admin" });

    (prisma.assessment.findUnique as any).mockResolvedValue({
      id: "ass-run",
      status: "analyzing",
      application_id: "app-1",
    });

    const req = new NextRequest("http://localhost:3000/api/reporting/processing?id=ass-run", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Only queued assessments can be cancelled");
  });

  it("should successfully cancel and delete a queued assessment", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", id: "user-1", email: "admin@example.com", role: "admin" });

    (prisma.assessment.findUnique as any).mockResolvedValue({
      id: "ass-queued",
      status: "queued",
      application_id: "app-1",
      category: "Security",
    });

    (prisma.assessment.delete as any).mockResolvedValue({
      id: "ass-queued",
    });

    const req = new NextRequest("http://localhost:3000/api/reporting/processing?id=ass-queued", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(prisma.assessment.delete).toHaveBeenCalledWith({
      where: { id: "ass-queued" },
    });
  });
});
