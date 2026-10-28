import { NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseUserAgent } from "@/lib/audit";

export async function GET() {
  await initDb();
  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);

  const rows = await (prisma as any).auditLog.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      resource: true,
      resource_id: true,
      details: true,
      ip: true,
      created_at: true,
    },
  });

  const logs = rows.map((r: any) => {
    let detailsObj: any = {};
    try {
      if (r.details) detailsObj = JSON.parse(r.details);
    } catch {}

    let method = detailsObj.method || "password";
    if (r.action === "LOGIN_PASSKEY") method = "passkey";
    else if (r.action === "LOGIN_MFA") method = detailsObj.method || "totp_authenticator";
    else if (r.action === "DEVICE_TRUSTED") method = "trusted_device";

    let browser = detailsObj.browser;
    let os = detailsObj.os;

    if (!browser || !os) {
      const parsed = parseUserAgent(detailsObj.userAgent || null);
      browser = browser || parsed.browser;
      os = os || parsed.os;
    }

    return {
      id: r.id,
      action: r.action,
      method,
      browser,
      os,
      ip: r.ip || "Unknown IP",
      details: detailsObj,
      createdAt: r.created_at,
    };
  });

  return NextResponse.json({ logs });
}
