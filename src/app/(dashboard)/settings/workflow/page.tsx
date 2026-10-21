"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface WorkflowItem {
  id: string;
  category: string;
  standard_id: string | null;
  assigned_role: string;
  auto_create_tasks: number;
}

interface RoleOption {
  key: string;
  label: string;
  description: string;
}

interface StandardMeta {
  id: string;
  title: string;
  category: string;
  slug: string;
}

export default function WorkflowConfigPage() {
  const [configs, setConfigs] = useState<WorkflowItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [standards, setStandards] = useState<StandardMeta[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [res, flagsRes] = await Promise.all([
        fetch("/api/settings/workflow"),
        fetch("/api/feature-flags"),
      ]);

      if (flagsRes.ok) {
        const flagsData = await flagsRes.json();
        const flagMap: Record<string, boolean> = {};
        for (const [k, v] of Object.entries<any>(flagsData)) {
          flagMap[k] = v.enabled;
        }
        setFlags(flagMap);
      }

      if (res.ok) {
        const data = await res.json();
        setRoles(data.available_roles || []);
        setStandards(data.standards || []);
        const defaultCats = ["Security", "Architecture", "Privacy", "Compliance", "Legal", "Quality"];
        const resolvedCats = data.categories || defaultCats;
        setCategories(resolvedCats);

        // Build list of config items for every category
        const existingMap = new Map<string, WorkflowItem>();
        (data.configs || []).forEach((c: WorkflowItem) => {
          existingMap.set(c.category, c);
        });

        const merged: WorkflowItem[] = resolvedCats.map((cat: string) => {
          const norm = cat.toLowerCase();
          const defaultRole =
            norm === "architecture"
              ? "architecture"
              : norm === "quality"
              ? "developer"
              : "security";

          return (
            existingMap.get(cat) || {
              id: `wf-${norm.replace(/[^a-z0-9]/g, "-")}`,
              category: cat,
              standard_id: null,
              assigned_role: defaultRole,
              auto_create_tasks: 1,
            }
          );
        });

        setConfigs(merged);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleRoleChange(category: string, newRole: string) {
    setConfigs((prev) =>
      prev.map((item) => (item.category === category ? { ...item, assigned_role: newRole } : item))
    );
  }

  function handleToggleAutoCreate(category: string) {
    setConfigs((prev) =>
      prev.map((item) =>
        item.category === category ? { ...item, auto_create_tasks: item.auto_create_tasks ? 0 : 1 } : item
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/workflow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: "Workflow rules saved successfully! Tasks will automatically route to assigned roles." });
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ text: `Failed to save: ${data.error}`, error: true });
      }
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message}`, error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
            <Link href="/settings" className="hover:text-cyan-500 transition">
              Settings
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">Workflow Config</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Workflow & Task Routing Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Designate which specialist reviewer roles are assigned to each standard. Gaps found during assessments will generate tasks for those roles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/tasks"
            className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-300 transition"
          >
            Go to My Tasks →
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl text-sm font-semibold flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 ${
            message.error
              ? "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
      )}

      {/* Explanatory Info Card */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-transparent border border-indigo-500/20 dark:border-cyan-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-2.5 text-xs font-bold text-indigo-700 dark:text-cyan-300 uppercase tracking-wider mb-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How Standard Assignment & Task Workflows Work
        </div>
        <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
          When an application is reviewed against standards, any controls classified as <strong>Does Not Meet</strong> or <strong>Partially Meets</strong> automatically spawn actionable items in <strong>My Tasks</strong> for users in the assigned role (e.g. <em>Security</em>). Reviewers can approve, reject, seek clarification, assign directly to a developer, or trigger an isolated <strong>Re-check</strong> after fixes are pushed.
        </p>
      </div>

      {/* Workflow Assignment Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Standard Categories & Assigned Reviewer Roles
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Configure the default reviewer role and task creation behavior per governance category.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-slate-400">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Loading workflow rules...
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {configs.map((item) => {
              const matchedStandards = standards.filter((s) => s.category.toLowerCase() === item.category.toLowerCase());

              return (
                <div key={item.category} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-gray-50/50 dark:hover:bg-slate-800/20 transition">
                  <div className="space-y-1 md:max-w-md">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-gray-900 dark:text-white">
                        {item.category} Standards
                      </span>
                      {flags[`standards_${item.category.toLowerCase()}`] === false ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                          Disabled in Flags
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {matchedStandards.length > 0
                        ? `Includes: ${matchedStandards.map((s) => s.title).join(", ")}`
                        : "Baseline standards in this category will be routed according to this rule."}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Auto Create Tasks Toggle */}
                    <div className="flex items-center gap-2.5">
                      <label className="text-xs text-gray-600 dark:text-slate-400 font-medium">
                        Auto-generate Tasks:
                      </label>
                      <button
                        type="button"
                        onClick={() => handleToggleAutoCreate(item.category)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          item.auto_create_tasks ? "bg-cyan-600" : "bg-gray-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            item.auto_create_tasks ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Assigned Role Selector */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600 dark:text-slate-400 font-medium whitespace-nowrap">
                        Assigned Role:
                      </label>
                      <select
                        value={item.assigned_role}
                        onChange={(e) => handleRoleChange(item.category, e.target.value)}
                        className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {roles.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label} ({r.description})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50/70 dark:bg-slate-800/40 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Administrators have supervisory access to all tasks across every category.
          </span>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Workflow Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
