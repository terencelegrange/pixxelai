import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

export interface WatermarkConfig {
  enabled: boolean;
  customText: string;
  showQr: boolean;
  opacity: number;
  fontSize: number;
}

export async function getWatermarkConfig(): Promise<WatermarkConfig> {
  try {
    const flag = await (prisma as any).featureFlag.findUnique({
      where: { key: "watermarking" },
      select: { enabled: true },
    });
    const flagEnabled = flag ? flag.enabled === 1 : false;

    const row = await (prisma as any).watermarkConfig.findUnique({
      where: { id: 1 },
      select: { enabled: true, custom_text: true, show_qr: true, opacity: true, font_size: true },
    });

    if (!row) {
      return {
        enabled: false,
        customText: "{{email}} • CONFIDENTIAL",
        showQr: true,
        opacity: 7,
        fontSize: 12,
      };
    }
    return {
      enabled: flagEnabled && row.enabled === 1,
      customText: row.custom_text || "{{email}} • CONFIDENTIAL",
      showQr: row.show_qr === 1,
      opacity: Math.max(1, Math.min(100, row.opacity || 7)),
      fontSize: Math.max(8, Math.min(36, row.font_size || 12)),
    };
  } catch (e) {
    console.error("[getWatermarkConfig] error:", e);
    return {
      enabled: false,
      customText: "{{email}} • CONFIDENTIAL",
      showQr: true,
      opacity: 7,
      fontSize: 12,
    };
  }
}

export async function generateWatermarkOverlayPayload(user: {
  id: number;
  email: string;
  name?: string | null;
}) {
  const config = await getWatermarkConfig();
  if (!config.enabled) {
    return { enabled: false, text: "", qrDataUrl: null, opacity: 7, fontSize: 12 };
  }

  const today = new Date().toISOString().slice(0, 10);
  const text = config.customText
    .replace(/\{\{email\}\}/gi, user.email)
    .replace(/\{\{name\}\}/gi, user.name || user.email.split("@")[0])
    .replace(/\{\{id\}\}/gi, String(user.id))
    .replace(/\{\{date\}\}/gi, today);

  let qrDataUrl: string | null = null;
  if (config.showQr) {
    const qrPayload = JSON.stringify({
      u: user.id,
      e: user.email,
      t: Date.now(),
      app: "Boilerplate",
    });

    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 0,
      width: 48,
      errorCorrectionLevel: "L",
      color: {
        dark: "#000000",
        light: "#00000000", // Transparent background
      },
    });
  }

  return {
    enabled: true,
    text,
    qrDataUrl,
    opacity: config.opacity,
    fontSize: config.fontSize,
  };
}
