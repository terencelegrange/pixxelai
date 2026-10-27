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
    const rows = await prisma.$queryRaw<{
      id: number; active: number; expires_at: Date | null;
    }[]>`
      SELECT id, active, expires_at FROM api_keys
      WHERE key_hash = ${keyHash} AND active = 1
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;
    if (!rows[0]) return null;

    // Update last_used (fire and forget)
    prisma.$executeRaw`UPDATE api_keys SET last_used = NOW() WHERE id = ${rows[0].id}`.catch(() => {});

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
  await prisma.$executeRawUnsafe(
    `INSERT INTO device_tokens (user_id, token_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL ${DEVICE_TOKEN_TTL_DAYS} DAY)`,
    userId,
    hashDeviceToken(raw)
  );
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
