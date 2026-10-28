import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWatermarkConfig, generateWatermarkOverlayPayload } from "@/lib/watermark";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    featureFlag: {
      findUnique: vi.fn(),
    },
    watermarkConfig: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Unit: Watermarking Config & Payload Generation (lib/watermark)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getWatermarkConfig should return disabled default config when no database row exists", async () => {
    ((prisma as any).featureFlag.findUnique as any).mockResolvedValue(null);
    ((prisma as any).watermarkConfig.findUnique as any).mockResolvedValue(null);

    const config = await getWatermarkConfig();
    expect(config.enabled).toBe(false);
    expect(config.opacity).toBe(7);
    expect(config.fontSize).toBe(12);
  });

  it("getWatermarkConfig should only be enabled if both feature flag and table row enabled are 1", async () => {
    // Flag enabled, but table config disabled
    ((prisma as any).featureFlag.findUnique as any).mockResolvedValueOnce({ enabled: 1 });
    ((prisma as any).watermarkConfig.findUnique as any).mockResolvedValueOnce({ enabled: 0, custom_text: "Test", show_qr: 1, opacity: 10, font_size: 14 });

    const config = await getWatermarkConfig();
    expect(config.enabled).toBe(false);

    // Both enabled
    ((prisma as any).featureFlag.findUnique as any).mockResolvedValueOnce({ enabled: 1 });
    ((prisma as any).watermarkConfig.findUnique as any).mockResolvedValueOnce({ enabled: 1, custom_text: "Confidential", show_qr: 1, opacity: 10, font_size: 14 });

    const activeConfig = await getWatermarkConfig();
    expect(activeConfig.enabled).toBe(true);
    expect(activeConfig.customText).toBe("Confidential");
  });

  it("generateWatermarkOverlayPayload should interpolate user variables into customText template", async () => {
    ((prisma as any).featureFlag.findUnique as any).mockResolvedValueOnce({ enabled: 1 });
    ((prisma as any).watermarkConfig.findUnique as any).mockResolvedValueOnce({
      enabled: 1,
      custom_text: "{{email}} | UID: {{id}} | User: {{name}} | {{date}}",
      show_qr: 1,
      opacity: 10,
      font_size: 14,
    });

    const payload = await generateWatermarkOverlayPayload({
      id: 42,
      email: "security@pixxel.ai",
      name: "Security Lead",
    });

    expect(payload.enabled).toBe(true);
    expect(payload.text).toContain("security@pixxel.ai");
    expect(payload.text).toContain("UID: 42");
    expect(payload.text).toContain("User: Security Lead");
    expect(payload.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(payload.opacity).toBe(10);
    expect(payload.fontSize).toBe(14);
  });
});
