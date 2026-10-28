import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/dashboard/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
    },
  },
}));

describe("Functional: Dashboard Metrics API Route (/api/dashboard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as any).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("should return user and audit metric counts for authenticated user", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", role: "admin" });

    ((prisma as any).user.count as any)
      .mockResolvedValueOnce(10) // totalUsers
      .mockResolvedValueOnce(2)  // pendingUsers
      .mockResolvedValueOnce(8); // approvedUsers
    ((prisma as any).auditLog.count as any).mockResolvedValueOnce(150);
    ((prisma as any).user.findMany as any).mockResolvedValueOnce([
      { id: 1, email: "user@pixxel.ai", name: "User", status: "approved", created_at: new Date() },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.totalUsers).toBe(10);
    expect(data.pendingUsers).toBe(2);
    expect(data.approvedUsers).toBe(8);
    expect(data.auditCount).toBe(150);
    expect(data.recentUsers).toHaveLength(1);
  });
});
