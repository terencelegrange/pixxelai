import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "crypto";

import { getOrCreateJwtSecret } from "./jwt-secret";

const DEVICE_TOKEN_TTL_DAYS = 30;

export const COOKIE = "bp_token";
export const THEME_COOKIE = "bp_theme";

export function getJwtSecretBytes(): Uint8Array {
  const s = process.env.JWT_SECRET || getOrCreateJwtSecret();
  return new TextEncoder().encode(s);
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string | null;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(getJwtSecretBytes());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

async function getSessionFromApiKey(rawKey: string): Promise<JwtPayload | null> {
  try {
    const { prisma } = await import("./prisma");
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const now = new Date();
    const key = await (prisma as any).apiKey.findFirst({
      where: {
        key_hash: keyHash,
        active: 1,
        OR: [
          { expires_at: null },
          { expires_at: { gt: now } },
        ],
      },
      select: { id: true },
    });
    if (!key) return null;

    // Update last_used (fire and forget)
    (prisma as any).apiKey.update({
      where: { id: key.id },
      data: { last_used: new Date() },
    }).catch(() => {});

    // API keys get admin-level access
    return { sub: "apikey", email: "api", role: "admin", name: null };
  } catch {
    return null;
  }
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createDeviceToken(userId: number): Promise<string> {
  const { prisma } = await import("./prisma");
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DEVICE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await (prisma as any).deviceToken.create({
    data: {
      user_id: userId,
      token_hash: hashDeviceToken(raw),
      expires_at: expiresAt,
    },
  });
  return raw;
}

export async function getSession(): Promise<JwtPayload | null> {
  // 1. Check Authorization: Bearer header (API key support)
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer bp_")) {
    const rawKey = authHeader.slice(7);
    const session = await getSessionFromApiKey(rawKey);
    if (session) return session;
  }

  // 2. Fall back to cookie-based JWT
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
