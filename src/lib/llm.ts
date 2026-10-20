import { prisma } from "./prisma";

export type LlmProviderId = "ollama" | "antigravity" | "codex" | "claude";

export interface LlmTestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
  models?: string[];
  details?: any;
}

export function maskApiKey(key: string | null | undefined): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  const start = trimmed.slice(0, Math.min(6, trimmed.length - 4));
  const end = trimmed.slice(-4);
  return `${start}••••••••${end}`;
}

/**
 * Perform a live connectivity and auth test against an LLM provider.
 */
export async function testLlmConnection(
  providerId: LlmProviderId,
  overrideConfig?: {
    base_url?: string;
    api_key?: string;
    default_model?: string;
  }
): Promise<LlmTestResult> {
  const provider = await prisma.llmProviderConfig.findUnique({
    where: { id: providerId },
  });

  const baseUrl = (overrideConfig?.base_url || provider?.base_url || "").replace(/\/+$/, "");
  const apiKey = (overrideConfig?.api_key !== undefined && overrideConfig.api_key !== "")
    ? overrideConfig.api_key.trim()
    : provider?.api_key || "";
  const model = overrideConfig?.default_model || provider?.default_model || "";

  const start = Date.now();

  try {
    if (providerId === "ollama") {
      const targetUrl = baseUrl || "http://localhost:11434";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const headers: Record<string, string> = { "Accept": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(`${targetUrl}/api/tags`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          ok: false,
          latencyMs,
          message: `Ollama returned HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      const modelNames = Array.isArray(data.models)
        ? data.models.map((m: any) => m.name || m.model).filter(Boolean)
        : [];

      return {
        ok: true,
        latencyMs,
        message: modelNames.length > 0
          ? `Connected to Ollama! Found ${modelNames.length} installed model(s): ${modelNames.slice(0, 5).join(", ")}${modelNames.length > 5 ? "..." : ""}`
          : "Connected to Ollama server! (No local models downloaded yet. Run 'ollama pull llama3' to download one).",
        models: modelNames,
      };
    }

    if (providerId === "antigravity") {
      if (!apiKey) {
        return { ok: false, latencyMs: 0, message: "Antigravity / Gemini API Key is required." };
      }

      const targetUrl = baseUrl || "https://generativelanguage.googleapis.com";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const endpoint = `${targetUrl}/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        let errDetail = res.statusText;
        try {
          const errJson = await res.json();
          errDetail = errJson.error?.message || errDetail;
        } catch {}
        return {
          ok: false,
          latencyMs,
          message: `Antigravity / Gemini API error (${res.status}): ${errDetail}`,
        };
      }

      const data = await res.json();
      const models = Array.isArray(data.models)
        ? data.models.map((m: any) => m.name?.replace(/^models\//, "")).filter(Boolean)
        : [];

      return {
        ok: true,
        latencyMs,
        message: `Successfully connected to Antigravity (Gemini API)! Verified access to ${models.length} model variants.`,
        models: models.slice(0, 10),
      };
    }

    if (providerId === "codex") {
      if (!apiKey) {
        return { ok: false, latencyMs: 0, message: "OpenAI / Codex API Key is required." };
      }

      const targetUrl = baseUrl || "https://api.openai.com/v1";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${targetUrl}/models`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        let errDetail = res.statusText;
        try {
          const errJson = await res.json();
          errDetail = errJson.error?.message || errDetail;
        } catch {}
        return {
          ok: false,
          latencyMs,
          message: `Codex / OpenAI API error (${res.status}): ${errDetail}`,
        };
      }

      const data = await res.json();
      const models = Array.isArray(data.data)
        ? data.data.map((m: any) => m.id).filter(Boolean)
        : [];

      return {
        ok: true,
        latencyMs,
        message: `Connected to Codex / OpenAI API! Found ${models.length} available model IDs.`,
        models: models.filter((m: string) => m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3")).slice(0, 10),
      };
    }

    if (providerId === "claude") {
      if (!apiKey) {
        return { ok: false, latencyMs: 0, message: "Anthropic Claude API Key is required." };
      }

      const targetUrl = baseUrl || "https://api.anthropic.com/v1";
      const testModel = model || "claude-3-5-haiku-20241022";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${targetUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: testModel,
          max_tokens: 5,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        let errDetail = res.statusText;
        try {
          const errJson = await res.json();
          errDetail = errJson.error?.message || errDetail;
        } catch {}
        return {
          ok: false,
          latencyMs,
          message: `Claude / Anthropic API error (${res.status}): ${errDetail}`,
        };
      }

      return {
        ok: true,
        latencyMs,
        message: `Successfully connected to Claude (Anthropic API) using model ${testModel}!`,
      };
    }

    return { ok: false, latencyMs: 0, message: `Unsupported provider: ${providerId}` };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const msg = err.name === "AbortError"
      ? "Connection timed out (no response within 10-12s)."
      : (err.message || String(err));
    return { ok: false, latencyMs, message: `Connection failed: ${msg}` };
  }
}

/**
 * Universal invocation helper to call the active (or selected) LLM.
 */
export async function callLlm(params: {
  prompt: string;
  systemPrompt?: string;
  providerId?: LlmProviderId;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ text: string; provider: string; model: string; latencyMs: number }> {
  const start = Date.now();

  const provider = params.providerId
    ? await prisma.llmProviderConfig.findUnique({ where: { id: params.providerId } })
    : await prisma.llmProviderConfig.findFirst({ where: { is_active: 1 } });

  if (!provider) {
    throw new Error("No active LLM provider configured in Settings.");
  }

  const baseUrl = (provider.base_url || "").replace(/\/+$/, "");
  const apiKey = provider.api_key || "";
  const model = params.model || provider.default_model;
  const temperature = params.temperature ?? provider.temperature ?? 0.2;
  const maxTokens = params.maxTokens ?? provider.max_tokens ?? 4096;

  if (provider.id === "ollama") {
    const targetUrl = baseUrl || "http://localhost:11434";
    const res = await fetch(`${targetUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: params.prompt,
        system: params.systemPrompt,
        stream: false,
        options: { temperature },
      }),
    });
    if (!res.ok) throw new Error(`Ollama error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return {
      text: data.response || "",
      provider: "ollama",
      model,
      latencyMs: Date.now() - start,
    };
  }

  if (provider.id === "antigravity") {
    const targetUrl = baseUrl || "https://generativelanguage.googleapis.com";
    const endpoint = `${targetUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body: any = {
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    };
    if (params.systemPrompt) {
      body.systemInstruction = { parts: [{ text: params.systemPrompt }] };
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Antigravity error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return {
      text,
      provider: "antigravity",
      model,
      latencyMs: Date.now() - start,
    };
  }

  if (provider.id === "codex") {
    const targetUrl = baseUrl || "https://api.openai.com/v1";
    const messages: any[] = [];
    if (params.systemPrompt) messages.push({ role: "system", content: params.systemPrompt });
    messages.push({ role: "user", content: params.prompt });

    const res = await fetch(`${targetUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`Codex error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    return {
      text,
      provider: "codex",
      model,
      latencyMs: Date.now() - start,
    };
  }

  if (provider.id === "claude") {
    const targetUrl = baseUrl || "https://api.anthropic.com/v1";
    const body: any = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "user", content: params.prompt }],
    };
    if (params.systemPrompt) body.system = params.systemPrompt;

    const res = await fetch(`${targetUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Claude error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    return {
      text,
      provider: "claude",
      model,
      latencyMs: Date.now() - start,
    };
  }

  throw new Error(`Unsupported provider: ${provider.id}`);
}
