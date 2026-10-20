"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface AssessmentSummary {
  id: string;
  application_id: string;
  category: string;
  status: string;
  compliance_score: number | null;
  summary: string | null;
  items_count: number;
  meets_count: number;
  partial_count: number;
  fails_count: number;
  na_count: number;
  llm_provider: string | null;
  llm_model: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  application: {
    id: string;
    name: string;
    short_code: string | null;
    category: string;
    type: string;
    lifecycle_status: string;
    repo_url: string | null;
  };
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  async function loadAssessments() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterStatus !== "all") params.set("status", filterStatus);

      const res = await fetch(`/api/assessments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssessments(data.assessments || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssessments();
    // Poll periodically in case assessments are running
    const interval = setInterval(loadAssessments, 5000);
    return () => clearInterval(interval);
  }, [filterCategory, filterStatus]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the assessment report for ${name}?`)) return;
    try {
      const res = await fetch(`/api/assessments?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadAssessments();
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Filtered in-memory for search
  const filtered = assessments.filter((a) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.application.name.toLowerCase().includes(term) ||
      (a.application.short_code && a.application.short_code.toLowerCase().includes(term)) ||
      a.category.toLowerCase().includes(term) ||
      (a.summary && a.summary.toLowerCase().includes(term))
    );
  });

  // Calculate high level metrics
  const completedAssessments = assessments.filter((a) => a.status === "completed");
  const inProgressAssessments = assessments.filter((a) => ["queued", "cloning", "analyzing"].includes(a.status));
  const avgScore =
    completedAssessments.length > 0
      ? Math.round(
          completedAssessments.reduce((sum, a) => sum + (a.compliance_score || 0), 0) /
            completedAssessments.length
        )
      : null;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
            <span>Governance & Advice</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">Assessments</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Standards Assessments
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Automated compliance and architecture reviews evaluated by LLM against defined baseline standards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/applications"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white text-sm font-semibold shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Review Application
          </Link>
        </div>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Total Reviews Run
          </span>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{assessments.length}</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">All recorded evaluations</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Average Compliance Score
          </span>
          <p className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 mt-1">
            {avgScore !== null ? `${avgScore}%` : "—"}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Across {completedAssessments.length} completed assessments
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Active in Progress
          </span>
          <p className="text-2xl font-extrabold text-amber-500 mt-1">
            {inProgressAssessments.length}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {inProgressAssessments.length > 0 ? "Analyzing repository codebase" : "No active reviews"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Standards Evaluated
          </span>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">Security</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Application Security Baseline</p>
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
            placeholder="Filter reviews by application name, category, or findings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="analyzing">In Progress / Analyzing</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          >
            <option value="all">All Categories</option>
            <option value="Security">Security</option>
            <option value="Architecture" disabled>Architecture (Coming Soon)</option>
            <option value="Privacy" disabled>Privacy (Coming Soon)</option>
            <option value="Compliance" disabled>Compliance (Coming Soon)</option>
          </select>
        </div>
      </div>

      {/* Assessments List Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading && assessments.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-slate-400">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Loading assessments...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">No assessments found</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Go to the Applications page and click Review on an application to generate a standards assessment report.
            </p>
            <div className="mt-4">
              <Link
                href="/applications"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm transition"
              >
                Go to Applications
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-slate-300">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Application</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Compliance Score</th>
                  <th className="px-6 py-3.5">Controls Breakdown</th>
                  <th className="px-6 py-3.5">Status & Engine</th>
                  <th className="px-6 py-3.5">Completed</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filtered.map((a) => {
                  const isRunning = ["queued", "cloning", "analyzing"].includes(a.status);
                  const isFailed = a.status === "failed";

                  return (
                    <tr key={a.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <Link
                          href={`/assessments/${a.id}`}
                          className="font-semibold text-gray-900 dark:text-white hover:text-cyan-500 transition flex items-center gap-1.5"
                        >
                          {a.application.name}
                        </Link>
                        {a.application.short_code && (
                          <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">
                            {a.application.short_code}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                          {a.category}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {isRunning ? (
                          <span className="text-xs text-amber-500 flex items-center gap-1.5 font-medium">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                            Calculating...
                          </span>
                        ) : isFailed ? (
                          <span className="text-xs text-rose-500 font-medium">Failed</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-base font-extrabold ${
                                (a.compliance_score || 0) >= 80
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : (a.compliance_score || 0) >= 50
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {a.compliance_score !== null ? `${a.compliance_score}%` : "—"}
                            </span>
                            <div className="w-16 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  (a.compliance_score || 0) >= 80
                                    ? "bg-emerald-500"
                                    : (a.compliance_score || 0) >= 50
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(100, a.compliance_score || 0)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isRunning ? (
                          <span className="text-xs text-gray-400 italic">Inspecting controls...</span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {a.meets_count} Meets
                            </span>
                            {a.partial_count > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                {a.partial_count} Partial
                              </span>
                            )}
                            {a.fails_count > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                {a.fails_count} Fails
                              </span>
                            )}
                            {a.na_count > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400">
                                {a.na_count} N/A
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 animate-pulse">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {a.status === "cloning" ? "Cloning Repo" : "Analyzing Code"}
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            Failed
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              ✓ Completed
                            </span>
                            {a.llm_provider && (
                              <span className="block text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                                {a.llm_provider} ({a.llm_model})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-500 dark:text-slate-400">
                        {a.completed_at ? new Date(a.completed_at).toLocaleDateString() : new Date(a.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/assessments/${a.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-semibold text-gray-700 dark:text-slate-300 transition"
                          >
                            View Report
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => handleDelete(a.id, a.application.name)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                            title="Delete report"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
