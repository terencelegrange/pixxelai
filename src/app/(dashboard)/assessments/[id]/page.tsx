"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AssessmentItem {
  id: string;
  standard_id: string;
  title: string;
  category: string;
  result: "Meets" | "Partially Meets" | "Does Not Meet" | "Not Applicable";
  severity: string;
  evidence: string | null;
  recommendation: string | null;
}

interface AssessmentDetail {
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
    knowledge_base_url: string | null;
    regulatory_sources: string | null;
    app_url: string | null;
    doc_url: string | null;
    business_owner: string | null;
    technical_owner: string | null;
    vendor: string | null;
    description: string | null;
  };
  items: AssessmentItem[];
}

export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reRunning, setReRunning] = useState(false);
  const [resultFilter, setResultFilter] = useState<string>("all");

  async function fetchAssessment() {
    if (!id) return;
    try {
      const res = await fetch(`/api/assessments/${id}`);
      if (!res.ok) {
        if (res.status === 404) setError("Assessment report not found.");
        else setError("Failed to load assessment.");
        return;
      }
      const data = await res.json();
      setAssessment(data.assessment);
    } catch (err: any) {
      setError(err.message || "Failed to load assessment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAssessment();
  }, [id]);

  // Live polling while in progress
  useEffect(() => {
    if (!assessment) return;
    const isRunning = ["queued", "cloning", "analyzing"].includes(assessment.status);
    if (!isRunning) return;

    const interval = setInterval(() => {
      fetchAssessment();
    }, 2500);

    return () => clearInterval(interval);
  }, [assessment?.status]);

  async function handleReRun() {
    if (!assessment) return;
    setReRunning(true);
    try {
      const res = await fetch("/api/assessments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: assessment.application_id,
          category: assessment.category,
        }),
      });

      const data = await res.json();
      if (res.ok && data.assessment_id) {
        router.push(`/assessments/${data.assessment_id}`);
      } else {
        alert(data.error || "Failed to trigger re-run");
      }
    } catch (err: any) {
      alert(`Error re-running assessment: ${err.message}`);
    } finally {
      setReRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center">
        <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading assessment report...</p>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
          ✕
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">{error || "Assessment Not Found"}</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          The requested assessment report could not be found or has been deleted.
        </p>
        <div className="mt-4">
          <Link
            href="/assessments"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm transition"
          >
            ← Back to Assessments
          </Link>
        </div>
      </div>
    );
  }

  const isRunning = ["queued", "cloning", "analyzing"].includes(assessment.status);
  const isFailed = assessment.status === "failed";
  const app = assessment.application;

  const filteredItems = assessment.items.filter((item) => {
    if (resultFilter === "all") return true;
    return item.result.toLowerCase() === resultFilter.toLowerCase();
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <Link href="/assessments" className="hover:text-cyan-500 transition">
            Assessments
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">{app.name}</span>
          <span>/</span>
          <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{assessment.category}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReRun}
            disabled={isRunning || reRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${reRunning || isRunning ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {reRunning ? "Starting Review..." : "Re-run Assessment"}
          </button>
          <Link
            href="/assessments"
            className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-300 transition"
          >
            All Assessments
          </Link>
        </div>
      </div>

      {/* Primary Application Header */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                {app.name}
              </h1>
              {app.short_code && (
                <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-xs font-mono font-bold text-gray-700 dark:text-slate-300">
                  {app.short_code}
                </span>
              )}
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  app.lifecycle_status.toLowerCase() === "production"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                }`}
              >
                {app.lifecycle_status}
              </span>
            </div>

            <p className="text-sm text-gray-600 dark:text-slate-400 max-w-2xl">
              {app.description || "No application description provided."}
            </p>

            {/* Metadata pills */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400 pt-2 flex-wrap">
              {app.repo_url && (
                <span className="flex items-center gap-1.5" title={app.repo_url}>
                  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span className="font-mono text-gray-700 dark:text-slate-300 truncate max-w-xs">{app.repo_url}</span>
                </span>
              )}
              {app.vendor && (
                <span>Vendor: <strong className="text-gray-700 dark:text-slate-300 font-semibold">{app.vendor}</strong></span>
              )}
              {assessment.llm_provider && (
                <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Model: {assessment.llm_provider} ({assessment.llm_model})
                </span>
              )}
            </div>
          </div>

          {/* Compliance Score Gauge Card */}
          <div className="bg-gradient-to-br from-gray-50 to-indigo-50/30 dark:from-slate-800/60 dark:to-indigo-950/20 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center text-center min-w-[200px]">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Compliance Score
            </span>
            {isRunning ? (
              <div className="mt-2 py-1">
                <span className="text-sm font-bold text-amber-500 animate-pulse">Reviewing...</span>
                <p className="text-[11px] text-gray-400 mt-1">Live execution</p>
              </div>
            ) : isFailed ? (
              <div className="mt-2">
                <span className="text-xl font-bold text-rose-500">Failed</span>
                <p className="text-[11px] text-gray-400 mt-1">See error below</p>
              </div>
            ) : (
              <div className="mt-1">
                <div
                  className={`text-4xl font-black ${
                    (assessment.compliance_score || 0) >= 80
                      ? "text-emerald-600 dark:text-emerald-400"
                      : (assessment.compliance_score || 0) >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {assessment.compliance_score !== null ? `${assessment.compliance_score}%` : "—"}
                </div>
                <div className="flex items-center gap-1.5 mt-2 justify-center">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                    {assessment.meets_count} Meets
                  </span>
                  {assessment.partial_count > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                      {assessment.partial_count} Partial
                    </span>
                  )}
                  {assessment.fails_count > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300">
                      {assessment.fails_count} Fails
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category Tabs: Security | Architecture | etc */}
        <div className="mt-8 pt-5 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          <button
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-sm flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Security (Active)
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
              {assessment.items_count || 8}
            </span>
          </button>

          <button
            disabled
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 dark:text-slate-500 hover:text-gray-500 cursor-not-allowed bg-gray-50 dark:bg-slate-800/40 border border-transparent"
            title="Architecture standards reviews coming in next phase"
          >
            Architecture
            <span className="text-[10px] ml-1.5 opacity-60">(Planned)</span>
          </button>

          <button
            disabled
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 dark:text-slate-500 hover:text-gray-500 cursor-not-allowed bg-gray-50 dark:bg-slate-800/40 border border-transparent"
            title="Privacy standards reviews coming in next phase"
          >
            Privacy
            <span className="text-[10px] ml-1.5 opacity-60">(Planned)</span>
          </button>

          <button
            disabled
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 dark:text-slate-500 hover:text-gray-500 cursor-not-allowed bg-gray-50 dark:bg-slate-800/40 border border-transparent"
            title="Regulatory compliance reviews coming in next phase"
          >
            Compliance
            <span className="text-[10px] ml-1.5 opacity-60">(Planned)</span>
          </button>
        </div>
      </div>

      {/* In-Progress Live Status Card */}
      {isRunning && (
        <div className="bg-white dark:bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Assessment in Progress: {assessment.status.toUpperCase()}
                </h3>
                <span className="text-xs text-cyan-600 dark:text-cyan-400 font-mono font-semibold">
                  Updating live...
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {assessment.status === "cloning"
                  ? "Pulling repository into isolated temporary directory for source code inspection..."
                  : assessment.status === "analyzing"
                  ? "Passing application context and codebase to the active LLM engine for Security Baseline evaluation..."
                  : "Assessment queued for execution..."}
              </p>
            </div>
          </div>

          <div className="mt-4 w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-indigo-600 h-full transition-all duration-500"
              style={{
                width: assessment.status === "cloning" ? "45%" : assessment.status === "analyzing" ? "85%" : "15%",
              }}
            />
          </div>
        </div>
      )}

      {/* Failure Alert */}
      {isFailed && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-3xl p-6 text-rose-900 dark:text-rose-200">
          <h3 className="text-base font-bold flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Assessment Failed
          </h3>
          <p className="text-xs mt-2 font-mono bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50">
            {assessment.error_message || "An unexpected error occurred during execution."}
          </p>
          <div className="mt-4">
            <button
              onClick={handleReRun}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition"
            >
              Retry Assessment
            </button>
          </div>
        </div>
      )}

      {/* Executive Summary Box */}
      {assessment.summary && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-cyan-400 uppercase tracking-wider mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Executive Summary & Posture Analysis
          </div>
          <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {assessment.summary}
          </p>
        </div>
      )}

      {/* Control Results Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Security Controls Evaluation
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Results evaluated against the Application Security Baseline Standard.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setResultFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              resultFilter === "all"
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
                : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-800"
            }`}
          >
            All Controls ({assessment.items.length})
          </button>
          <button
            onClick={() => setResultFilter("Meets")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              resultFilter === "Meets"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-slate-800"
            }`}
          >
            Meets ({assessment.meets_count})
          </button>
          {assessment.partial_count > 0 && (
            <button
              onClick={() => setResultFilter("Partially Meets")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                resultFilter === "Partially Meets"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border border-gray-200 dark:border-slate-800"
              }`}
            >
              Partially Meets ({assessment.partial_count})
            </button>
          )}
          {assessment.fails_count > 0 && (
            <button
              onClick={() => setResultFilter("Does Not Meet")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                resultFilter === "Does Not Meet"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-gray-200 dark:border-slate-800"
              }`}
            >
              Does Not Meet ({assessment.fails_count})
            </button>
          )}
        </div>
      </div>

      {/* Control by Control Cards */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl text-xs text-gray-500 dark:text-slate-400">
            No controls match the selected filter.
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const isMeets = item.result === "Meets";
            const isPartial = item.result === "Partially Meets";
            const isFail = item.result === "Does Not Meet";
            const isNA = item.result === "Not Applicable";

            return (
              <div
                key={item.id || index}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-gray-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                      Standard {index + 1}: {item.standard_id}
                    </span>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Severity chip */}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        item.severity.toLowerCase() === "critical"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : item.severity.toLowerCase() === "high"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {item.severity}
                    </span>

                    {/* Result Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                        isMeets
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/20"
                          : isPartial
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-500/20"
                          : isFail
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-500/20"
                          : "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {isMeets && "✓"}
                      {isPartial && "⚠"}
                      {isFail && "✕"}
                      {item.result}
                    </span>
                  </div>
                </div>

                {/* Evidence & Findings */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Evidence & Observations
                    </span>
                    <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 text-xs text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {item.evidence || "No specific evidence recorded for this control."}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Remediation & Recommendation
                    </span>
                    <div className="p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {item.recommendation || "Ensure baseline controls remain maintained in production."}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
