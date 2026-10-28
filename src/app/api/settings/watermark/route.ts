import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { getWatermarkConfig, generateWatermarkOverlayPayload } from "@/lib/watermark";

export async function GET() {
  await initDb();
  const session = await getSession();
  const config = await getWatermarkConfig();

  let overlay: any = { enabled: false, text: "", qrDataUrl: null, opacity: 7, fontSize: 12 };

  if (session && session.sub !== "apikey" && config.enabled) {
    const userId = Number(session.sub);
    overlay = await generateWatermarkOverlayPayload({
      id: userId,
      email: session.email,
      name: session.name,
    });
  }

  return NextResponse.json({
    config,
    overlay,
  });
}

export async function PATCH(req: NextRequest) {
  await initDb();
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const enabled = body.enabled ? 1 : 0;
  const customText = body.customText?.trim() || "{{email}} • CONFIDENTIAL";
  const showQr = body.showQr ? 1 : 0;
  const opacity = Math.max(1, Math.min(100, Number(body.opacity) || 7));
  const fontSize = Math.max(8, Math.min(36, Number(body.fontSize) || 12));

  // Update feature flag
  await (prisma as any).featureFlag.upsert({
    where: { key: "watermarking" },
    update: { enabled },
    create: {
      key: "watermarking",
      enabled,
      label: "Forensic Watermarking",
      description: "Display subtle 45-degree tiled watermark and user QR verification overlay",
      category: "system",
    },
  });

  // Update watermark config
  await (prisma as any).watermarkConfig.upsert({
    where: { id: 1 },
    update: {
      enabled,
      custom_text: customText,
      show_qr: showQr,
      opacity,
      font_size: fontSize,
      updated_at: new Date(),
    },
    create: {
      id: 1,
      enabled,
      custom_text: customText,
      show_qr: showQr,
      opacity,
      font_size: fontSize,
      updated_at: new Date(),
    },
  });

  await auditLog({
    userId: session.sub === "apikey" ? undefined : Number(session.sub),
    action: enabled ? "WATERMARK_ENABLED" : "WATERMARK_DISABLED",
    resource: "watermark_config",
    details: { enabled: !!enabled, customText, showQr: !!showQr, opacity, fontSize },
    ip: getIp(req),
  });

  return NextResponse.json({
    ok: true,
    config: {
      enabled: !!enabled,
      customText,
      showQr: !!showQr,
      opacity,
      fontSize,
    },
  });
}
