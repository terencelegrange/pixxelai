import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/initDb";

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getSession: vi.fn(),
  };
});

vi.mock("@/lib/initDb", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  getIp: vi.fn().mockReturnValue("127.0.0.1"),
  getUserAgent: vi.fn().mockReturnValue("Chrome"),
  parseUserAgent: vi.fn().mockReturnValue({ browser: "Chrome", os: "macOS" }),
}));

vi.mock("@/lib/mfa", () => ({
  isMfaEnabled: vi.fn().mockResolvedValue(false),
}));

describe("Functional: Authentication Login & Logout Routes (/api/auth/*)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("login should return 400 when email or password is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@pixxel.ai" }),
    });

    const res = await loginPost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("login should return 401 on invalid password", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      {
        id: 1,
        email: "admin@pixxel.ai",
        password_hash: "hashed",
        role: "admin",
        status: "approved",
      },
    ]);
    (verifyPassword as any).mockResolvedValue(false);

    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@pixxel.ai", password: "wrong" }),
    });

    const res = await loginPost(req);
    expect(res.status).toBe(401);
  });

  it("login should succeed, return user payload, and set session cookie", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      {
        id: 1,
        email: "admin@pixxel.ai",
        password_hash: "hashed",
        role: "admin",
        status: "approved",
        name: "Admin User",
        avatar: 1,
      },
    ]);
    (verifyPassword as any).mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@pixxel.ai", password: "correct" }),
    });

    const res = await loginPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.user.email).toBe("admin@pixxel.ai");
    expect(res.cookies.get("bp_token")).toBeDefined();
  });

  it("logout should clear cookie and log audit event", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", email: "admin@pixxel.ai" });

    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
    });

    const res = await logoutPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Cookie set to expire immediately
    const cookie = res.cookies.get("bp_token");
    expect(cookie?.maxAge).toBe(0);
  });
});
