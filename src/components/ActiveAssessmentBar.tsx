"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface ActiveAssessment {
  id: string;
  category: string;
  status: string;
  approx_percent?: number;
  elapsed_seconds?: number;
  started_at?: string;
  created_at?: string;
  application: {
    id: string;
    name: string;
    short_code: string | null;
  };
}

export default function ActiveAssessmentBar() {
  const [activeList, setActiveList] = useState<ActiveAssessment[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function checkActive() {
      try {
        const res = await fetch("/api/assessments/active");
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setActiveList(data.active || []);
          }
        }
      } catch {}
    }

    checkActive();

    // Poll every 3 seconds if active, 8 seconds if idle
    const intervalTime = activeList.length > 0 ? 3000 : 8000;
    const interval = setInterval(checkActive, intervalTime);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeList.length]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (activeList.length === 0) {
    return null;
  }

  const primary = activeList[0];
  const count = activeList.length;
  const percent = primary.approx_percent ?? (primary.status === "cloning" ? 45 : primary.status === "analyzing" ? 80 : 15);

  const statusLabel =
    primary.status === "cloning"
      ? "Cloning Repo..."
      : primary.status === "analyzing"
      ? "AI Assessing..."
      : "Queued...";

  const formatElapsed = (sec?: number) => {
    if (sec === undefined || sec === null) return null;
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Top Bar Trigger Button with Spinner */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-cyan-500/15 to-emerald-500/10 border border-cyan-500/30 hover:border-cyan-500/60 shadow-sm text-xs font-medium text-gray-800 dark:text-slate-200 transition group focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        title="Assessment currently running. Click to view details."
        aria-label="Active assessment in progress"
      >
        {/* Spinning Progress Indicator */}
        <span className="relative flex items-center justify-center w-4 h-4">
          <svg
            className="animate-spin w-4 h-4 text-cyan-600 dark:text-cyan-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </span>

        {/* Short info: percent & app name */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="px-1.5 py-0.2 rounded-md bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-mono font-bold text-[11px]">
            {percent}%
          </span>
          <span className="font-semibold text-gray-900 dark:text-white max-w-[120px] truncate hidden sm:inline-block">
            {primary.application.name}
          </span>
          {count > 1 && (
            <span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">
              +{count - 1}
            </span>
          )}
        </div>

        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180 text-cyan-500" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover / Dropdown Dialog */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
              <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Assessment In Progress
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full font-semibold border border-cyan-200 dark:border-cyan-800/40">
              Live
            </span>
          </div>

          {/* Primary Assessment Details */}
          <div className="mt-3 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-slate-400">Application:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {primary.application.name}
                </span>
              </div>
              {primary.application.short_code && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-500 dark:text-slate-400">Short Code:</span>
                  <span className="font-mono text-[11px] text-gray-600 dark:text-slate-300">
                    {primary.application.short_code}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-500 dark:text-slate-400">Standard Category:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {primary.category}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-500 dark:text-slate-400">Current Phase:</span>
                <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                  {statusLabel}
                </span>
              </div>
              {primary.elapsed_seconds !== undefined && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-500 dark:text-slate-400">Elapsed Time:</span>
                  <span className="font-mono text-[11px] text-gray-600 dark:text-slate-300">
                    {formatElapsed(primary.elapsed_seconds)}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500 dark:text-slate-400 font-medium">Approx. Progress</span>
                <span className="font-bold font-mono text-cyan-600 dark:text-cyan-400">
                  {percent}%
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Link to Assessment */}
            <div className="pt-2 flex items-center justify-between gap-2">
              <Link
                href={`/assessments/${primary.id}`}
                onClick={() => setIsOpen(false)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white text-xs font-semibold shadow-sm transition"
              >
                <span>View Full Assessment</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Other Queued Assessments */}
          {count > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 mb-2">
                Also in queue ({count - 1}):
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {activeList.slice(1).map((item) => (
                  <Link
                    key={item.id}
                    href={`/assessments/${item.id}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 text-xs transition"
                  >
                    <span className="font-medium text-gray-800 dark:text-slate-200 truncate max-w-[180px]">
                      {item.application.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-mono">
                      {item.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
