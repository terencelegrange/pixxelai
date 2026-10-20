"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ActiveAssessment {
  id: string;
  category: string;
  status: string;
  application: {
    id: string;
    name: string;
    short_code: string | null;
  };
}

export default function ActiveAssessmentBar() {
  const [activeList, setActiveList] = useState<ActiveAssessment[]>([]);

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

    // Poll every 3 seconds if active, 7 seconds if idle
    const intervalTime = activeList.length > 0 ? 3000 : 7000;
    const interval = setInterval(checkActive, intervalTime);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeList.length]);

  if (activeList.length === 0) {
    return null;
  }

  const primary = activeList[0];
  const count = activeList.length;

  const statusLabel =
    primary.status === "cloning"
      ? "Cloning Repo..."
      : primary.status === "analyzing"
      ? "AI Assessing..."
      : "In Queue...";

  return (
    <Link
      href={`/assessments/${primary.id}`}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/15 via-cyan-500/15 to-emerald-500/15 border border-cyan-500/30 hover:border-cyan-500/60 shadow-sm text-xs font-medium text-gray-800 dark:text-slate-200 transition group mr-2 animate-pulse"
      title="Click to view live assessment progress"
    >
      {/* Spinning Indicator */}
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
      </span>

      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-cyan-600 dark:text-cyan-400 group-hover:underline">
          Review in progress:
        </span>
        <span className="font-medium text-gray-900 dark:text-white max-w-[140px] truncate">
          {primary.application.name}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-mono uppercase font-bold">
          {statusLabel}
        </span>
        {count > 1 && (
          <span className="text-[10px] text-gray-500 dark:text-slate-400">
            (+{count - 1} more)
          </span>
        )}
      </div>

      <svg
        className="w-3.5 h-3.5 text-cyan-500 group-hover:translate-x-0.5 transition-transform"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
