import { describe, it, expect, vi, beforeEach } from "vitest";
import { signToken, verifyToken, hashDeviceToken, getSession, COOKIE } from "@/lib/auth";
import { cookies, headers } from "next/headers";

describe("Unit: Authentication & JWT Utilities (lib/auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signToken should create a valid JWT string containing the payload", async () => {
    const payload = {
      sub: "123",
      email: "security@pixxel.ai",
      role: "security",
      name: "Security Lead",
    };

    const token = await signToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // Standard header.payload.signature

    const verified = await verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe("123");
    expect(verified?.email).toBe("security@pixxel.ai");
    expect(verified?.role).toBe("security");
    expect(verified?.name).toBe("Security Lead");
  });

  it("verifyToken should return null for tampered or invalid tokens", async () => {
    const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsig";
    const result = await verifyToken(invalidToken);
    expect(result).toBeNull();

    const emptyResult = await verifyToken("");
    expect(emptyResult).toBeNull();
  });

  it("hashDeviceToken should deterministically generate sha256 hex string", () => {
    const rawToken = "my-secret-device-token-12345";
    const hash1 = hashDeviceToken(rawToken);
    const hash2 = hashDeviceToken(rawToken);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("getSession should return null when cookie is absent", async () => {
    const mockCookieJar = {
      get: vi.fn().mockReturnValue(undefined),
    };
    (cookies as any).mockResolvedValue(mockCookieJar);

    const session = await getSession();
    expect(session).toBeNull();
  });

  it("getSession should return verified payload when valid cookie exists", async () => {
    const payload = {
      sub: "456",
      email: "admin@pixxel.ai",
      role: "admin",
      name: "Admin User",
    };
    const token = await signToken(payload);

    const mockCookieJar = {
      get: vi.fn((name: string) => (name === COOKIE ? { value: token } : undefined)),
    };
    (cookies as any).mockResolvedValue(mockCookieJar);

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.email).toBe("admin@pixxel.ai");
    expect(session?.role).toBe("admin");
  });
});
