import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getObservabilityConfigs,
  sendRemoteLog,
  sendAnalyticsEvent,
} from "@/lib/observability";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@/lib/initDb", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
}));

describe("Unit: Observability Telemetry (lib/observability)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("getObservabilityConfigs should return default analytics and logcollector fallbacks", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const configs = await getObservabilityConfigs();
    expect(configs.analytics).toBeDefined();
    expect(configs.analytics.enabled).toBe(false);
    expect(configs.analytics.type).toBe("analytics");

    expect(configs.logcollector).toBeDefined();
    expect(configs.logcollector.enabled).toBe(false);
    expect(configs.logcollector.type).toBe("logcollector");
  });

  it("sendRemoteLog should not invoke fetch when log collector is disabled", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      { type: "logcollector", enabled: 0, endpoint: "http://logger/ingest" },
    ]);
    global.fetch = vi.fn();

    await sendRemoteLog({ message: "Test log message" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sendRemoteLog should dispatch formatted log entry when enabled", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      {
        type: "logcollector",
        enabled: 1,
        endpoint: "http://logger.pixxel.local/ingest",
        api_key: "log-key-123",
        site_id: "pixxelai-prod",
        log_level: "info",
        custom_headers: JSON.stringify({ "X-Custom": "val" }),
      },
    ]);

    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    await sendRemoteLog({
      level: "warn",
      message: "Security alert triggered",
      statusCode: 403,
      path: "/api/standards",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://logger.pixxel.local/ingest",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer log-key-123",
          "X-Custom": "val",
        }),
      })
    );
  });

  it("sendAnalyticsEvent should send formatted analytics event when enabled", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      {
        type: "analytics",
        enabled: 1,
        endpoint: "http://analytics.pixxel.local/collect",
        site_id: "pixxelai",
      },
    ]);

    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    await sendAnalyticsEvent({
      eventName: "view_compliance_report",
      url: "/reporting/compliance",
      props: { appId: "rainyday" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://analytics.pixxel.local/collect",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
