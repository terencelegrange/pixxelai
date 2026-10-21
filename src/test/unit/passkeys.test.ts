import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe("Unit: Passkeys & WebAuthn RP Config (lib/passkeys)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getRPConfig should derive rpID and origin for local development", () => {
    const req = new NextRequest("http://localhost:3334/api/auth/passkeys/login", {
      headers: { host: "localhost:3334" },
    });
    const config = getRPConfig(req);

    expect(config.rpID).toBe("localhost");
    expect(config.rpName).toBe("PixxelAI");
    expect(config.origin).toContain("http://localhost:3334");
  });

  it("getRPConfig should respect x-forwarded-host and x-forwarded-proto in production", () => {
    const req = new NextRequest("http://internal-node:3000/api/auth/passkeys/login", {
      headers: {
        "x-forwarded-host": "pixxelai.company.com",
        "x-forwarded-proto": "https",
      },
    });

    const config = getRPConfig(req);
    expect(config.rpID).toBe("pixxelai.company.com");
    expect(config.origin).toBe("https://pixxelai.company.com");
  });

  it("isPasskeysEnabled should return true when flag is 1 and false when 0", async () => {
    (prisma.$queryRaw as any).mockResolvedValueOnce([{ enabled: 1 }]);
    expect(await isPasskeysEnabled()).toBe(true);

    (prisma.$queryRaw as any).mockResolvedValueOnce([{ enabled: 0 }]);
    expect(await isPasskeysEnabled()).toBe(false);

    (prisma.$queryRaw as any).mockResolvedValueOnce([]);
    expect(await isPasskeysEnabled()).toBe(false);
  });
});
