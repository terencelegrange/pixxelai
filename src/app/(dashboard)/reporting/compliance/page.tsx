"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StandardsRingChart, { RingArea } from "@/components/StandardsRingChart";

interface ApplicationOption {
  id: string;
  name: string;
  short_code: string | null;
  assessments_count: number;
  latest_score: number | null;
  last_assessed_at: string | null;
  areas?: RingArea[];
}

interface ComplianceSummary {
  latest_score: number | null;
  target_score: number;
  gap: number | null;
  trend: "improving" | "stable" | "declining" | "initial" | "no_data";
  total_controls: number;
  meets_count: number;
  partial_count: number;
  fails_count: number;
  na_count: number;
  open_tasks_count: number;
  completed_tasks_count: number;
  last_assessed_at: string | null;
}

interface GovernanceArea extends RingArea {
  status: string;
  last_assessed_at: string | null;
}

interface HistoryPoint {
  id: string;
  timestamp: string;
  formatted_date: string;
  full_date: string;
  score: number;
  category: string;
  items_count: number;
  meets_count: number;
  partial_count: number;
  fails_count: number;
  na_count: number;
  llm_model: string | null;
  status: string;
}

interface LatestControl {
  id: string;
  standard_id: string;
  title: string;
  category: string;
  result: string;
  severity: string;
  evidence: string | null;
  recommendation: string | null;
  task_status?: string | null;
}

interface AssessmentRun {
  id: string;
  category: string;
  status: string;
  compliance_score: number | null;
  items_count: number;
  meets_count: number;
  partial_count: number;
  fails_count: number;
  llm_provider: string | null;
  llm_model: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function ComplianceReportingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAppId = searchParams.get("appId");

  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [areas, setAreas] = useState<GovernanceArea[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [latestControls, setLatestControls] = useState<LatestControl[]>([]);
  const [allAssessments, setAllAssessments] = useState<AssessmentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<HistoryPoint | null>(null);
  const [filterResult, setFilterResult] = useState<string>("all");
  const [viewTab, setViewTab] = useState<"detail" | "portfolio">("detail");
  const [portfolioSearch, setPortfolioSearch] = useState<string>("");

  async function loadData(appId?: string | null) {
    setLoading(true);
    try {
      const url = appId ? `/api/reports/compliance?appId=${encodeURIComponent(appId)}` : "/api/reports/compliance";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
        setSelectedApp(data.selected_application || null);
        setSummary(data.compliance_summary || null);
        setAreas(data.areas || []);
        setHistory(data.history || []);
        setLatestControls(data.latest_controls || []);
        setAllAssessments(data.all_assessments || []);
      }
    } catch (err) {
      console.error("Failed to load compliance report data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(currentAppId);
  }, [currentAppId]);

  function handleSelectApp(newAppId: string) {
    router.push(`/reporting/compliance?appId=${encodeURIComponent(newAppId)}`);
    setViewTab("detail");
  }

  const filteredControls = useMemo(() => {
    if (filterResult === "all") return latestControls;
    return latestControls.filter((c) => c.result.toLowerCase().replace(/\s+/g, "_") === filterResult);
  }, [latestControls, filterResult]);

  const filteredPortfolioApps = useMemo(() => {
    if (!portfolioSearch.trim()) return applications;
    const query = portfolioSearch.toLowerCase().trim();
    return applications.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.short_code && a.short_code.toLowerCase().includes(query))
    );
  }, [applications, portfolioSearch]);

  // SVG coordinates for time-series trend chart
  const chartConfig = useMemo(() => {
    const width = 800;
    const height = 260;
    const padL = 65;
    const padR = 45;
    const padT = 35;
    const padB = 45;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const getY = (val: number) => {
      const clamped = Math.max(0, Math.min(100, val));
      return padT + plotH - (clamped / 100) * plotH;
    };

    if (history.length === 0) {
      return { width, height, padL, padR, padT, padB, plotW, plotH, getY, points: [], pathD: "", areaD: "" };
    }

    if (history.length === 1) {
      const singlePoint = history[0];
      const x = padL + plotW / 2;
      const y = getY(singlePoint.score);
      const points = [{ ...singlePoint, x, y }];
      return {
        width,
        height,
        padL,
        padR,
        padT,
        padB,
        plotW,
        plotH,
        getY,
        points,
        pathD: `M ${padL} ${y} L ${padL + plotW} ${y}`,
        areaD: `M ${padL} ${y} L ${padL + plotW} ${y} L ${padL + plotW} ${padT + plotH} L ${padL} ${padT + plotH} Z`,
      };
    }

    const points = history.map((pt, index) => {
      const x = padL + (index / (history.length - 1)) * plotW;
      const y = getY(pt.score);
      return { ...pt, x, y };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${padT + plotH} L ${points[0].x} ${padT + plotH} Z`;

    return { width, height, padL, padR, padT, padB, plotW, plotH, getY, points, pathD, areaD };
  }, [history]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
            <span>Reporting</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">Compliance</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            Standards Compliance Report
            {summary?.latest_score !== null && summary?.latest_score !== undefined && (
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                  summary.latest_score >= 80
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                    : summary.latest_score >= 50
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                    : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                }`}
              >
                {summary.latest_score}% Compliant
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Concentric standards closure rings and historical timeline heading towards 100% adherence.
          </p>
        </div>

        {/* Action Controls & Application Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Tab Switcher: Focused App vs Portfolio Overview */}
          <div className="flex items-center rounded-xl bg-gray-100 dark:bg-slate-800/80 p-1 border border-gray-200 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => setViewTab("detail")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                viewTab === "detail"
                  ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              App Deep Dive
            </button>
            <button
              onClick={() => setViewTab("portfolio")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                viewTab === "portfolio"
                  ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              All Apps Snapshot ({applications.length})
            </button>
          </div>

          {/* Application Selector Dropdown */}
          <div className="relative">
            <label htmlFor="app-select" className="sr-only">
              Select Application
            </label>
            <select
              id="app-select"
              value={selectedApp?.id || ""}
              onChange={(e) => handleSelectApp(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white text-sm font-semibold rounded-xl pl-4 pr-10 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} {app.latest_score !== null ? `(${app.latest_score}%)` : "(No review)"}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {selectedApp && (
            <Link
              href="/applications"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Run Review</span>
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-sm text-gray-500 dark:text-slate-400">
          <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Loading standards compliance metrics...
        </div>
      ) : !selectedApp ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
          <p className="text-base font-bold text-gray-900 dark:text-white">No applications found.</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Add an application first to track standards compliance.</p>
        </div>
      ) : viewTab === "portfolio" ? (
        /* PORTFOLIO SNAPSHOT MATRIX: Rings Graphic for EACH Application */
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                All Applications Standards Closure Snapshot
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Visualizing how closed the governance rings are across all registered apps ({applications.length} applications).
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search apps..."
                value={portfolioSearch}
                onChange={(e) => setPortfolioSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPortfolioApps.map((app) => {
              const isSelected = app.id === selectedApp?.id;
              const appAreas = app.areas && app.areas.length > 0 ? app.areas : areas.map((a) => ({ ...a, score: null }));

              return (
                <div
                  key={app.id}
                  onClick={() => handleSelectApp(app.id)}
                  className={`bg-white dark:bg-slate-900 border rounded-3xl p-5 shadow-xs transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-cyan-500 ring-2 ring-cyan-500/20 shadow-md"
                      : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white hover:text-cyan-600 transition truncate max-w-[200px]">
                          {app.name}
                        </h3>
                        {app.short_code && (
                          <span className="font-mono text-[10px] text-gray-400 dark:text-slate-500">
                            {app.short_code}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold font-mono ${
                          app.latest_score !== null && app.latest_score !== undefined
                            ? app.latest_score >= 80
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : app.latest_score >= 50
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                              : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-400"
                        }`}
                      >
                        {app.latest_score !== null && app.latest_score !== undefined ? `${app.latest_score}%` : "No Review"}
                      </span>
                    </div>

                    {/* Concentric Rings Chart Graphic for this Application */}
                    <div className="my-4 py-2 flex items-center justify-center bg-gray-50/60 dark:bg-slate-950/40 rounded-2xl border border-gray-100 dark:border-slate-800/60">
                      <StandardsRingChart
                        areas={appAreas}
                        size={150}
                        strokeWidth={7}
                        showLegend={false}
                        centerLabel="Closed"
                      />
                    </div>

                    {/* Compact areas indicators */}
                    <div className="space-y-1.5 pt-1">
                      {appAreas.map((area) => (
                        <div key={area.category} className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 dark:text-slate-400 truncate">
                            {area.category}
                          </span>
                          <span className="font-mono font-semibold text-gray-800 dark:text-slate-200">
                            {area.score !== null && area.score !== undefined ? `${area.score}%` : "Pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-gray-400">
                    <span>
                      {app.assessments_count > 0 ? `${app.assessments_count} review${app.assessments_count > 1 ? "s" : ""}` : "Not audited"}
                    </span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-semibold group-hover:underline flex items-center gap-1">
                      Deep Dive →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* DETAIL VIEW: Deep dive for selected application */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Latest Compliance Score */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Current Compliance</span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">Target: 100%</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {summary?.latest_score !== null && summary?.latest_score !== undefined
                    ? `${summary.latest_score}%`
                    : "--"}
                </span>
                {summary?.trend === "improving" && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                    ↑ Improving
                  </span>
                )}
                {summary?.trend === "initial" && (
                  <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                    Baseline
                  </span>
                )}
              </div>
              {/* Progress bar towards 100% */}
              <div className="mt-3">
                <div className="h-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${summary?.latest_score || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Gap to Target */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Gap to 100%</span>
                <span className="font-mono text-xs text-rose-500 font-bold">Deficit</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {summary?.gap !== null && summary?.gap !== undefined ? `-${summary.gap}%` : "--"}
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  to reach 100% target
                </span>
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
                {summary && summary.fails_count + summary.partial_count > 0
                  ? `${summary.fails_count + summary.partial_count} controls need remediation`
                  : "All assessed controls fully meeting baseline"}
              </p>
            </div>

            {/* Card 3: Controls Breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Controls Audited</span>
                <span className="font-mono text-gray-900 dark:text-white font-bold">
                  {summary?.total_controls || 0} Total
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {summary?.meets_count || 0}
                  </div>
                  <div className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-300">
                    Meets
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
                  <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                    {summary?.partial_count || 0}
                  </div>
                  <div className="text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-300">
                    Partial
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50">
                  <div className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                    {summary?.fails_count || 0}
                  </div>
                  <div className="text-[10px] uppercase font-semibold text-rose-700 dark:text-rose-300">
                    Fails
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Open Remediation Tasks */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">Workflow Tasks</span>
                  <Link
                    href="/tasks"
                    className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-semibold"
                  >
                    My Tasks →
                  </Link>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {summary?.open_tasks_count || 0}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    open for review
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
                {summary?.completed_tasks_count || 0} tasks resolved/approved
              </p>
            </div>
          </div>

          {/* STANDARDS CLOSURE SNAPSHOT (Concentric Rings Chart Graphic - Matching Uploaded Image) */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
                  Standards Closure Snapshot
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold font-mono">
                    Concentric Radial Rings
                  </span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Visual snapshot showing how &ldquo;closed&rdquo; the rings are for each active governance area on <strong className="text-gray-900 dark:text-white">{selectedApp.name}</strong>.
                </p>
              </div>

              <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-slate-700/60">
                {areas.length} {areas.length === 1 ? "Standard Area" : "Standard Areas"} Active (Feature Flagged)
              </div>
            </div>

            {/* Standards Ring Chart with Side Cards Stack */}
            <StandardsRingChart
              areas={areas}
              size={280}
              showLegend={true}
              centerLabel="Overall"
            />
          </div>

          {/* Time-Series Compliance Chart Section */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Compliance Percentage Over Time
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-semibold font-mono">
                    Heading towards 100%
                  </span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Historical assessments trend for <strong className="text-gray-900 dark:text-white">{selectedApp.name}</strong>.
                </p>
              </div>

              {/* Legend & Target Badge */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-500 border-dashed border-b-2 border-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                    100% Target
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 rounded-full bg-cyan-500" />
                  <span className="text-gray-600 dark:text-slate-300 font-medium">
                    Actual Score
                  </span>
                </div>
              </div>
            </div>

            {/* SVG Chart Rendering */}
            {history.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                <svg className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                  No historical assessments yet
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  Trigger an automated review to start tracking compliance over time.
                </p>
                <div className="mt-4">
                  <Link
                    href="/applications"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    Go to Applications & Run Review
                  </Link>
                </div>
              </div>
            ) : (
              <div className="relative">
                <svg
                  viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
                  className="w-full h-64 sm:h-72 select-none overflow-visible"
                >
                  <defs>
                    <linearGradient id="compliance-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                      <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>

                    <linearGradient id="compliance-stroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines & Y-axis labels */}
                  {[100, 75, 50, 25, 0].map((val) => {
                    const y = chartConfig.getY(val);
                    const isTarget = val === 100;

                    return (
                      <g key={val}>
                        <text
                          x={chartConfig.padL - 12}
                          y={y + 4}
                          textAnchor="end"
                          className="text-[11px] fill-gray-400 dark:fill-slate-500 font-mono font-medium"
                        >
                          {val}%
                        </text>
                        <line
                          x1={chartConfig.padL}
                          y1={y}
                          x2={chartConfig.width - chartConfig.padR}
                          y2={y}
                          stroke={isTarget ? "#10b981" : "currentColor"}
                          strokeWidth={isTarget ? 1.5 : 1}
                          strokeDasharray={isTarget ? "4 4" : "2 2"}
                          className={isTarget ? "opacity-80" : "text-gray-200 dark:text-slate-800 opacity-60"}
                        />
                      </g>
                    );
                  })}

                  <g transform={`translate(${chartConfig.width - chartConfig.padR + 6}, ${chartConfig.getY(100) + 4})`}>
                    <text
                      className="text-[10px] fill-emerald-600 dark:fill-emerald-400 font-bold font-mono"
                    >
                      GOAL 100%
                    </text>
                  </g>

                  {chartConfig.areaD && (
                    <path d={chartConfig.areaD} fill="url(#compliance-gradient)" />
                  )}

                  {chartConfig.pathD && (
                    <path
                      d={chartConfig.pathD}
                      fill="none"
                      stroke="url(#compliance-stroke)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {chartConfig.points.map((pt, idx) => {
                    const isLatest = idx === chartConfig.points.length - 1;
                    const isHovered = hoveredPoint?.id === pt.id;

                    return (
                      <g
                        key={pt.id}
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        className="cursor-pointer group"
                      >
                        {isLatest && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="12"
                            className="fill-cyan-400/20 animate-ping"
                          />
                        )}

                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? "7" : isLatest ? "6" : "5"}
                          className="fill-white dark:fill-slate-900 stroke-cyan-500 group-hover:stroke-emerald-400 transition-all"
                          strokeWidth="3"
                        />

                        <text
                          x={pt.x}
                          y={pt.y - 12}
                          textAnchor="middle"
                          className="text-[11px] font-bold fill-gray-900 dark:fill-white font-mono"
                        >
                          {pt.score}%
                        </text>

                        <text
                          x={pt.x}
                          y={chartConfig.height - 15}
                          textAnchor="middle"
                          className="text-[10px] fill-gray-400 dark:fill-slate-500 font-mono"
                        >
                          {pt.formatted_date}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {hoveredPoint && (
                  <div
                    className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl border border-gray-700 w-52"
                    style={{
                      left: `${chartConfig.points.find((p) => p.id === hoveredPoint.id)?.x ?? 0}px`,
                      top: `${chartConfig.points.find((p) => p.id === hoveredPoint.id)?.y ?? 0}px`,
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-gray-800 pb-1.5 mb-1.5">
                      <span className="font-bold text-cyan-400">{hoveredPoint.category} Review</span>
                      <span className="font-mono font-extrabold text-emerald-400">
                        {hoveredPoint.score}%
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px] text-gray-300">
                      <p>Date: {hoveredPoint.full_date}</p>
                      <p>Controls Passing: {hoveredPoint.meets_count} / {hoveredPoint.items_count}</p>
                      {hoveredPoint.llm_model && <p>Model: {hoveredPoint.llm_model}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls Checklist / Remediation Matrix */}
          {latestControls.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    Baseline Controls Checklist & Status
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Individual security and architecture controls audited in the latest review.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  {[
                    { key: "all", label: "All" },
                    { key: "meets", label: "Meets" },
                    { key: "partially_meets", label: "Partial" },
                    { key: "does_not_meet", label: "Fails" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setFilterResult(tab.key)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        filterResult === tab.key
                          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredControls.map((ctrl) => {
                  const isMeets = ctrl.result === "Meets";
                  const isPartial = ctrl.result === "Partially Meets";

                  const badgeClass = isMeets
                    ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50"
                    : isPartial
                    ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50"
                    : "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/50";

                  return (
                    <div key={ctrl.id} className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/20 transition">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-500 dark:text-slate-400">
                            {ctrl.standard_id}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {ctrl.title}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${badgeClass}`}>
                            {ctrl.result}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-medium">
                            {ctrl.severity}
                          </span>
                        </div>

                        {ctrl.evidence && (
                          <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed font-mono bg-gray-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800/80">
                            <strong>Evidence:</strong> {ctrl.evidence}
                          </p>
                        )}

                        {ctrl.recommendation && (
                          <p className="text-xs text-indigo-700 dark:text-cyan-300 font-medium">
                            <strong>Recommendation:</strong> {ctrl.recommendation}
                          </p>
                        )}
                      </div>

                      {ctrl.task_status && (
                        <div className="flex items-center gap-2 self-start md:self-center">
                          <span className="text-[11px] text-gray-500 dark:text-slate-400">
                            Task:
                          </span>
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/50">
                            {ctrl.task_status}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historical Assessment Runs Log */}
          {allAssessments.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Assessment Run History
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Every standards evaluation is permanently time-stamped to monitor progress towards 100% compliance.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 dark:bg-slate-800/50 text-gray-500 dark:text-slate-400 font-semibold border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3">Timestamp</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Compliance Score</th>
                      <th className="px-6 py-3">Controls Passing</th>
                      <th className="px-6 py-3">LLM Model</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {allAssessments.map((run) => (
                      <tr key={run.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="px-6 py-4 font-mono text-gray-900 dark:text-white">
                          {new Date(run.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-800 dark:text-slate-200">
                          {run.category}
                        </td>
                        <td className="px-6 py-4">
                          {run.compliance_score !== null ? (
                            <span className="font-bold font-mono text-sm text-cyan-600 dark:text-cyan-400">
                              {Math.round(run.compliance_score)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-slate-400">
                          {run.items_count > 0
                            ? `${run.meets_count} of ${run.items_count}`
                            : "--"}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-500 dark:text-slate-400">
                          {run.llm_model || "ollama / qwen2.5-coder"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              run.status === "completed"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                : run.status === "failed"
                                ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                                : "bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 animate-pulse"
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/assessments/${run.id}`}
                            className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold"
                          >
                            View Report →
                          </Link>
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
    </div>
  );
}
