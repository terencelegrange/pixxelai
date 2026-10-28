import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export function getRPConfig(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3333";
  const hostname = host.split(":")[0];
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto = forwardedProto || (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https");
  
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");
  let origin = originHeader;
  if (!origin && refererHeader) {
    try {
      const u = new URL(refererHeader);
      origin = u.origin;
    } catch {
      origin = `${proto}://${host}`;
    }
  }
  if (!origin) {
    origin = `${proto}://${host}`;
  }

  const rpID = hostname;
  const rpName = "PixxelAI";

  return { rpID, rpName, origin };
}

export async function isPasskeysEnabled(): Promise<boolean> {
  try {
    const flag = await (prisma as any).featureFlag.findUnique({
      where: { key: "passkeys" },
      select: { enabled: true },
    });
    return flag ? flag.enabled === 1 : false;
  } catch (e) {
    console.error("[isPasskeysEnabled] error:", e);
    return false;
  }
}
