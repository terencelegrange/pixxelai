import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/auth/mfa/config/route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMfaEnabled } from "@/lib/mfa";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/mfa", () => ({
  isMfaEnabled: vi.fn(),
}));

vi.mock("@/lib/initDb", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    userMfa: {
      count: vi.fn(),
    },
    featureFlag: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  getIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

describe("Functional: MFA Config API Route (/api/auth/mfa/config)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET should return system-wide MFA status and enrolled count", async () => {
    (isMfaEnabled as any).mockResolvedValue(true);
    ((prisma as any).userMfa.count as any).mockResolvedValue(12);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(true);
    expect(data.stats.totalEnrolledUsers).toBe(12);
  });

  it("PATCH should reject non-admin users with 403", async () => {
    (getSession as any).mockResolvedValue({ sub: "3", role: "developer" });

    const req = new NextRequest("http://localhost:3000/api/auth/mfa/config", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("PATCH should update MFA feature flag when executed by admin", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", role: "admin" });
    ((prisma as any).featureFlag.upsert as any).mockResolvedValue({ key: "mfa", enabled: 1 });

    const req = new NextRequest("http://localhost:3000/api/auth/mfa/config", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.enabled).toBe(true);
  });
});
