import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/standards/route";
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
    standard: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  getIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

describe("Functional: Standards API Route (/api/standards)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET should reject unauthenticated requests with 401", async () => {
    (getSession as any).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/standards");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("GET should filter standards to only enabled categories by default", async () => {
    (getSession as any).mockResolvedValue({
      sub: "1",
      email: "viewer@pixxel.ai",
      role: "viewer",
    });
    (getEnabledStandards as any).mockResolvedValue(["Security", "Architecture"]);

    (prisma.standard.findMany as any)
      .mockResolvedValueOnce([
        { id: "std-1", category: "Security", title: "Auth standard" },
      ])
      .mockResolvedValueOnce([{ category: "Security" }]);

    const req = new NextRequest("http://localhost:3000/api/standards");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.standards).toHaveLength(1);
    expect(data.enabled_categories).toEqual(["Security", "Architecture"]);
    expect(prisma.standard.findMany).toHaveBeenCalledWith({
      where: { category: { in: ["Security", "Architecture"] } },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });
  });

  it("POST should reject non-editor / non-admin users with 403", async () => {
    (getSession as any).mockResolvedValue({
      sub: "2",
      email: "viewer@pixxel.ai",
      role: "viewer",
    });

    const req = new NextRequest("http://localhost:3000/api/standards", {
      method: "POST",
      body: JSON.stringify({ title: "New Standard" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("POST should create a standard when called by admin", async () => {
    (getSession as any).mockResolvedValue({
      sub: "1",
      email: "admin@pixxel.ai",
      role: "admin",
    });

    (prisma.standard.findUnique as any).mockResolvedValue(null);
    (prisma.standard.create as any).mockResolvedValue({
      id: "std-new",
      title: "API Rate Limiting",
      slug: "api-rate-limiting",
      category: "Architecture",
      source: "custom",
      item_count: 3,
    });

    const req = new NextRequest("http://localhost:3000/api/standards", {
      method: "POST",
      body: JSON.stringify({
        title: "API Rate Limiting",
        category: "Architecture",
        description: "Rate limiting policies",
        content: "## Rules\n1. 100 req/min\n2. 500 req/min burst",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.standard.title).toBe("API Rate Limiting");
    expect(prisma.standard.create).toHaveBeenCalled();
  });
});
