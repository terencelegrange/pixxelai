import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/settings/watermark/route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWatermarkConfig, generateWatermarkOverlayPayload } from "@/lib/watermark";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/watermark", () => ({
  getWatermarkConfig: vi.fn(),
  generateWatermarkOverlayPayload: vi.fn(),
}));

vi.mock("@/lib/initDb", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: vi.fn(),
    featureFlag: {
      upsert: vi.fn(),
    },
    watermarkConfig: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  getIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

describe("Functional: Watermark Settings API Route (/api/settings/watermark)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET should return watermark config and overlay payload for authenticated user", async () => {
    (getSession as any).mockResolvedValue({
      sub: "10",
      email: "security@pixxel.ai",
      name: "Security Lead",
      role: "security",
    });

    (getWatermarkConfig as any).mockResolvedValue({
      enabled: true,
      customText: "{{email}}",
      showQr: true,
      opacity: 8,
      fontSize: 12,
    });

    (generateWatermarkOverlayPayload as any).mockResolvedValue({
      enabled: true,
      text: "security@pixxel.ai",
      qrDataUrl: "data:image/png;base64,...",
      opacity: 8,
      fontSize: 12,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.config.enabled).toBe(true);
    expect(data.overlay.text).toBe("security@pixxel.ai");
  });

  it("PATCH should reject non-admin users with 403", async () => {
    (getSession as any).mockResolvedValue({ sub: "5", role: "developer" });

    const req = new NextRequest("http://localhost:3000/api/settings/watermark", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("PATCH should update watermark config and log audit event when called by admin", async () => {
    (getSession as any).mockResolvedValue({ sub: "1", role: "admin" });
    ((prisma as any).featureFlag.upsert as any).mockResolvedValue({});
    ((prisma as any).watermarkConfig.upsert as any).mockResolvedValue({});
    (getWatermarkConfig as any).mockResolvedValue({ enabled: true, customText: "CONFIDENTIAL" });

    const req = new NextRequest("http://localhost:3000/api/settings/watermark", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: true,
        customText: "{{email}} • INTERNAL ONLY",
        showQr: false,
        opacity: 12,
        fontSize: 14,
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect((prisma as any).watermarkConfig.upsert).toHaveBeenCalled();
  });
});
