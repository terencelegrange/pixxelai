"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { marked } from "marked";

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

export default function StandardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [standard, setStandard] = useState<Standard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTab, setEditTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Syncing state (for security standard)
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Deleting state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function fetchStandard() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/standards/${id}`);
      if (res.ok) {
        const data = await res.json();
        setStandard(data.standard);
        setEditTitle(data.standard.title);
        setEditCategory(data.standard.category);
        setEditDescription(data.standard.description || "");
        setEditContent(data.standard.content);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to load standard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load standard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStandard();
  }, [id]);

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!standard) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/standards/${standard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          category: editCategory,
          description: editDescription,
          content: editContent,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStandard(data.standard);
        setSaveSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to save changes");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

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
        setSyncMessage(`Synced ${data.controls_count} security controls from Pixxel360!`);
        await fetchStandard();
      } else {
        setSyncMessage(`Sync failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setSyncMessage(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!standard) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/standards/${standard.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/standards");
      } else {
        setError(data.error || "Failed to delete standard");
        setShowDeleteConfirm(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete standard");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  function insertSnippet(snippet: string) {
    setEditContent((prev) => prev + "\n" + snippet);
  }

  const renderedHtml = useMemo(() => {
    if (!standard?.content) return "";
    try {
      return marked.parse(standard.content, { breaks: true, gfm: true }) as string;
    } catch {
      return standard.content;
    }
  }, [standard?.content]);

  const previewHtml = useMemo(() => {
    try {
      return marked.parse(editContent, { breaks: true, gfm: true }) as string;
    } catch {
      return editContent;
    }
  }, [editContent]);

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-gray-500 dark:text-slate-400">
        <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Loading standard...
      </div>
    );
  }

  if (error && !standard) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
          ✕
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Standard Not Found</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">{error}</p>
        <Link
          href="/standards"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
        >
          ← Back to Standards Catalog
        </Link>
      </div>
    );
  }

  if (!standard) return null;

  const isSecurity = standard.slug === "security" || standard.category.toLowerCase() === "security";

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1">
            <Link href="/standards" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Standards
            </Link>
            <span>/</span>
            <span className="font-semibold text-gray-800 dark:text-slate-200">{standard.category}</span>
            <span>/</span>
            <span className="truncate max-w-[200px] text-gray-600 dark:text-slate-400">{standard.slug}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {standard.title}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                standard.category.toLowerCase() === "security"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : standard.category.toLowerCase() === "architecture"
                  ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                  : standard.category.toLowerCase() === "privacy"
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {standard.category}
            </span>
            {standard.source === "pixxel360" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                Pixxel360 Controls Source
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isSecurity && (
            <button
              onClick={handleSyncPixxel360}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-200 transition disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 text-emerald-500 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? "Re-syncing..." : "Re-sync Pixxel360"}
            </button>
          )}

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Standard
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditTitle(standard.title);
                  setEditCategory(standard.category);
                  setEditDescription(standard.description || "");
                  setEditContent(standard.content);
                }}
                className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {standard.slug !== "security" && !isEditing && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-xs font-semibold"
              title="Delete Standard"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Standard updated successfully!
        </div>
      )}

      {syncMessage && (
        <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {syncMessage}
          </div>
          <button onClick={() => setSyncMessage(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Total Controls / Items
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            {standard.item_count}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Category
          </div>
          <div className="text-sm font-bold text-gray-900 dark:text-white mt-2 truncate">
            {standard.category}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Identifier Slug
          </div>
          <div className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 mt-2 truncate">
            {standard.slug}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Last Updated
          </div>
          <div className="text-xs font-medium text-gray-600 dark:text-slate-400 mt-2">
            {new Date(standard.updated_at).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Description */}
      {standard.description && !isEditing && (
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 text-sm text-gray-600 dark:text-slate-300">
          <span className="font-semibold text-gray-900 dark:text-white mr-2">Purpose & Scope:</span>
          {standard.description}
        </div>
      )}

      {/* Main Content Area: View vs Edit */}
      {!isEditing ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div
            className="markdown-body text-gray-800 dark:text-slate-200"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      ) : (
        /* Edit Form */
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Standard Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Security">Security</option>
                <option value="Architecture">Architecture</option>
                <option value="Privacy">Privacy</option>
                <option value="Compliance">Compliance</option>
                <option value="Governance">Governance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Description / Summary
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Markdown Editor Toolbar */}
          <div className="pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 mr-2">Markdown Content</span>
                <button
                  type="button"
                  onClick={() => insertSnippet("## New Section\n")}
                  className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-[11px] font-mono text-gray-700 dark:text-slate-300"
                >
                  + Header
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("- [ ] **REQ-01**: New control requirement\n")}
                  className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-[11px] font-mono text-gray-700 dark:text-slate-300"
                >
                  + Checklist Item
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("| Control ID | Title | Description |\n|---|---|---|\n| CTL-01 | Sample | Details |\n")}
                  className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-[11px] font-mono text-gray-700 dark:text-slate-300"
                >
                  + Table
                </button>
              </div>

              <div className="flex items-center rounded-lg border border-gray-200 dark:border-slate-700 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEditTab("write")}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    editTab === "write" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
                  }`}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setEditTab("preview")}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    editTab === "preview" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
                  }`}
                >
                  Live Preview
                </button>
              </div>
            </div>

            {editTab === "write" ? (
              <textarea
                rows={22}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-4 py-3 rounded-xl font-mono text-xs border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            ) : (
              <div className="p-6 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 min-h-[400px]">
                <div
                  className="markdown-body text-gray-800 dark:text-slate-200 text-xs"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Standard</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{standard.title}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
