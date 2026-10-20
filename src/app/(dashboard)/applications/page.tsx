"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Application {
  id: string;
  pixxel_asset_id: string | null;
  name: string;
  short_code: string | null;
  category: string;
  type: string;
  lifecycle_status: string;
  description: string | null;
  business_owner: string | null;
  technical_owner: string | null;
  vendor: string | null;
  app_url: string | null;
  doc_url: string | null;
  repo_url: string | null;
  knowledge_base_url: string | null;
  regulatory_sources: string | null;
  updated_at: string;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [configuredCount, setConfiguredCount] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [lifecycles, setLifecycles] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLifecycle, setSelectedLifecycle] = useState("all");

  // Edit Modal State
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [editRepoUrl, setEditRepoUrl] = useState("");
  const [editKbUrl, setEditKbUrl] = useState("");
  const [editRegSources, setEditRegSources] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Quick sync state
  const [syncing, setSyncing] = useState(false);

  async function loadApplications() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedLifecycle !== "all") params.set("lifecycle", selectedLifecycle);

      const res = await fetch(`/api/applications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
        setTotalCount(data.total || 0);
        setConfiguredCount(data.configured_count || 0);
        if (data.categories) setCategories(data.categories);
        if (data.lifecycles) setLifecycles(data.lifecycles);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
  }, [search, selectedCategory, selectedLifecycle]);

  function openEditModal(app: Application) {
    setEditingApp(app);
    setEditRepoUrl(app.repo_url || "");
    setEditKbUrl(app.knowledge_base_url || "");
    setEditRegSources(app.regulatory_sources || "");
    setEditDescription(app.description || "");
    setSaveMessage(null);
  }

  function closeEditModal() {
    setEditingApp(null);
    setSaveMessage(null);
  }

  async function handleSaveApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!editingApp) return;

    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/applications/${editingApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_url: editRepoUrl,
          knowledge_base_url: editKbUrl,
          regulatory_sources: editRegSources,
          description: editDescription,
        }),
      });

      if (res.ok) {
        setSaveMessage("Configuration saved successfully.");
        await loadApplications();
        setTimeout(() => closeEditModal(), 900);
      } else {
        const data = await res.json();
        setSaveMessage(`Error: ${data.error || "Failed to save"}`);
      }
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message || "Failed to save"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/settings/pixxel-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_now" }),
      });
      if (res.ok) {
        await loadApplications();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
            <span>Inventory</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">Applications</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Applications Directory
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Configure application repositories, knowledge bases, and regulatory sources for standards assessment.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleQuickSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? "Syncing..." : "Sync from Pixxel"}
          </button>
          <Link
            href="/settings/sync-to-pixxel"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-700 dark:text-slate-300 transition"
            title="Configure Pixxel Connection"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total Applications</span>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{totalCount}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Synchronized from Pixxel</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Configured for Review</span>
          <p className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 mt-1">{configuredCount}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Repo, KB, or regulatory source linked</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Active in Production</span>
          <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
            {applications.filter((a) => a.lifecycle_status.toLowerCase() === "production").length}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Live operational assets</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Pending Review</span>
          <p className="text-2xl font-extrabold text-amber-500 mt-1">{totalCount}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Ready for standard assessments</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search applications by name, code, vendor, or repo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Lifecycle Filter */}
          <select
            value={selectedLifecycle}
            onChange={(e) => setSelectedLifecycle(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          >
            <option value="all">All Lifecycles</option>
            {lifecycles.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-slate-400">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Loading applications directory...
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">No applications found</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Sync assets from your Pixxel instance or adjust your search filters to view applications.
            </p>
            <div className="mt-4">
              <button
                onClick={handleQuickSync}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm transition"
              >
                Sync Now from Pixxel
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-slate-300">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Application</th>
                  <th className="px-6 py-3.5">Category & Type</th>
                  <th className="px-6 py-3.5">Lifecycle</th>
                  <th className="px-6 py-3.5">Configured Sources</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">{app.name}</div>
                      {app.short_code && (
                        <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">
                          {app.short_code}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                        {app.category}
                      </span>
                      <span className="block text-xs text-gray-400 dark:text-slate-500 mt-1">
                        {app.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          app.lifecycle_status.toLowerCase() === "production"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {app.lifecycle_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {app.repo_url ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50" title={app.repo_url}>
                            Repo ✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-gray-400 dark:text-slate-600 bg-gray-50 dark:bg-slate-800/40">
                            No Repo
                          </span>
                        )}

                        {app.knowledge_base_url ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50" title={app.knowledge_base_url}>
                            KB ✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-gray-400 dark:text-slate-600 bg-gray-50 dark:bg-slate-800/40">
                            No KB
                          </span>
                        )}

                        {app.regulatory_sources ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50" title={app.regulatory_sources}>
                            Reg ✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-gray-400 dark:text-slate-600 bg-gray-50 dark:bg-slate-800/40">
                            No Reg
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(app)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-semibold text-gray-700 dark:text-slate-300 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Configure & Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Drawer / Modal */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Configure {editingApp.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Link repository, knowledge base, and regulatory sources for AI review.
                </p>
              </div>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveApplication} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {saveMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    saveMessage.startsWith("Error")
                      ? "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  }`}
                >
                  {saveMessage}
                </div>
              )}

              {/* 1. Repository URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  1. Source Code Repository URL (Git / Gitea / GitHub)
                </label>
                <input
                  type="text"
                  value={editRepoUrl}
                  onChange={(e) => setEditRepoUrl(e.target.value)}
                  placeholder="e.g. http://192.168.100.252:3000/terence/app.git"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                  Used by the assessment workflow to inspect source code and architecture against standards.
                </p>
              </div>

              {/* 2. Knowledge Base URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  2. Knowledge Base URL (Outline / Wiki / Documentation)
                </label>
                <input
                  type="text"
                  value={editKbUrl}
                  onChange={(e) => setEditKbUrl(e.target.value)}
                  placeholder="e.g. http://192.168.100.93:3000/doc/app-guide"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                  Documentation containing design rationale, data schemas, and operating procedures.
                </p>
              </div>

              {/* 3. Regulatory Sources */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  3. Regulatory Sources & Reference Websites
                </label>
                <textarea
                  rows={3}
                  value={editRegSources}
                  onChange={(e) => setEditRegSources(e.target.value)}
                  placeholder="e.g. https://gdpr-info.eu&#10;https://www.cyber.gov.au/essential-eight"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                  External regulatory authorities or industry compliance frameworks relevant to this application.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Description / Context Notes
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Application purpose, high-level context, or constraints..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Review workflow placeholder card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-transparent border border-indigo-500/20 dark:border-cyan-500/20">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-cyan-300 mb-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Standards Assessment Workflow
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
                  Once configured, clicking <strong>Review</strong> will trigger the assessment agent to scan the source code, knowledge base, and regulatory sources against your defined standards.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 text-xs font-semibold cursor-not-allowed"
                  >
                    Assess against Standards (Coming in next step)
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
