import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/me/theme/route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  THEME_COOKIE: "bp_theme",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: vi.fn(),
  },
}));

describe("Functional: User Theme API Route (/api/me/theme)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH should reject unauthenticated requests with 401", async () => {
    (getSession as any).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/me/theme", {
      method: "PATCH",
      body: JSON.stringify({ theme: "light" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("PATCH should reject invalid theme values with 400", async () => {
    (getSession as any).mockResolvedValue({ sub: "1" });

    const req = new NextRequest("http://localhost:3000/api/me/theme", {
      method: "PATCH",
      body: JSON.stringify({ theme: "neon-blue" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid theme");
  });

  it("PATCH should update theme in database and return theme cookie", async () => {
    (getSession as any).mockResolvedValue({ sub: "42" });
    (prisma.$executeRaw as any).mockResolvedValue(1);

    const req = new NextRequest("http://localhost:3000/api/me/theme", {
      method: "PATCH",
      body: JSON.stringify({ theme: "dark" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const cookie = res.cookies.get("bp_theme");
    expect(cookie?.value).toBe("dark");
  });
});
