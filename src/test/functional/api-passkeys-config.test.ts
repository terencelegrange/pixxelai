import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/auth/passkeys/config/route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPasskeysEnabled, getRPConfig } from "@/lib/passkeys";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/passkeys", () => ({
  isPasskeysEnabled: vi.fn(),
  getRPConfig: vi.fn(),
}));

vi.mock("@/lib/initDb", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    passkeyCredential: {
      count: vi.fn(),
      findMany: vi.fn(),
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

describe("Functional: Passkeys Config API Route (/api/auth/passkeys/config)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET should return passkeys enabled state and relying party config", async () => {
    (isPasskeysEnabled as any).mockResolvedValue(true);
    (getRPConfig as any).mockReturnValue({ rpName: "PixxelAI", rpID: "pixxel.ai" });
    ((prisma as any).passkeyCredential.count as any).mockResolvedValue(5);
    ((prisma as any).passkeyCredential.findMany as any).mockResolvedValue([
      { user_id: 1 },
      { user_id: 2 },
      { user_id: 3 },
    ]);

    const req = new NextRequest("http://localhost:3000/api/auth/passkeys/config");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(true);
    expect(data.rpName).toBe("PixxelAI");
    expect(data.rpID).toBe("pixxel.ai");
    expect(data.stats.totalCredentials).toBe(5);
    expect(data.stats.totalUsersWithPasskeys).toBe(3);
  });

  it("PATCH should reject non-admin with 403", async () => {
    (getSession as any).mockResolvedValue({ sub: "2", role: "editor" });

    const req = new NextRequest("http://localhost:3000/api/auth/passkeys/config", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("PATCH should allow admin to toggle passkeys feature flag", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", role: "admin" });
    ((prisma as any).featureFlag.upsert as any).mockResolvedValue({ key: "passkeys", enabled: 1 });

    const req = new NextRequest("http://localhost:3000/api/auth/passkeys/config", {
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
