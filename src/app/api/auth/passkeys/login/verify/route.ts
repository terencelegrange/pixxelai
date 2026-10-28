import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { signToken, COOKIE, THEME_COOKIE } from "@/lib/auth";
import { auditLog, getIp, getUserAgent, parseUserAgent } from "@/lib/audit";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";

interface UserRow {
  id: number;
  email: string;
  role: string;
  status: string;
  theme: string;
  name: string | null;
  avatar: number | null;
}

export async function POST(req: NextRequest) {
  await initDb();

  const enabled = await isPasskeysEnabled();
  if (!enabled) {
    return NextResponse.json({ error: "Passkeys are currently disabled system-wide" }, { status: 403 });
  }

  const body = await req.json();
  const { response, challengeId } = body;

  if (!response || !challengeId || !response.id) {
    return NextResponse.json({ error: "Invalid authentication payload" }, { status: 400 });
  }

  // Retrieve challenge
  const challenge = await (prisma as any).passkeyChallenge.findUnique({
    where: { id: challengeId },
    select: { id: true, challenge: true, expires_at: true },
  });

  if (!challenge || new Date(challenge.expires_at) <= new Date()) {
    return NextResponse.json({ error: "Authentication session expired. Please try again." }, { status: 400 });
  }

  // Clean up challenge
  await (prisma as any).passkeyChallenge.deleteMany({
    where: { id: challengeId },
  }).catch(() => {});

  // Fetch credential
  const credential = await (prisma as any).passkeyCredential.findUnique({
    where: { id: response.id },
    select: {
      id: true,
      user_id: true,
      public_key: true,
      counter: true,
      transports: true,
      name: true,
    },
  });

  if (!credential) {
    return NextResponse.json({ error: "Passkey is not registered with any account" }, { status: 404 });
  }

  // Fetch associated user
  const user = await (prisma as any).user.findUnique({
    where: { id: credential.user_id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      theme: true,
      name: true,
      avatar: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Associated user account not found" }, { status: 404 });
  }

  if (user.status === "pending") {
    return NextResponse.json({ error: "Your account is awaiting approval" }, { status: 403 });
  }
  if (user.status === "rejected") {
    return NextResponse.json({ error: "Your account has been rejected" }, { status: 403 });
  }

  const { rpID, origin } = getRPConfig(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: Buffer.from(credential.public_key, "base64"),
        counter: Number(credential.counter),
        transports: credential.transports ? JSON.parse(credential.transports) : undefined,
      },
      requireUserVerification: false,
    });
  } catch (err: any) {
    console.error("[Passkey verifyAuthenticationResponse] error:", err);
    await auditLog({
      userId: user.id,
      action: "LOGIN_PASSKEY_FAILED",
      resource: "sessions",
      details: { error: err.message, credentialId: credential.id },
      ip: getIp(req),
    });
    return NextResponse.json({ error: err.message || "Passkey verification failed" }, { status: 401 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Passkey authentication failed" }, { status: 401 });
  }

  // Update credential counter and last_used
  const newCounter = BigInt(verification.authenticationInfo.newCounter);
  await (prisma as any).passkeyCredential.update({
    where: { id: credential.id },
    data: {
      counter: newCounter,
      last_used: new Date(),
    },
  });

  // Update user's last login
  await (prisma as any).user.update({
    where: { id: user.id },
    data: { updated_at: new Date() },
  }).catch(() => {});

  const token = await signToken({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const ua = getUserAgent(req);
  const parsed = parseUserAgent(ua);

  await auditLog({
    userId: user.id,
    action: "LOGIN_PASSKEY",
    resource: "sessions",
    details: {
      method: "passkey",
      credentialName: credential.name,
      credentialId: credential.id,
      browser: parsed.browser,
      os: parsed.os,
      userAgent: ua,
    },
    ip: getIp(req),
  });

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
    },
  });

  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set(THEME_COOKIE, user.theme || "dark", {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
