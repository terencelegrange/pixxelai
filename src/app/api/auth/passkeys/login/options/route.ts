import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  await initDb();

  const enabled = await isPasskeysEnabled();
  if (!enabled) {
    return NextResponse.json({ error: "Passkeys are currently disabled system-wide" }, { status: 403 });
  }

  const { rpID } = getRPConfig(req);

  // Optional: check if an email was passed in body to restrict allowed credentials if desired
  let allowCredentials: any[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    if (body.email) {
      const user = await (prisma as any).user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });
      if (user) {
        const credentials = await (prisma as any).passkeyCredential.findMany({
          where: { user_id: user.id },
          select: { id: true, transports: true },
        });
        allowCredentials = credentials.map((c: any) => ({
          id: c.id,
          transports: c.transports ? JSON.parse(c.transports) : undefined,
        }));
      }
    }
  } catch {}

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    timeout: 60000,
  });

  const challengeId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store authentication challenge
  await (prisma as any).passkeyChallenge.create({
    data: {
      id: challengeId,
      challenge: options.challenge,
      user_id: null,
      expires_at: expiresAt,
      created_at: new Date(),
    },
  });

  return NextResponse.json({ options, challengeId });
}
