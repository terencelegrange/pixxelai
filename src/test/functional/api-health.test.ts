import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/health/route";
import { isSetupComplete, getDbDialect } from "@/lib/setup";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/setup", () => ({
  isSetupComplete: vi.fn(),
  getDbDialect: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with setupComplete=false when instance is unconfigured", async () => {
    vi.mocked(isSetupComplete).mockReturnValue(false);
    vi.mocked(getDbDialect).mockReturnValue("sqlite");

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.setupComplete).toBe(false);
    expect(data.dialect).toBe("sqlite");
    expect(data.message).toContain("ready for initial setup");
  });

  it("returns 200 with status=ok when setup is complete and DB is healthy", async () => {
    vi.mocked(isSetupComplete).mockReturnValue(true);
    vi.mocked(getDbDialect).mockReturnValue("mysql");
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ "1": 1 }]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.setupComplete).toBe(true);
    expect(data.dialect).toBe("mysql");
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns 503 when setup is complete but DB probe fails", async () => {
    vi.mocked(isSetupComplete).mockReturnValue(true);
    vi.mocked(getDbDialect).mockReturnValue("mysql");
    vi.mocked(prisma.$queryRawUnsafe).mockRejectedValueOnce(new Error("Connection refused"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.setupComplete).toBe(true);
    expect(data.error).toBe("Connection refused");
  });
});
