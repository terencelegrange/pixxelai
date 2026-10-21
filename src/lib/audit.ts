import { prisma } from "./prisma";
import { sendRemoteLog } from "./observability";

export interface AuditOptions {
  userId?: number | null;
  action: string;          // e.g. LOGIN, CREATE, UPDATE, DELETE, APPROVE, REJECT
  resource: string;        // e.g. users, sessions
  resourceId?: string | number | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
}

export async function auditLog(opts: AuditOptions): Promise<void> {
  try {
    const details = opts.details ? JSON.stringify(opts.details) : null;
    const resourceId = opts.resourceId != null ? String(opts.resourceId) : null;

    await prisma.$executeRaw`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip, created_at)
      VALUES (
        ${opts.userId ?? null},
        ${opts.action},
        ${opts.resource},
        ${resourceId},
        ${details},
        ${opts.ip ?? null},
        NOW()
      )
    `;

    // Asynchronously forward to remote LogCollector if configured
    sendRemoteLog({
      level: "info",
      message: `[Audit] ${opts.action} on ${opts.resource}${resourceId ? ` (#${resourceId})` : ""}`,
      statusCode: 200,
      method: "AUDIT",
      path: `/${opts.resource}`,
      metadata: {
        userId: opts.userId,
        action: opts.action,
        resource: opts.resource,
        resourceId: opts.resourceId,
        details: opts.details,
        ip: opts.ip,
      },
    }).catch(() => {});
  } catch (e) {
    // Never let audit failures break the main flow
    console.error("[audit] failed to write:", e);
  }
}

export function getIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

export function getUserAgent(req: Request): string | null {
  return req.headers.get("user-agent") || null;
}

export interface ParsedUserAgent {
  browser: string;
  os: string;
}

export function parseUserAgent(ua: string | null): ParsedUserAgent {
  if (!ua) return { browser: "Unknown Browser", os: "Unknown OS" };

  let os = "Unknown OS";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown Browser";
  if (/edg/i.test(ua)) browser = "Microsoft Edge";
  else if (/chrome|crios/i.test(ua) && !/opr|opera/i.test(ua)) browser = "Google Chrome";
  else if (/safari/i.test(ua) && !/chrome|crios|opr|opera/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Mozilla Firefox";
  else if (/opr|opera/i.test(ua)) browser = "Opera";

  return { browser, os };
}
