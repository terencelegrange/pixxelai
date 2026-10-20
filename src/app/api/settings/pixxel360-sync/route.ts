import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.pixxel360SyncConfig.findFirst();
  if (!config) {
    return NextResponse.json({
      server_url: "http://192.168.100.228:7002",
      api_key_masked: "",
      has_api_key: false,
      sync_source: "database",
      last_sync_at: null,
      last_sync_status: "NOT_CONFIGURED",
      last_sync_message: "Please configure Pixxel360 connection in settings",
      controls_synced_count: 0,
    });
  }

  const hasApiKey = Boolean(config.api_key && config.api_key.trim().length > 0);
  const maskedKey = hasApiKey
    ? config.api_key!.length > 8
      ? `${config.api_key!.slice(0, 4)}••••••••${config.api_key!.slice(-4)}`
      : "••••••••"
    : "";

  return NextResponse.json({
    id: config.id,
    server_url: config.server_url,
    api_key_masked: maskedKey,
    has_api_key: hasApiKey,
    sync_source: config.sync_source,
    last_sync_at: config.last_sync_at,
    last_sync_status: config.last_sync_status,
    last_sync_message: config.last_sync_message,
    controls_synced_count: config.controls_synced_count,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { action, sync_source = "database", server_url, api_key } = body;

  let config = await prisma.pixxel360SyncConfig.findFirst();
  if (!config) {
    config = await prisma.pixxel360SyncConfig.create({
      data: {
        server_url: server_url || "http://192.168.100.228:7002",
        api_key: api_key || "",
        sync_source,
      },
    });
  }

  // 1. UPDATE CONFIG ACTION
  if (action === "update_config") {
    const updateData: { server_url?: string; api_key?: string; sync_source?: string } = {};
    if (server_url !== undefined) updateData.server_url = server_url.trim();
    if (api_key !== undefined && api_key !== "") updateData.api_key = api_key.trim();
    if (sync_source !== undefined) updateData.sync_source = sync_source;

    config = await prisma.pixxel360SyncConfig.update({
      where: { id: config.id },
      data: updateData,
    });

    await auditLog({
      userId: parseInt(session.sub, 10) || null,
      action: "PIXXEL360_CONFIG_UPDATED",
      resource: "pixxel360_sync_config",
      details: { server_url: config.server_url, sync_source: config.sync_source },
      ip: getIp(req),
    });

    return NextResponse.json({ ok: true, message: "Pixxel360 configuration updated successfully" });
  }

  // 2. TEST CONNECTION ACTION
  if (action === "test_connection") {
    if (sync_source === "database") {
      try {
        const rows = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
          "SELECT COUNT(*) AS c FROM pixxel360.attributes"
        );
        const count = Number(rows[0]?.c ?? 0);
        return NextResponse.json({
          ok: true,
          message: `Connected successfully to Pixxel360 database! Found ${count} security controls/attributes.`,
          count,
        });
      } catch (err: any) {
        return NextResponse.json({
          ok: false,
          error: `Database connection error: ${err.message || String(err)}`,
        }, { status: 500 });
      }
    }

    const targetUrl = (server_url || config.server_url).replace(/\/+$/, "");
    const keyToUse = (api_key !== undefined && api_key !== "") ? api_key.trim() : config.api_key;

    try {
      const endpoint = `${targetUrl}/api/settings/attributes`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const headers: Record<string, string> = { "Accept": "application/json" };
      if (keyToUse) {
        headers["Authorization"] = `Bearer ${keyToUse}`;
        headers["X-API-Key"] = keyToUse;
      }

      const resp = await fetch(endpoint, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        const count = Array.isArray(data.attributes) ? data.attributes.length : 0;
        return NextResponse.json({
          ok: true,
          message: `Connected successfully to Pixxel360! Found ${count} security attributes.`,
          status_code: resp.status,
          count,
        });
      } else {
        return NextResponse.json({
          ok: false,
          error: `Pixxel360 returned HTTP ${resp.status}: ${resp.statusText}`,
          status_code: resp.status,
        }, { status: 400 });
      }
    } catch (err: any) {
      return NextResponse.json({
        ok: false,
        error: `Failed to connect to ${targetUrl}: ${err.message || String(err)}`,
      }, { status: 502 });
    }
  }

  // 3. SYNC NOW ACTION
  if (action === "sync_now") {
    let attributes: any[] = [];
    let characteristics: any[] = [];

    if (sync_source === "database") {
      try {
        attributes = await prisma.$queryRawUnsafe<any[]>(
          "SELECT id, name, description, asset_class_id, risk_level, weight, sort_order FROM pixxel360.attributes WHERE active = 1 ORDER BY sort_order ASC, id ASC"
        );
        characteristics = await prisma.$queryRawUnsafe<any[]>(
          "SELECT id, name, description, risk_level, weight, sort_order FROM pixxel360.characteristics WHERE active = 1 ORDER BY sort_order ASC, id ASC"
        ).catch(() => []);
      } catch (dbErr: any) {
        return NextResponse.json({
          ok: false,
          error: `Database query error: ${dbErr.message || String(dbErr)}`,
        }, { status: 500 });
      }
    } else {
      const targetUrl = (server_url || config.server_url).replace(/\/+$/, "");
      const keyToUse = (api_key !== undefined && api_key !== "") ? api_key.trim() : config.api_key;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const headers: Record<string, string> = { "Accept": "application/json" };
        if (keyToUse) {
          headers["Authorization"] = `Bearer ${keyToUse}`;
          headers["X-API-Key"] = keyToUse;
        }

        const resp = await fetch(`${targetUrl}/api/settings/attributes`, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
          throw new Error(`Pixxel360 returned HTTP ${resp.status}`);
        }

        const data = await resp.json();
        attributes = data.attributes || [];

        // Also fetch characteristics if available
        try {
          const charResp = await fetch(`${targetUrl}/api/settings/characteristics`, { method: "GET", headers });
          if (charResp.ok) {
            const charData = await charResp.json();
            characteristics = charData.characteristics || [];
          }
        } catch {
          // Characteristics endpoint is optional
        }
      } catch (apiErr: any) {
        const errMsg = `API sync error: ${apiErr.message || String(apiErr)}`;
        await prisma.pixxel360SyncConfig.update({
          where: { id: config.id },
          data: {
            last_sync_at: new Date(),
            last_sync_status: "FAILED",
            last_sync_message: errMsg,
          },
        });
        return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
      }
    }

    if (!attributes.length) {
      return NextResponse.json({ ok: false, error: "No attributes or controls found in Pixxel360." }, { status: 404 });
    }

    // Generate formatted Markdown
    const syncTimeStr = new Date().toISOString();
    let md = `# Application Security Baseline\n\n`;
    md += `> **Source**: Synchronized from Pixxel360 Security Architecture  \n`;
    md += `> **Category**: Security  \n`;
    md += `> **Last Synced**: ${syncTimeStr}  \n`;
    md += `> **Total Controls**: ${attributes.length}  \n\n`;
    md += `---\n\n`;
    md += `## 1. Objective & Scope\n\n`;
    md += `This baseline establishes the mandatory technical and procedural security controls applicable to all applications, cloud services, and microservices tracked within PixxelAI.\n\n`;
    md += `---\n\n`;

    if (characteristics.length > 0) {
      md += `## 2. Inherent Risk Characteristics\n\n`;
      md += `Applications must be classified against the following organizational risk dimensions:\n\n`;
      md += `| Characteristic | Inherent Risk | Description |\n`;
      md += `|---|---|---|\n`;
      for (const ch of characteristics) {
        md += `| **${ch.name}** | \`${ch.risk_level || "High"}\` | ${ch.description || "N/A"} |\n`;
      }
      md += `\n---\n\n`;
    }

    md += `## 3. Mandatory Security Controls Catalog\n\n`;
    md += `| Ref | Control Name | Target Asset Class | Severity | Weight | Description |\n`;
    md += `|---|---|---|---|---|---|\n`;
    attributes.forEach((attr, idx) => {
      const code = `SEC-${String(idx + 1).padStart(2, "0")}`;
      const assetClass = attr.asset_class_id || "All";
      const risk = attr.risk_level || "High";
      const weight = attr.weight || 5;
      const desc = (attr.description || "").replace(/\|/g, "\\|");
      md += `| **${code}** | ${attr.name} | \`${assetClass}\` | \`${risk}\` | ${weight} | ${desc} |\n`;
    });

    md += `\n---\n\n`;
    md += `## 4. Operational Implementation Checklist\n\n`;
    attributes.forEach((attr, idx) => {
      const code = `SEC-${String(idx + 1).padStart(2, "0")}`;
      md += `- [ ] **${code} - ${attr.name}**: ${attr.description || "Ensure requirement is implemented and verified."}\n`;
    });

    try {
      // Upsert into standards table
      const existingStd = await prisma.standard.findUnique({
        where: { slug: "security" },
      });

      if (existingStd) {
        await prisma.standard.update({
          where: { id: existingStd.id },
          data: {
            title: "Application Security Baseline",
            category: "Security",
            description: `Core baseline security controls (${attributes.length} controls synced from Pixxel360)`,
            content: md,
            source: "pixxel360",
            item_count: attributes.length,
          },
        });
      } else {
        await prisma.standard.create({
          data: {
            id: "std-security-core",
            slug: "security",
            title: "Application Security Baseline",
            category: "Security",
            description: `Core baseline security controls (${attributes.length} controls synced from Pixxel360)`,
            content: md,
            source: "pixxel360",
            item_count: attributes.length,
          },
        });
      }

      const successMsg = `Successfully synced ${attributes.length} security controls from Pixxel360 into Security standard.`;

      await prisma.pixxel360SyncConfig.update({
        where: { id: config.id },
        data: {
          last_sync_at: new Date(),
          last_sync_status: "SUCCESS",
          last_sync_message: successMsg,
          controls_synced_count: attributes.length,
        },
      });

      await auditLog({
        userId: parseInt(session.sub, 10) || null,
        action: "PIXXEL360_CONTROLS_SYNCED",
        resource: "standards",
        details: { count: attributes.length, sync_source },
        ip: getIp(req),
      });

      return NextResponse.json({
        ok: true,
        controls_count: attributes.length,
        message: successMsg,
      });
    } catch (saveErr: any) {
      console.error("[pixxel360-sync] save error:", saveErr);
      const errMsg = `Failed to save standards: ${saveErr.message || String(saveErr)}`;
      await prisma.pixxel360SyncConfig.update({
        where: { id: config.id },
        data: {
          last_sync_at: new Date(),
          last_sync_status: "FAILED",
          last_sync_message: errMsg,
        },
      });
      return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
