import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  await initDb();

  const enabled = await isPasskeysEnabled();
  if (!enabled) {
    return NextResponse.json({ error: "Passkeys are currently disabled system-wide" }, { status: 403 });
  }

  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);
  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch user's existing credentials to exclude
  const existingCredentials = await (prisma as any).passkeyCredential.findMany({
    where: { user_id: userId },
    select: { id: true, transports: true },
  });

  const excludeCredentials = existingCredentials.map((c: any) => ({
    id: c.id,
    transports: c.transports ? (JSON.parse(c.transports) as any) : undefined,
  }));

  const { rpID, rpName } = getRPConfig(req);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(String(user.id)),
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    timeout: 60000,
  });

  const challengeId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Clean up any stale challenges for this user first
  await (prisma as any).passkeyChallenge.deleteMany({
    where: {
      OR: [
        { user_id: userId },
        { expires_at: { lt: new Date() } },
      ],
    },
  }).catch(() => {});

  // Store new challenge
  await (prisma as any).passkeyChallenge.create({
    data: {
      id: challengeId,
      challenge: options.challenge,
      user_id: userId,
      expires_at: expiresAt,
      created_at: new Date(),
    },
  });

  return NextResponse.json({ options, challengeId });
}
