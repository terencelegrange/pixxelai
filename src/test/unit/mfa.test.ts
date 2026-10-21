import { describe, it, expect } from "vitest";
import {
  createTotpInstance,
  generateMfaSetup,
  verifyTotpToken,
  hashBackupCode,
  generateBackupCodes,
  ISSUER_NAME,
} from "@/lib/mfa";

describe("Unit: MFA & TOTP Utilities (lib/mfa)", () => {
  it("createTotpInstance should configure TOTP with standard parameters", () => {
    const totp = createTotpInstance("user@pixxel.ai");
    expect(totp.issuer).toBe(ISSUER_NAME);
    expect(totp.label).toBe("user@pixxel.ai");
    expect(totp.digits).toBe(6);
    expect(totp.period).toBe(30);
    expect(totp.algorithm).toBe("SHA1");
    expect(totp.secret.base32).toBeDefined();
  });

  it("generateMfaSetup should return base32 secret, otpauth URI, and QR data URL", async () => {
    const setup = await generateMfaSetup("test@pixxel.ai");
    expect(setup.secret).toBeDefined();
    expect(setup.secret.length).toBeGreaterThan(10);
    expect(setup.uri).toContain("otpauth://totp/");
    expect(setup.uri).toContain("test%40pixxel.ai");
    expect(setup.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("verifyTotpToken should validate valid tokens and reject invalid tokens", () => {
    const totp = createTotpInstance("valid@pixxel.ai");
    const secret = totp.secret.base32;

    const currentToken = totp.generate();
    expect(verifyTotpToken(secret, currentToken)).toBe(true);

    expect(verifyTotpToken(secret, "000000")).toBe(false);
    expect(verifyTotpToken(secret, "abcdef")).toBe(false);
    expect(verifyTotpToken(secret, "")).toBe(false);
    expect(verifyTotpToken("invalid-base32-secret", currentToken)).toBe(false);
  });

  it("hashBackupCode should normalize and produce deterministic sha256 hashes", () => {
    const code = "ABCD-EFGH";
    const hash1 = hashBackupCode(code);
    const hash2 = hashBackupCode("abcd-efgh"); // lowercase
    const hash3 = hashBackupCode("abcdefgh");  // without hyphen
    const hash4 = hashBackupCode("  abcd efgh "); // whitespace

    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
    expect(hash1).toBe(hash4);
    expect(hash1).toHaveLength(64);
  });

  it("generateBackupCodes should produce requested count of formatted codes with sha256 hashes", () => {
    const { plainCodes, hashedCodes } = generateBackupCodes(8);

    expect(plainCodes).toHaveLength(8);
    expect(hashedCodes).toHaveLength(8);

    for (let i = 0; i < plainCodes.length; i++) {
      expect(plainCodes[i]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(hashedCodes[i]).toBe(hashBackupCode(plainCodes[i]));
    }

    // Verify all codes are unique
    const unique = new Set(plainCodes);
    expect(unique.size).toBe(8);
  });
});
