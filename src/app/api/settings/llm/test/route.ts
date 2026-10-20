import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { testLlmConnection, LlmProviderId } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { provider_id, base_url, api_key, default_model } = body;

  if (!provider_id) {
    return NextResponse.json({ error: "provider_id is required" }, { status: 400 });
  }

  const validIds: LlmProviderId[] = ["ollama", "antigravity", "codex", "claude"];
  if (!validIds.includes(provider_id as LlmProviderId)) {
    return NextResponse.json({ error: `Invalid provider_id. Must be one of: ${validIds.join(", ")}` }, { status: 400 });
  }

  // Filter out masked placeholder keys
  const cleanApiKey = (api_key && typeof api_key === "string" && !api_key.includes("••••"))
    ? api_key.trim()
    : undefined;

  const result = await testLlmConnection(provider_id as LlmProviderId, {
    base_url: base_url ? String(base_url).trim() : undefined,
    api_key: cleanApiKey,
    default_model: default_model ? String(default_model).trim() : undefined,
  });

  // Record test results in database
  try {
    const updateData: any = {
      last_test_at: new Date(),
      last_test_status: result.ok ? "success" : "failed",
      last_test_msg: result.message,
    };

    if (result.ok && result.models && result.models.length > 0) {
      updateData.available_models = result.models.join(", ");
    }

    await prisma.llmProviderConfig.update({
      where: { id: provider_id },
      data: updateData,
    });
  } catch (dbErr) {
    console.error("Failed to update test record in DB:", dbErr);
  }

  return NextResponse.json(result);
}
