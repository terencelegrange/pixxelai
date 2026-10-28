import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/feature-flags/route";
import { PATCH } from "@/app/api/feature-flags/[key]/route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    featureFlag: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/initDb", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  getIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

describe("Functional: Feature Flags API (/api/feature-flags)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET should return dictionary of flags partitioned into system and standards categories", async () => {
    ((prisma as any).featureFlag.findMany as any).mockResolvedValue([
      { key: "signup", enabled: 1, label: "Sign Up", description: "Allow registration", category: "system" },
      { key: "standards_security", enabled: 1, label: "Security Standards", description: "Enables security rules", category: "standards" },
      { key: "standards_privacy", enabled: 0, label: "Privacy Standards", description: "Enables privacy rules", category: "standards" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.signup).toBeDefined();
    expect(data.signup.enabled).toBe(true);
    expect(data.signup.category).toBe("system");

    expect(data.standards_security.enabled).toBe(true);
    expect(data.standards_security.category).toBe("standards");

    expect(data.standards_privacy.enabled).toBe(false);
    expect(data.standards_privacy.category).toBe("standards");
  });

  it("PATCH should reject unauthenticated requests with 401", async () => {
    (getSession as any).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/feature-flags/signup", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(401);
  });

  it("PATCH should reject non-admin users with 403", async () => {
    (getSession as any).mockResolvedValue({ sub: "5", role: "developer" });

    const req = new NextRequest("http://localhost:3000/api/feature-flags/signup", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(403);
  });

  it("PATCH should toggle flag when called by admin and return ok", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", role: "admin" });
    ((prisma as any).featureFlag.update as any).mockResolvedValue({ key: "standards_privacy", enabled: 1 });

    const req = new NextRequest("http://localhost:3000/api/feature-flags/standards_privacy", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ key: "standards_privacy" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.key).toBe("standards_privacy");
    expect(data.enabled).toBe(true);
  });
});
