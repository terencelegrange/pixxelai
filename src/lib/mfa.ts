import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const ISSUER_NAME = "PixxelAI";

export function createTotpInstance(email: string, secretBase32?: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER_NAME,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secretBase32
      ? OTPAuth.Secret.fromBase32(secretBase32)
      : new OTPAuth.Secret({ size: 20 }),
  });
}

export async function generateMfaSetup(email: string) {
  const totp = createTotpInstance(email);
  const secretBase32 = totp.secret.base32;
  const uri = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(uri, {
    margin: 2,
    width: 240,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  return {
    secret: secretBase32,
    uri,
    qrCodeDataUrl,
  };
}

export function verifyTotpToken(secretBase32: string, token: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER_NAME,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
    const delta = totp.validate({ token: token.trim(), window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

export function hashBackupCode(code: string): string {
  const normalized = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export function generateBackupCodes(count = 8): { plainCodes: string[]; hashedCodes: string[] } {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const part1 = randomBytes(2).toString("hex").toUpperCase();
    const part2 = randomBytes(2).toString("hex").toUpperCase();
    const formatted = `${part1}-${part2}`;
    plainCodes.push(formatted);
    hashedCodes.push(hashBackupCode(formatted));
  }

  return { plainCodes, hashedCodes };
}

export async function isMfaEnabled(): Promise<boolean> {
  try {
    const flag = await (prisma as any).featureFlag.findUnique({
      where: { key: "mfa" },
      select: { enabled: true },
    });
    return flag ? flag.enabled === 1 : false;
  } catch (e) {
    console.error("[isMfaEnabled] error:", e);
    return false;
  }
}
