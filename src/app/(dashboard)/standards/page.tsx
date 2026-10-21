"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Standard {
  id: string;
  category: string;
  title: string;
  slug: string;
  description: string | null;
  content: string;
  source: string;
  item_count: number;
  updated_at: string;
}

export default function StandardsPage() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // New Standard Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Architecture");
  const [newSlug, setNewSlug] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadStandards() {
    setLoading(true);
    try {
      const url = selectedCategory === "all" ? "/api/standards" : `/api/standards?category=${encodeURIComponent(selectedCategory)}`;
      const [res, flagsRes] = await Promise.all([
        fetch(url),
        fetch("/api/feature-flags"),
      ]);

      if (res.ok) {
        const data = await res.json();
        setStandards(data.standards || []);
        if (data.categories) setCategories(data.categories);
      }
      if (flagsRes.ok) {
        const flagsData = await flagsRes.json();
        const flagMap: Record<string, boolean> = {};
        for (const [k, v] of Object.entries<any>(flagsData)) {
          flagMap[k] = v.enabled;
        }
        setFlags(flagMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStandards();
  }, [selectedCategory]);

  async function handleSyncPixxel360() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/settings/pixxel360-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_now" }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Successfully synced ${data.controls_count} security controls from Pixxel360!`);
        await loadStandards();
      } else {
        setSyncMessage(`Sync failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setSyncMessage(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreateStandard(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/standards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          slug: newSlug || undefined,
          description: newDescription,
          content: newContent || `# ${newTitle}\n\nStandard guidelines and requirements.\n\n## Controls Checklist\n- [ ] Initial requirement\n`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setNewTitle("");
        setNewDescription("");
        setNewContent("");
        setNewSlug("");
        await loadStandards();
      } else {
        setCreateError(data.error || "Failed to create standard");
      }
    } catch (err: any) {
      setCreateError(err.message || "Failed to create standard");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
            <span>Governance</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">Standards</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Standards & Baselines
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Define and manage assessment baselines across Security, Architecture, Privacy, and Compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncPixxel360}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-semibold text-gray-700 dark:text-slate-200 transition disabled:opacity-50"
          >
            <svg className={`w-4 h-4 text-emerald-500 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? "Syncing..." : "Sync Security Controls"}
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white text-sm font-semibold shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Standard
          </button>
        </div>
      </div>

      {/* Sync Message Alert */}
      {syncMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {syncMessage}
          </div>
          <button onClick={() => setSyncMessage(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {Array.from(new Set(["all", "Security", "Architecture", "Privacy", "Compliance", "Legal", "Quality", ...categories])).map((cat) => {
          const catKey = `standards_${cat.toLowerCase()}`;
          const isCatDisabled = cat !== "all" && flags[catKey] === false;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
                  : "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>{cat === "all" ? "All Categories" : cat}</span>
              {isCatDisabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Disabled in Feature Flags" />
              )}
            </button>
          );
        })}
      </div>

      {/* Standards Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500 dark:text-slate-400">
          <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Loading standards...
        </div>
      ) : standards.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">No standards found in this category.</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Create a new standard or switch categories.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {standards.map((std) => {
            const isSecurity = std.slug === "security" || std.category.toLowerCase() === "security";
            const normCat = std.category.toLowerCase();
            const flagKey = `standards_${normCat}`;
            const isFlagDisabled = flags[flagKey] === false;

            const badgeColor =
              normCat === "security"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : normCat === "architecture"
                ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
                : normCat === "privacy"
                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                : normCat === "legal"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                : normCat === "quality"
                ? "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";

            return (
              <div
                key={std.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm flex flex-col justify-between transition ${
                  isFlagDisabled
                    ? "border-dashed border-rose-300 dark:border-rose-900/60 opacity-80"
                    : "border-gray-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}>
                        {std.category}
                      </span>
                      {isFlagDisabled && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                          Flag Disabled
                        </span>
                      )}
                    </div>
                    {std.source === "pixxel360" ? (
                      <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                        Pixxel360 Synced
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 dark:text-slate-500">
                        Custom
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                    {std.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {std.description || "Markdown baseline specification and compliance controls."}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                    <span className="font-bold text-gray-900 dark:text-white">{std.item_count}</span> controls / items
                  </div>

                  <Link
                    href={`/standards/${std.slug || std.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700/80 text-xs font-semibold text-gray-800 dark:text-slate-200 transition"
                  >
                    View & Edit
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Standard Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Standard</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Define a new assessment baseline in Markdown format.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStandard} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-xs font-semibold">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Security">Security</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Privacy">Privacy</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Legal">Legal</option>
                    <option value="Quality">Quality</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Standard Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Microservice Architecture Principles"
                    value={newTitle}
                    onChange={(e) => {
                      setNewTitle(e.target.value);
                      if (!newSlug) {
                        setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  placeholder="Summary of this standard's intent and scope..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Markdown Content Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Standard Specification (Markdown format)
                  </label>
                  <div className="flex items-center rounded-lg border border-gray-200 dark:border-slate-700 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditorTab("edit")}
                      className={`px-2.5 py-0.5 rounded-md font-medium ${editorTab === "edit" ? "bg-indigo-600 text-white" : "text-gray-500"}`}
                    >
                      Markdown Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab("preview")}
                      className={`px-2.5 py-0.5 rounded-md font-medium ${editorTab === "preview" ? "bg-indigo-600 text-white" : "text-gray-500"}`}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {editorTab === "edit" ? (
                  <textarea
                    rows={10}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder={`# Architecture Standard\n\n## 1. Principles\n- Stateless services\n- Asynchronous communication\n\n## 2. Review Checklist\n- [ ] Database credentials isolated\n- [ ] Resilient retry patterns with exponential backoff\n`}
                    className="w-full px-3.5 py-2.5 rounded-xl font-mono text-xs border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 text-xs font-mono text-gray-700 dark:text-slate-300 min-h-[200px] whitespace-pre-wrap">
                    {newContent || <span className="text-gray-400 italic">No content typed yet. Switch to Editor tab to write standard.</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
                >
                  {creating ? "Saving..." : "Create Standard"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
