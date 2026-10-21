import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/changelog/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/initDb", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe("Functional: Changelog API Route (/api/changelog)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET should reject unauthenticated requests with 401", async () => {
    (getSession as any).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET should return formatted changelog entries ordered by date desc", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", role: "viewer" });
    (prisma.$queryRaw as any).mockResolvedValue([
      { id: 2, date: "2026-10-22", description: "Concentric rings chart" },
      { id: 1, date: "2026-10-21", description: "Compliance reporting hub" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveLength(2);
    expect(data[0].date).toBe("2026-10-22");
    expect(data[0].description).toBe("Concentric rings chart");
  });
});
