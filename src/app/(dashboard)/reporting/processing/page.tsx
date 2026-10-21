"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";

interface RunningAssessment {
  id: string;
  application_id: string;
  category: string;
  status: string;
  approx_percent: number;
  phase_label: string;
  elapsed_seconds: number;
  llm_provider: string | null;
  llm_model: string | null;
  started_at: string | null;
  created_at: string;
  application: {
    id: string;
    name: string;
    short_code: string | null;
    category: string;
    repo_url: string | null;
  };
}

interface QueuedAssessment {
  id: string;
  application_id: string;
  category: string;
  status: string;
  queue_position: number;
  wait_seconds: number;
  created_at: string;
  application: {
    id: string;
    name: string;
    short_code: string | null;
    category: string;
    repo_url: string | null;
  };
}

interface RecentAssessment {
  id: string;
  category: string;
  status: string;
  compliance_score: number | null;
  completed_at: string | null;
  created_at: string;
  application: {
    id: string;
    name: string;
    short_code: string | null;
  };
}

interface ProcessingStats {
  running_count: number;
  queued_count: number;
  total_in_flight: number;
  active_workers: number;
  estimated_wait_seconds: number;
}

export default function AssessmentProcessingPage() {
  const [stats, setStats] = useState<ProcessingStats>({
    running_count: 0,
    queued_count: 0,
    total_in_flight: 0,
    active_workers: 1,
    estimated_wait_seconds: 0,
  });
  const [running, setRunning] = useState<RunningAssessment[]>([]);
  const [queued, setQueued] = useState<QueuedAssessment[]>([]);
  const [recent, setRecent] = useState<RecentAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "running" | "queued" | "recent">("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  async function fetchQueueData(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/reporting/processing");
      if (res.ok) {
        const data = await res.json();
        if (isMountedRef.current) {
          setStats(data.stats || {
            running_count: 0,
            queued_count: 0,
            total_in_flight: 0,
            active_workers: 1,
            estimated_wait_seconds: 0,
          });
          setRunning(data.running || []);
          setQueued(data.queued || []);
          setRecent(data.recent || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch assessment processing queue:", err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    fetchQueueData();

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchQueueData();
      }, 3000);
    }

    return () => {
      isMountedRef.current = false;
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  async function handleCancelQueued(id: string, appName: string) {
    if (!confirm(`Are you sure you want to dequeue and cancel the assessment for "${appName}"?`)) {
      return;
    }

    setCancellingId(id);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/reporting/processing?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setActionMessage(`Cancelled assessment for ${appName}.`);
        await fetchQueueData(true);
      } else {
        const data = await res.json();
        setActionMessage(`Error: ${data.error || "Failed to cancel assessment"}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message || "Failed to cancel"}`);
    } finally {
      setCancellingId(null);
      setTimeout(() => {
        if (isMountedRef.current) setActionMessage(null);
      }, 4000);
    }
  }

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  function getCategoryColor(category: string): string {
    switch (category.toLowerCase()) {
      case "security":
        return "bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60";
      case "architecture":
        return "bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60";
      case "compliance":
        return "bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60";
      case "quality":
        return "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60";
      case "privacy":
        return "bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60";
      case "legal":
        return "bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60";
      default:
        return "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700";
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
            <span>Reporting</span>
            <span aria-hidden="true">/</span>
            <span className="text-gray-900 dark:text-white font-medium">Processing</span>
          </nav>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            Assessment Processing Queue
            {stats.running_count > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-bold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                {stats.running_count} Active
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Live telemetry of active AI assessments, cloning workers, and queued jobs.
          </p>
        </div>

        {/* Action Controls: Live Polling Toggle + Refresh */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            aria-label={autoRefresh ? "Pause auto-refresh polling" : "Resume auto-refresh polling"}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              autoRefresh
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {autoRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  autoRefresh ? "bg-emerald-500" : "bg-gray-400"
                }`}
              ></span>
            </span>
            {autoRefresh ? "Live Polling (3s)" : "Polling Paused"}
          </button>

          <button
            onClick={() => fetchQueueData(true)}
            disabled={refreshing}
            aria-label="Refresh queue data"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 text-xs font-semibold shadow-xs hover:bg-gray-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-500" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          <Link
            href="/applications"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Queue New Assessment</span>
          </Link>
        </div>
      </div>

      {/* Action/Feedback Banner */}
      {actionMessage && (
        <div
          role="status"
          className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200 text-xs font-medium flex items-center justify-between"
        >
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-cyan-600 dark:text-cyan-400 hover:underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Currently Running */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Actively Running
            </span>
            <div
              className={`p-2 rounded-xl ${
                stats.running_count > 0
                  ? "bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
              }`}
            >
              <svg
                className={`w-5 h-5 ${stats.running_count > 0 ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {stats.running_count}
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {stats.running_count === 1 ? "assessment running" : "assessments running"}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Concurrency: up to {stats.active_workers} parallel workers
          </p>
        </div>

        {/* Card 2: Queued Backlog */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Queued Backlog
            </span>
            <div
              className={`p-2 rounded-xl ${
                stats.queued_count > 0
                  ? "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {stats.queued_count}
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              in queue
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            FIFO priority scheduling
          </p>
        </div>

        {/* Card 3: Estimated Queue Latency */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Est. Backlog Wait
            </span>
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {stats.estimated_wait_seconds > 0 ? formatDuration(stats.estimated_wait_seconds) : "0s"}
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {stats.queued_count > 0 ? "total backlog" : "no wait"}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            ~35 seconds per assessment
          </p>
        </div>

        {/* Card 4: System Telemetry Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Queue Status
            </span>
            <div
              className={`p-2 rounded-xl ${
                stats.running_count > 0
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-lg font-bold ${
                stats.running_count > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : stats.queued_count > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {stats.running_count > 0
                ? "Processing Active"
                : stats.queued_count > 0
                ? "Backlogged"
                : "Idle / Standing By"}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {stats.total_in_flight} total assessments in flight
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "all"
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
              : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          All In-Flight ({stats.total_in_flight})
        </button>
        <button
          onClick={() => setActiveTab("running")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "running"
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
              : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Running ({stats.running_count})
        </button>
        <button
          onClick={() => setActiveTab("queued")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "queued"
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
              : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Queued Backlog ({stats.queued_count})
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "recent"
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
              : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Recent Activity ({recent.length})
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-sm text-gray-500 dark:text-slate-400">
          <svg
            className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Loading assessment processing queue...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Actively Running Assessments */}
          {(activeTab === "all" || activeTab === "running") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {running.length > 0 && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        running.length > 0 ? "bg-cyan-500" : "bg-gray-400"
                      }`}
                    ></span>
                  </span>
                  Actively Running Assessments ({running.length})
                </h2>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  Updated in real-time
                </span>
              </div>

              {running.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-800 text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">
                    No assessments currently executing.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                    When an assessment is initiated, it will appear here with live progress and cloning status.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {running.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400">
                            <svg
                              className="w-5 h-5 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                {item.application.name}
                              </h3>
                              {item.application.short_code && (
                                <span className="text-xs px-2 py-0.5 rounded-md font-mono font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                                  {item.application.short_code}
                                </span>
                              )}
                              <span
                                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getCategoryColor(
                                  item.category
                                )}`}
                              >
                                {item.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                              <span>Elapsed: {formatDuration(item.elapsed_seconds)}</span>
                              <span>•</span>
                              <span className="font-mono">
                                Model: {item.llm_model || item.llm_provider || "Standard Engine"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <Link
                            href={`/applications`}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                          >
                            View App
                          </Link>
                        </div>
                      </div>

                      {/* Phase description and Progress Bar */}
                      <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                            {item.status === "cloning" ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            )}
                            {item.phase_label}
                          </span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {item.approx_percent}%
                          </span>
                        </div>

                        {/* Visual Progress Bar */}
                        <div
                          role="progressbar"
                          aria-valuenow={item.approx_percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Assessment progress for ${item.application.name}`}
                          className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"
                        >
                          <div
                            className="bg-gradient-to-r from-cyan-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${item.approx_percent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Queued Assessments (Backlog) */}
          {(activeTab === "all" || activeTab === "queued") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Queued Backlog ({queued.length})
                </h2>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  Will start automatically as workers free up
                </span>
              </div>

              {queued.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-800 text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">
                    No assessments currently queued.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                    All submitted assessments have either commenced or completed.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <tr>
                          <th scope="col" className="px-5 py-3.5">
                            Position
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Application
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Standard Category
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Wait Duration
                          </th>
                          <th scope="col" className="px-5 py-3.5 text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 text-gray-900 dark:text-slate-200">
                        {queued.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                #{item.queue_position} {item.queue_position === 1 ? "(Next)" : ""}
                              </span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="font-bold text-gray-900 dark:text-white">
                                {item.application.name}
                              </div>
                              {item.application.short_code && (
                                <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                                  {item.application.short_code}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-semibold border ${getCategoryColor(
                                  item.category
                                )}`}
                              >
                                {item.category}
                              </span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap font-mono text-gray-600 dark:text-slate-400">
                              {formatDuration(item.wait_seconds)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-right">
                              <button
                                onClick={() => handleCancelQueued(item.id, item.application.name)}
                                disabled={cancellingId === item.id}
                                aria-label={`Cancel queued assessment for ${item.application.name}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-xs font-semibold transition disabled:opacity-50"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>{cancellingId === item.id ? "Cancelling..." : "Cancel"}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Recent Activity (History) */}
          {(activeTab === "all" || activeTab === "recent") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Recent Executions ({recent.length})
                </h2>
                <Link
                  href="/assessments"
                  className="text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:underline"
                >
                  View All Assessment Reports &rarr;
                </Link>
              </div>

              {recent.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-800 text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">
                    No recent assessment history found.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recent.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getCategoryColor(
                              item.category
                            )}`}
                          >
                            {item.category}
                          </span>
                          <span
                            className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              item.status === "completed"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white pt-1">
                          {item.application.name}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100 dark:border-slate-800">
                        {item.status === "completed" && item.compliance_score !== null ? (
                          <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                            {item.compliance_score}% Score
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-slate-400">Review Terminated</span>
                        )}

                        <Link
                          href={`/assessments/${item.id}`}
                          className="font-semibold text-indigo-600 dark:text-cyan-400 hover:underline"
                        >
                          Report &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Clean State: If all queues are empty */}
          {running.length === 0 && queued.length === 0 && (
            <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-50/50 via-cyan-50/30 to-transparent dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/50 border border-gray-200 dark:border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                All Assessment Queues Clear
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                There are no active or pending assessments. All AI review workers are idle and ready for new application repositories.
              </p>
              <div className="pt-2">
                <Link
                  href="/applications"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  Go to Applications
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
