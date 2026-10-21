import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isFlagEnabled,
  isStandardEnabled,
  getEnabledStandards,
  ALL_STANDARD_CATEGORIES,
  STANDARDS_FLAG_KEYS,
} from "@/lib/flags";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    featureFlag: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("Unit: Feature Flags & Standards Categories (lib/flags)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ALL_STANDARD_CATEGORIES should include core governance categories", () => {
    expect(ALL_STANDARD_CATEGORIES).toContain("Security");
    expect(ALL_STANDARD_CATEGORIES).toContain("Architecture");
    expect(ALL_STANDARD_CATEGORIES).toContain("Privacy");
    expect(ALL_STANDARD_CATEGORIES).toContain("Compliance");
    expect(ALL_STANDARD_CATEGORIES).toContain("Legal");
    expect(ALL_STANDARD_CATEGORIES).toContain("Quality");
  });

  it("STANDARDS_FLAG_KEYS should map categories to flags", () => {
    expect(STANDARDS_FLAG_KEYS.security).toBe("standards_security");
    expect(STANDARDS_FLAG_KEYS.architecture).toBe("standards_architecture");
    expect(STANDARDS_FLAG_KEYS.privacy).toBe("standards_privacy");
  });

  it("isFlagEnabled should return true when flag enabled is 1", async () => {
    (prisma.featureFlag.findFirst as any).mockResolvedValue({ enabled: 1 });

    const result = await isFlagEnabled("standards_security");
    expect(result).toBe(true);
  });

  it("isFlagEnabled should return false when flag enabled is 0", async () => {
    (prisma.featureFlag.findFirst as any).mockResolvedValue({ enabled: 0 });

    const result = await isFlagEnabled("standards_security");
    expect(result).toBe(false);
  });

  it("isFlagEnabled should default to true if flag not found or on db error", async () => {
    (prisma.featureFlag.findFirst as any).mockResolvedValue(null);
    expect(await isFlagEnabled("unknown_flag")).toBe(true);

    (prisma.featureFlag.findFirst as any).mockRejectedValue(new Error("DB offline"));
    expect(await isFlagEnabled("standards_security")).toBe(true);
  });

  it("isStandardEnabled should normalize category names and check corresponding flag", async () => {
    (prisma.featureFlag.findFirst as any).mockResolvedValue({ enabled: 0 });

    const result = await isStandardEnabled("Security");
    expect(result).toBe(false);
    expect(prisma.featureFlag.findFirst).toHaveBeenCalledWith({
      where: { key: { in: ["standards_security"] } },
      select: { enabled: true },
    });
  });

  it("getEnabledStandards should filter out disabled categories", async () => {
    (prisma.featureFlag.findMany as any).mockResolvedValue([
      { key: "standards_security", enabled: 1 },
      { key: "standards_architecture", enabled: 1 },
      { key: "standards_privacy", enabled: 0 },
      { key: "standards_compliance", enabled: 0 },
      { key: "standards_legal", enabled: 1 },
      { key: "standards_quality", enabled: 1 },
    ]);

    const enabledCats = await getEnabledStandards();
    expect(enabledCats).toContain("Security");
    expect(enabledCats).toContain("Architecture");
    expect(enabledCats).toContain("Legal");
    expect(enabledCats).toContain("Quality");
    expect(enabledCats).not.toContain("Privacy");
    expect(enabledCats).not.toContain("Compliance");
  });
});
