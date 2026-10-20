"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface SyncConfig {
  id?: number;
  server_url: string;
  api_key_masked: string;
  has_api_key: boolean;
  sync_source: "api" | "database";
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  assets_synced_count: number;
}

export default function SyncToPixxelPage() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [syncMode, setSyncMode] = useState<"api" | "database">("api");
  const [serverUrl, setServerUrl] = useState("http://192.168.100.228:3030");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  async function loadConfig() {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/pixxel-sync");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (data.server_url) setServerUrl(data.server_url);
        if (data.sync_source) setSyncMode(data.sync_source);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/pixxel-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_config",
          sync_source: syncMode,
          server_url: serverUrl,
          api_key: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Pixxel connection settings saved successfully." });
        setApiKey("");
        await loadConfig();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save settings." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save configuration." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/pixxel-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          sync_source: syncMode,
          server_url: serverUrl,
          api_key: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to connect to Pixxel server." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Network error testing connection." });
    } finally {
      setTesting(false);
    }
  }

  async function handleSyncNow() {
    if (!confirm(`This will pull asset records from Pixxel (${syncMode === "api" ? "via API" : "via direct database"}) and synchronize your applications inventory. Continue?`)) {
      return;
    }
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/pixxel-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_now",
          sync_source: syncMode,
          server_url: serverUrl,
          api_key: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: data.message });
        await loadConfig();
      } else {
        setMessage({ type: "error", text: data.error || "Synchronization failed." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Network error initiating sync." });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2">
          <Link href="/settings" className="hover:text-gray-900 dark:hover:text-white transition">Settings</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">Sync to Pixxel</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Sync to Pixxel</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Synchronize application assets from your Pixxel instance into PixxelAI.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/applications"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-semibold text-gray-700 dark:text-slate-200 transition"
            >
              <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              View Applications
            </Link>
          </div>
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-start gap-3 ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
              : message.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300"
              : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300"
          }`}
        >
          <div className="mt-0.5">
            {message.type === "success" ? (
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <div className="flex-1">{message.text}</div>
        </div>
      )}

      {/* Grid: Status & Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Sync Status</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  config?.last_sync_status === "SUCCESS"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : config?.last_sync_status === "FAILED"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {config?.last_sync_status || "IDLE"}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {config?.assets_synced_count ?? 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-0.5">
                  Applications synchronized
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2 text-xs">
                <div>
                  <span className="text-gray-400 dark:text-slate-500">Last Synced:</span>
                  <p className="font-medium text-gray-700 dark:text-slate-300 mt-0.5">
                    {config?.last_sync_at ? new Date(config.last_sync_at).toLocaleString() : "Never"}
                  </p>
                </div>
                {config?.last_sync_message && (
                  <div>
                    <span className="text-gray-400 dark:text-slate-500">Message:</span>
                    <p className="font-medium text-gray-700 dark:text-slate-300 mt-0.5 break-words">
                      {config.last_sync_message}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              onClick={handleSyncNow}
              disabled={syncing || loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white font-semibold text-sm shadow-sm disabled:opacity-50 transition"
            >
              <svg className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? "Synchronizing..." : "Sync Applications Now"}
            </button>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Connection Settings</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
            Configure how PixxelAI reaches your Pixxel instance (via HTTP REST API or direct MariaDB query).
          </p>

          <form onSubmit={handleSaveConfig} className="space-y-5">
            {/* Sync Source Mode */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Sync Source Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSyncMode("api")}
                  className={`p-3 rounded-xl border text-left transition ${
                    syncMode === "api"
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                      : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 text-gray-700 dark:text-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold">REST API (Recommended)</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Fetches from /api/assets endpoint</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSyncMode("database")}
                  className={`p-3 rounded-xl border text-left transition ${
                    syncMode === "database"
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                      : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 text-gray-700 dark:text-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold">Direct Database</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Queries shared MariaDB host directly</p>
                </button>
              </div>
            </div>

            {/* Server URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Pixxel Instance URL
              </label>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://192.168.100.228:3030"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                required
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                The base URL of your Pixxel server instance (e.g. http://192.168.100.228:3030).
              </p>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Pixxel API Key / Bearer Token
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.has_api_key ? `Configured: ${config.api_key_masked}` : "Paste API key (pxk_...)"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {config?.has_api_key
                  ? "An API key is currently saved. Enter a new key only if you wish to change it."
                  : "Required for REST API sync mode."}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-semibold text-gray-700 dark:text-slate-200 transition disabled:opacity-50"
              >
                <svg className={`w-4 h-4 text-emerald-500 ${testing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {testing ? "Testing..." : "Test Connection"}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-semibold text-sm shadow-sm transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
