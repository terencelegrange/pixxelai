import { describe, it, expect } from "vitest";
import { parseUserAgent, getIp } from "@/lib/audit";

describe("Unit: Audit & User Agent Parser (lib/audit)", () => {
  it("should return Unknown Browser / Unknown OS for null or empty user agents", () => {
    expect(parseUserAgent(null)).toEqual({ browser: "Unknown Browser", os: "Unknown OS" });
    expect(parseUserAgent("")).toEqual({ browser: "Unknown Browser", os: "Unknown OS" });
  });

  it("should detect Google Chrome across platforms", () => {
    const chromeMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUserAgent(chromeMac)).toEqual({ browser: "Google Chrome", os: "macOS" });

    const chromeWindows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
    expect(parseUserAgent(chromeWindows)).toEqual({ browser: "Google Chrome", os: "Windows" });
  });

  it("should detect Microsoft Edge properly without mistaking it for Chrome", () => {
    const edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(parseUserAgent(edge)).toEqual({ browser: "Microsoft Edge", os: "Windows" });
  });

  it("should detect Mozilla Firefox across platforms", () => {
    const firefoxLinux = "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0";
    expect(parseUserAgent(firefoxLinux)).toEqual({ browser: "Mozilla Firefox", os: "Linux" });

    const firefoxMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(parseUserAgent(firefoxMac)).toEqual({ browser: "Mozilla Firefox", os: "macOS" });
  });

  it("should detect Apple Safari properly without mistaking Chrome for Safari", () => {
    const safariMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15";
    expect(parseUserAgent(safariMac)).toEqual({ browser: "Safari", os: "macOS" });
  });

  it("should detect mobile operating systems (iOS and Android)", () => {
    const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(iPhone)).toEqual({ browser: "Safari", os: "iOS" });

    const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36";
    expect(parseUserAgent(android)).toEqual({ browser: "Google Chrome", os: "Android" });
  });

  it("getIp should extract client IP from x-forwarded-for header", () => {
    const reqWithForwarded = new Request("https://pixxel.ai/api/test", {
      headers: { "x-forwarded-for": "192.168.1.100, 10.0.0.1" },
    });
    expect(getIp(reqWithForwarded)).toBe("192.168.1.100");

    const reqWithoutHeader = new Request("https://pixxel.ai/api/test");
    expect(getIp(reqWithoutHeader)).toBeNull();
  });
});
