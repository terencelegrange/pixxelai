"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  is_active: boolean;
  base_url: string;
  has_key: boolean;
  masked_key: string;
  default_model: string;
  available_models: string[];
  temperature: number;
  max_tokens: number;
  timeout_seconds: number;
  last_test_at: string | null;
  last_test_status: string | null;
  last_test_msg: string | null;
}

export default function LlmSettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [activeTab, setActiveTab] = useState<string>("ollama");
  const [loading, setLoading] = useState(true);

  // Form states per provider
  const [formData, setFormData] = useState<Record<string, {
    base_url: string;
    api_key: string;
    default_model: string;
    temperature: number;
    max_tokens: number;
    enabled: boolean;
  }>>({});

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});

  // Action status states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string; latencyMs: number } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  async function loadConfigs() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/llm");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);

        const initialForm: Record<string, any> = {};
        for (const p of data.providers || []) {
          initialForm[p.id] = {
            base_url: p.base_url || "",
            api_key: p.has_key ? p.masked_key : "",
            default_model: p.default_model || "",
            temperature: p.temperature ?? 0.2,
            max_tokens: p.max_tokens ?? 4096,
            enabled: p.enabled,
          };
        }
        setFormData(initialForm);

        if (data.active_provider_id) {
          setActiveTab(data.active_provider_id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfigs();
  }, []);

  function handleInputChange(providerId: string, field: string, value: any) {
    setFormData((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        [field]: value,
      },
    }));
  }

  async function handleSave(providerId: string, makeActive?: boolean) {
    setSavingId(providerId);
    setStatusMessage(null);

    const form = formData[providerId];
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: providerId,
          base_url: form.base_url,
          api_key: form.api_key,
          default_model: form.default_model,
          temperature: form.temperature,
          max_tokens: form.max_tokens,
          enabled: form.enabled,
          is_active: makeActive ? true : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: data.message || "Settings saved successfully", type: "success" });
        await loadConfigs();
      } else {
        setStatusMessage({ text: data.error || "Failed to save settings", type: "error" });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Save request failed", type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  async function handleTestConnection(providerId: string) {
    setTestingId(providerId);
    setTestResult(null);

    const form = formData[providerId];
    try {
      const res = await fetch("/api/settings/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          base_url: form.base_url,
          api_key: form.api_key,
          default_model: form.default_model,
        }),
      });

      const data = await res.json();
      setTestResult({
        id: providerId,
        ok: data.ok,
        message: data.message,
        latencyMs: data.latencyMs,
      });

      // Refresh configs in background to update last_test timestamp
      const refreshRes = await fetch("/api/settings/llm");
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setProviders(refreshData.providers || []);
      }
    } catch (err: any) {
      setTestResult({
        id: providerId,
        ok: false,
        message: err.message || "Network test failed",
        latencyMs: 0,
      });
    } finally {
      setTestingId(null);
    }
  }

  const currentProvider = providers.find((p) => p.id === activeTab);
  const currentForm = formData[activeTab] || {
    base_url: "",
    api_key: "",
    default_model: "",
    temperature: 0.2,
    max_tokens: 4096,
    enabled: false,
  };

  const activeProvider = providers.find((p) => p.is_active);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
            <Link href="/settings" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Settings
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">LLM Providers</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            LLM Integrations
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Configure local and cloud AI models for security, architecture, and compliance reviews.
          </p>
        </div>

        {/* Active Engine Badge */}
        {activeProvider && (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Active Review Engine
              </div>
              <div className="text-xs font-semibold text-gray-900 dark:text-white">
                {activeProvider.name} ({activeProvider.default_model})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global Alerts */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between transition ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Provider Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: "ollama", name: "Ollama", badge: "Local LLM", icon: "💻" },
          { id: "antigravity", name: "Antigravity", badge: "Google Gemini", icon: "✨" },
          { id: "codex", name: "Codex", badge: "OpenAI", icon: "🧠" },
          { id: "claude", name: "Claude", badge: "Anthropic", icon: "⚡" },
        ].map((tab) => {
          const cfg = providers.find((p) => p.id === tab.id);
          const isSelected = activeTab === tab.id;
          const isActive = cfg?.is_active;

          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setTestResult(null);
                setStatusMessage(null);
              }}
              className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                isSelected
                  ? "bg-white dark:bg-slate-900 border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                  : "bg-white/60 dark:bg-slate-900/60 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
              }`}
            >
              {isActive && (
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Primary
                </span>
              )}

              <div>
                <div className="text-xl mb-1">{tab.icon}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">{tab.name}</div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400">{tab.badge}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className={cfg?.enabled ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-gray-400"}>
                  {cfg?.enabled ? "Enabled" : "Disabled"}
                </span>
                {cfg?.has_key && <span className="font-mono text-[10px] text-indigo-500">Key Set</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Configuration Card for Selected Tab */}
      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
          Loading provider configurations...
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Header of Active Card */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {currentProvider?.name || activeTab}
                {currentProvider?.is_active && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Active Review Engine
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {activeTab === "ollama" && "Execute local private inference on your Proxmox server or local workstation without external API costs."}
                {activeTab === "antigravity" && "Connect Google Gemini models for deep reasoning and multimodal code understanding."}
                {activeTab === "codex" && "Leverage OpenAI GPT-4o and reasoning models for architectural and code compliance reviews."}
                {activeTab === "claude" && "Use Anthropic Claude 3.7 / 3.5 Sonnet for nuanced compliance, security, and vulnerability assessments."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentForm.enabled}
                  onChange={(e) => handleInputChange(activeTab, "enabled", e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                Enabled
              </label>

              {!currentProvider?.is_active && (
                <button
                  type="button"
                  onClick={() => handleSave(activeTab, true)}
                  disabled={savingId === activeTab}
                  className="px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 transition"
                >
                  Set as Active
                </button>
              )}
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && testResult.id === activeTab && (
            <div
              className={`p-4 rounded-xl text-xs flex items-start gap-2.5 border ${
                testResult.ok
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              }`}
            >
              <span className="font-bold text-base leading-none">{testResult.ok ? "✓" : "✕"}</span>
              <div className="flex-1">
                <div className="font-bold">
                  {testResult.ok ? `Connection Successful (${testResult.latencyMs}ms)` : "Connection Failed"}
                </div>
                <div className="mt-0.5 leading-relaxed">{testResult.message}</div>
              </div>
            </div>
          )}

          {/* Input Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Endpoint / Base URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {activeTab === "ollama" ? "Ollama Server URL" : "API Base URL"}
              </label>
              <input
                type="text"
                value={currentForm.base_url}
                onChange={(e) => handleInputChange(activeTab, "base_url", e.target.value)}
                placeholder={
                  activeTab === "ollama"
                    ? "http://localhost:11434"
                    : activeTab === "antigravity"
                    ? "https://generativelanguage.googleapis.com"
                    : activeTab === "codex"
                    ? "https://api.openai.com/v1"
                    : "https://api.anthropic.com/v1"
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {activeTab === "ollama"
                  ? "Localhost or remote Ollama server (e.g. http://192.168.100.x:11434)."
                  : "Default official REST API endpoint or compatible proxy."}
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Default Model
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentForm.default_model}
                  onChange={(e) => handleInputChange(activeTab, "default_model", e.target.value)}
                  placeholder="Model identifier..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {currentProvider?.available_models && currentProvider.available_models.length > 0 && (
                  <select
                    value={currentForm.default_model}
                    onChange={(e) => handleInputChange(activeTab, "default_model", e.target.value)}
                    className="px-2.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[140px]"
                  >
                    <option value="" disabled>Presets...</option>
                    {currentProvider.available_models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                The model invoked during code scanning and security audits.
              </p>
            </div>

            {/* API Key (for cloud providers, optional for Ollama) */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  {activeTab === "ollama" ? "API Key / Auth Header (Optional)" : "API Key"}
                </label>
                {currentProvider?.has_key && (
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    API Key Configured
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type={showKeys[activeTab] ? "text" : "password"}
                  value={currentForm.api_key}
                  onChange={(e) => handleInputChange(activeTab, "api_key", e.target.value)}
                  placeholder={
                    activeTab === "ollama"
                      ? "Leave empty if not using reverse proxy authentication"
                      : activeTab === "antigravity"
                      ? "AIzaSy..."
                      : activeTab === "codex"
                      ? "sk-proj-..."
                      : "sk-ant-api03-..."
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys((prev) => ({ ...prev, [activeTab]: !prev[activeTab] }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-semibold"
                >
                  {showKeys[activeTab] ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Keys are stored persistently in the database and masked when displayed.
              </p>
            </div>
          </div>

          {/* Advanced Model Parameters */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => ({ ...prev, [activeTab]: !prev[activeTab] }))}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>{showAdvanced[activeTab] ? "▼" : "▶"}</span>
              <span>Advanced Inference Parameters (Temperature, Tokens)</span>
            </button>

            {showAdvanced[activeTab] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-4 rounded-xl bg-gray-50/50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Temperature ({currentForm.temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentForm.temperature}
                    onChange={(e) => handleInputChange(activeTab, "temperature", parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Deterministic (0.0)</span>
                    <span>Balanced (0.2)</span>
                    <span>Creative (1.0)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Max Output Tokens
                  </label>
                  <input
                    type="number"
                    min="256"
                    max="32768"
                    step="256"
                    value={currentForm.max_tokens}
                    onChange={(e) => handleInputChange(activeTab, "max_tokens", parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleTestConnection(activeTab)}
              disabled={testingId === activeTab}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-200 transition disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 text-indigo-500 ${testingId === activeTab ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {testingId === activeTab ? "Testing Connection..." : "Test Connection"}
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleSave(activeTab, false)}
                disabled={savingId === activeTab}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
              >
                {savingId === activeTab ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
