import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { maskApiKey, LlmProviderId } from "@/lib/llm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const providers = await prisma.llmProviderConfig.findMany({
    orderBy: { id: "asc" },
  });

  const sanitized = providers.map((p) => ({
    id: p.id,
    name: p.name,
    enabled: Boolean(p.enabled),
    is_active: Boolean(p.is_active),
    base_url: p.base_url || "",
    has_key: Boolean(p.api_key && p.api_key.trim().length > 0),
    masked_key: maskApiKey(p.api_key),
    default_model: p.default_model,
    available_models: p.available_models ? p.available_models.split(",").map((s) => s.trim()) : [],
    temperature: p.temperature,
    max_tokens: p.max_tokens,
    timeout_seconds: p.timeout_seconds,
    last_test_at: p.last_test_at,
    last_test_status: p.last_test_status,
    last_test_msg: p.last_test_msg,
    updated_at: p.updated_at,
  }));

  const activeProvider = sanitized.find((p) => p.is_active) || sanitized[0];

  return NextResponse.json({
    providers: sanitized,
    active_provider_id: activeProvider?.id || "ollama",
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    id,
    base_url,
    api_key,
    default_model,
    temperature,
    max_tokens,
    enabled,
    is_active,
  } = body;

  if (!id) {
    return NextResponse.json({ error: "Provider ID is required" }, { status: 400 });
  }

  const existing = await prisma.llmProviderConfig.findUnique({
    where: { id: String(id) },
  });

  if (!existing) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const updateData: any = {};
  if (base_url !== undefined) updateData.base_url = base_url ? base_url.trim() : null;
  if (default_model !== undefined) updateData.default_model = default_model.trim();
  if (temperature !== undefined) updateData.temperature = parseFloat(temperature) || 0.2;
  if (max_tokens !== undefined) updateData.max_tokens = parseInt(max_tokens, 10) || 4096;
  if (enabled !== undefined) updateData.enabled = enabled ? 1 : 0;

  // Only update api_key if a new value is passed and it is not a masked string
  if (api_key !== undefined && api_key !== null) {
    const trimmed = api_key.trim();
    if (trimmed !== "" && !trimmed.includes("••••")) {
      updateData.api_key = trimmed;
    } else if (trimmed === "") {
      updateData.api_key = null;
    }
  }

  if (is_active) {
    // Demote other providers
    await prisma.llmProviderConfig.updateMany({
      where: { id: { not: existing.id } },
      data: { is_active: 0 },
    });
    updateData.is_active = 1;
    updateData.enabled = 1; // activating an engine automatically enables it
  }

  const updated = await prisma.llmProviderConfig.update({
    where: { id: existing.id },
    data: updateData,
  });

  await auditLog({
    userId: parseInt(session.sub, 10) || null,
    action: "LLM_CONFIG_UPDATED",
    resource: "llm_provider_configs",
    resourceId: existing.id,
    details: {
      provider: updated.id,
      model: updated.default_model,
      enabled: updated.enabled,
      is_active: updated.is_active,
    },
    ip: getIp(req),
  });

  return NextResponse.json({
    ok: true,
    message: `${updated.name} settings saved successfully.`,
    provider: {
      id: updated.id,
      name: updated.name,
      enabled: Boolean(updated.enabled),
      is_active: Boolean(updated.is_active),
      base_url: updated.base_url || "",
      has_key: Boolean(updated.api_key && updated.api_key.trim().length > 0),
      masked_key: maskApiKey(updated.api_key),
      default_model: updated.default_model,
      temperature: updated.temperature,
      max_tokens: updated.max_tokens,
    },
  });
}
