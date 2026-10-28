import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isMfaEnabled, generateMfaSetup } from "@/lib/mfa";

export async function POST() {
  await initDb();

  const mfaActive = await isMfaEnabled();
  if (!mfaActive) {
    return NextResponse.json({ error: "Multi-Factor Authentication is currently disabled system-wide" }, { status: 403 });
  }

  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);
  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { secret, qrCodeDataUrl } = await generateMfaSetup(user.email);

  // Store pending secret (enabled = 0 until verified)
  await (prisma as any).userMfa.upsert({
    where: { user_id: userId },
    update: { secret, updated_at: new Date() },
    create: { user_id: userId, secret, enabled: 0, updated_at: new Date() },
  });

  return NextResponse.json({
    secret,
    qrCodeDataUrl,
  });
}
