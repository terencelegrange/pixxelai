"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface FeatureFlag {
  key: string;
  enabled: boolean;
  label: string;
  description: string;
  category?: "system" | "standards";
}

const CATEGORY_ICONS: Record<string, { bg: string; text: string; icon: string }> = {
  standards_security: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/40",
    text: "text-indigo-600 dark:text-indigo-400",
    icon: "🛡️",
  },
  standards_architecture: {
    bg: "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800/40",
    text: "text-cyan-600 dark:text-cyan-400",
    icon: "🏛️",
  },
  standards_privacy: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: "🔒",
  },
  standards_compliance: {
    bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40",
    text: "text-amber-600 dark:text-amber-400",
    icon: "📋",
  },
  standards_legal: {
    bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40",
    text: "text-blue-600 dark:text-blue-400",
    icon: "⚖️",
  },
  standards_quality: {
    bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40",
    text: "text-purple-600 dark:text-purple-400",
    icon: "✨",
  },
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "standards" | "system">("all");
  const [searchQuery, setSearchQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/feature-flags");
      if (r.ok) {
        const data = await r.json();
        setFlags(Object.values(data));
      }
    } catch (err) {
      console.error("Failed to load feature flags:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(key: string, current: boolean) {
    setBusy(key);
    try {
      const res = await fetch(`/api/feature-flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !current }),
      });
      if (res.ok) {
        // Optimistic / local state update
        setFlags((prev) =>
          prev.map((f) => (f.key === key ? { ...f, enabled: !current } : f))
        );
      }
    } catch (err) {
      console.error(`Failed to toggle flag ${key}:`, err);
    } finally {
      setBusy(null);
    }
  }

  const standardsFlags = useMemo(() => {
    return flags.filter(
      (f) => f.category === "standards" || f.key.startsWith("standards_")
    );
  }, [flags]);

  const systemFlags = useMemo(() => {
    return flags.filter(
      (f) => f.category !== "standards" && !f.key.startsWith("standards_")
    );
  }, [flags]);

  const filterByQuery = (list: FeatureFlag[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q)
    );
  };

  const filteredStandards = useMemo(
    () => filterByQuery(standardsFlags),
    [standardsFlags, searchQuery]
  );
  const filteredSystem = useMemo(
    () => filterByQuery(systemFlags),
    [systemFlags, searchQuery]
  );

  const activeStandardsCount = standardsFlags.filter((f) => f.enabled).length;
  const activeSystemCount = systemFlags.filter((f) => f.enabled).length;

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header with Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
            <Link href="/settings" className="hover:text-gray-900 dark:hover:text-white transition">
              Settings
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">Feature Flags</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Feature Flags
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Dynamically toggle platform capabilities and active governance standards without redeploying.
          </p>
        </div>

        {/* Global Controls & Search */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search flags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-2.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "all"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          All Flags ({flags.length})
        </button>
        <button
          onClick={() => setActiveTab("standards")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === "standards"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>Standards & Governance</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === "standards" ? "bg-white/20 text-white" : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400"
          }`}>
            {activeStandardsCount}/{standardsFlags.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("system")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === "system"
              ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>System & Access Controls</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === "system" ? "bg-black/20 text-white" : "bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
          }`}>
            {activeSystemCount}/{systemFlags.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 animate-pulse"
            >
              <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
              <div className="h-3 w-64 bg-gray-100 dark:bg-slate-800 rounded mb-3" />
              <div className="h-2 w-20 bg-gray-100 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {/* SECTION 1: STANDARDS & GOVERNANCE */}
          {(activeTab === "all" || activeTab === "standards") && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </span>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Standards & Governance Flags
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                      {activeStandardsCount} Active
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Control which assessment standards and governance baselines are enforced during repository scans and task workflows.
                  </p>
                </div>
              </div>

              {filteredStandards.length === 0 ? (
                <div className="bg-gray-50 dark:bg-slate-900/50 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-gray-500">
                  No standards match your search criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStandards.map((f) => {
                    const iconMeta = CATEGORY_ICONS[f.key] || {
                      bg: "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700",
                      text: "text-gray-600 dark:text-gray-300",
                      icon: "📌",
                    };
                    const isBusy = busy === f.key;

                    return (
                      <div
                        key={f.key}
                        className={`relative rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                          f.enabled
                            ? "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md"
                            : "bg-gray-50/70 dark:bg-slate-900/40 border-gray-200 dark:border-slate-800/60 opacity-80"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`text-base p-1.5 rounded-xl border flex items-center justify-center ${iconMeta.bg}`}
                              >
                                {iconMeta.icon}
                              </span>
                              <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                  {f.label}
                                </h3>
                                <span
                                  className={`inline-block text-[10px] font-semibold uppercase tracking-wider ${
                                    f.enabled
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-gray-400 dark:text-slate-500"
                                  }`}
                                >
                                  {f.enabled ? "Standard Active" : "Disabled"}
                                </span>
                              </div>
                            </div>

                            {/* Toggle Switch */}
                            <button
                              onClick={() => toggle(f.key, f.enabled)}
                              disabled={isBusy}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                                f.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-700"
                              }`}
                              role="switch"
                              aria-checked={f.enabled}
                              aria-label={`Toggle ${f.label}`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  f.enabled ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>

                          <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed mb-4">
                            {f.description}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
                          <code className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                            {f.key}
                          </code>
                          <span className="font-medium">
                            {f.enabled ? "Evaluated in Reviews" : "Skipped in Reviews"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: SYSTEM & ACCESS CONTROLS */}
          {(activeTab === "all" || activeTab === "system") && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </span>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      System & Access Controls
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      {activeSystemCount} Active
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Control authentication capabilities, user self-registration, navigation menus, and forensic watermark overlays.
                  </p>
                </div>
              </div>

              {filteredSystem.length === 0 ? (
                <div className="bg-gray-50 dark:bg-slate-900/50 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-gray-500">
                  No system flags match your search criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSystem.map((f) => {
                    const isBusy = busy === f.key;

                    return (
                      <div
                        key={f.key}
                        className={`relative rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                          f.enabled
                            ? "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md"
                            : "bg-gray-50/70 dark:bg-slate-900/40 border-gray-200 dark:border-slate-800/60 opacity-80"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {f.label}
                              </h3>
                              <span
                                className={`inline-block text-[10px] font-semibold uppercase tracking-wider ${
                                  f.enabled
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-gray-400 dark:text-slate-500"
                                }`}
                              >
                                {f.enabled ? "Active" : "Disabled"}
                              </span>
                            </div>

                            {/* Toggle Switch */}
                            <button
                              onClick={() => toggle(f.key, f.enabled)}
                              disabled={isBusy}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                                f.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-700"
                              }`}
                              role="switch"
                              aria-checked={f.enabled}
                              aria-label={`Toggle ${f.label}`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  f.enabled ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>

                          <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed mb-4">
                            {f.description}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
                          <code className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                            {f.key}
                          </code>
                          <span className="font-medium">
                            {f.enabled ? "Enabled" : "Off"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

