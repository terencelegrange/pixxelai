"use client";

import React, { useMemo } from "react";

export interface RingArea {
  category: string;
  score: number | null;
  meets_count?: number;
  controls_count?: number;
  status?: string;
}

interface StandardsRingChartProps {
  areas: RingArea[];
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  centerLabel?: string;
  className?: string;
}

export const CATEGORY_COLORS: Record<
  string,
  { stroke: string; bg: string; text: string; darkBg: string }
> = {
  security: {
    stroke: "#10b981", // Emerald
    bg: "rgba(16, 185, 129, 0.15)",
    text: "text-emerald-600 dark:text-emerald-400",
    darkBg: "rgba(16, 185, 129, 0.25)",
  },
  architecture: {
    stroke: "#0284c7", // Sky blue
    bg: "rgba(2, 132, 199, 0.15)",
    text: "text-sky-600 dark:text-sky-400",
    darkBg: "rgba(2, 132, 199, 0.25)",
  },
  privacy: {
    stroke: "#8b5cf6", // Purple
    bg: "rgba(139, 92, 246, 0.15)",
    text: "text-purple-600 dark:text-purple-400",
    darkBg: "rgba(139, 92, 246, 0.25)",
  },
  compliance: {
    stroke: "#f59e0b", // Amber
    bg: "rgba(245, 158, 11, 0.15)",
    text: "text-amber-600 dark:text-amber-400",
    darkBg: "rgba(245, 158, 11, 0.25)",
  },
  legal: {
    stroke: "#f43f5e", // Rose / Red
    bg: "rgba(244, 63, 94, 0.15)",
    text: "text-rose-600 dark:text-rose-400",
    darkBg: "rgba(244, 63, 94, 0.25)",
  },
  quality: {
    stroke: "#ec4899", // Pink
    bg: "rgba(236, 72, 153, 0.15)",
    text: "text-pink-600 dark:text-pink-400",
    darkBg: "rgba(236, 72, 153, 0.25)",
  },
};

const DEFAULT_COLOR = {
  stroke: "#6366f1", // Indigo
  bg: "rgba(99, 102, 241, 0.15)",
  text: "text-indigo-600 dark:text-indigo-400",
  darkBg: "rgba(99, 102, 241, 0.25)",
};

export default function StandardsRingChart({
  areas,
  size = 280,
  strokeWidth,
  showLegend = true,
  centerLabel,
  className = "",
}: StandardsRingChartProps) {
  const n = Math.max(1, areas.length);
  const cx = size / 2;
  const cy = size / 2;

  // Responsive stroke width calculation based on size & number of rings
  const computedStrokeWidth =
    strokeWidth ?? (size > 160 ? Math.max(8, Math.min(14, Math.floor(64 / n))) : Math.max(4, Math.min(7, Math.floor(22 / n))));

  const gap = size > 160 ? Math.max(3, Math.min(6, Math.floor(20 / n))) : 2;

  // Calculate radius for each concentric ring (outer to inner)
  const rings = useMemo(() => {
    const maxR = cx - computedStrokeWidth / 2 - 4;
    const minR = Math.max(computedStrokeWidth * 1.5, maxR * 0.32);

    return areas.map((area, i) => {
      const r =
        n === 1
          ? maxR * 0.8
          : maxR - i * ((maxR - minR) / (n - 1 || 1));

      const circumference = 2 * Math.PI * r;
      const score = area.score !== null && area.score !== undefined ? Math.max(0, Math.min(100, area.score)) : 0;
      const isAssessed = area.score !== null && area.score !== undefined;
      const arcLength = isAssessed && score > 0 ? (score / 100) * circumference : 0;
      const isClosed = score >= 100;

      const normCat = area.category.toLowerCase().trim();
      const colorScheme = CATEGORY_COLORS[normCat] || DEFAULT_COLOR;

      return {
        ...area,
        r,
        circumference,
        score,
        isAssessed,
        arcLength,
        isClosed,
        colorScheme,
      };
    });
  }, [areas, cx, computedStrokeWidth, n]);

  // Overall average completion
  const overallAvg = useMemo(() => {
    const assessed = areas.filter((a) => a.score !== null && a.score !== undefined);
    if (assessed.length === 0) return null;
    const sum = assessed.reduce((acc, curr) => acc + (curr.score || 0), 0);
    return Math.round(sum / assessed.length);
  }, [areas]);

  return (
    <div className={`flex flex-col md:flex-row items-center justify-between gap-6 ${className}`}>
      {/* Concentric Rings SVG Canvas */}
      <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible select-none">
          {rings.map((ring, idx) => (
            <g key={ring.category}>
              {/* Full Background Track Ring (faint, showing total circle) */}
              <circle
                cx={cx}
                cy={cy}
                r={ring.r}
                fill="none"
                stroke="currentColor"
                strokeWidth={computedStrokeWidth}
                className="text-gray-200 dark:text-slate-800"
                strokeOpacity={0.45}
              />

              {/* Inactive track color tint matching the area */}
              <circle
                cx={cx}
                cy={cy}
                r={ring.r}
                fill="none"
                stroke={ring.colorScheme.stroke}
                strokeWidth={computedStrokeWidth}
                strokeOpacity={0.12}
              />

              {/* Progress Arc (Sweeping clockwise from top, closing towards 100%) */}
              {ring.isAssessed && ring.arcLength > 0 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={ring.r}
                  fill="none"
                  stroke={ring.colorScheme.stroke}
                  strokeWidth={computedStrokeWidth}
                  strokeDasharray={`${ring.arcLength} ${ring.circumference}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${cx} ${cy})`}
                  className="transition-all duration-700 ease-out"
                />
              )}

              {/* 100% Closure indicator star/sparkle if fully closed */}
              {ring.isClosed && size > 160 && (
                <circle
                  cx={cx}
                  cy={cy - ring.r}
                  r={computedStrokeWidth / 2}
                  fill="#ffffff"
                  stroke={ring.colorScheme.stroke}
                  strokeWidth="2"
                  className="shadow-sm"
                />
              )}
            </g>
          ))}
        </svg>

        {/* Center Donut Hole Content */}
        {size > 140 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
            {overallAvg !== null ? (
              <>
                <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white font-mono tracking-tight leading-none">
                  {overallAvg}%
                </span>
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mt-1">
                  {centerLabel || "Standards"}
                </span>
                <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  {overallAvg === 100 ? "100% Closed" : "Target: 100%"}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-bold text-gray-400 dark:text-slate-500 font-mono">
                  Pending
                </span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                  Not Assessed
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Side Legend & Category Breakdown Cards (Matching Attached Screenshot) */}
      {showLegend && (
        <div className="flex-1 w-full space-y-2.5">
          {rings.map((ring) => {
            const hasData = ring.isAssessed;
            const scoreVal = ring.score;
            const meets = ring.meets_count ?? 0;
            const total = ring.controls_count ?? 0;
            const remaining = total - meets;

            return (
              <div
                key={ring.category}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-3 shadow-xs hover:border-gray-300 dark:hover:border-slate-700 transition flex items-center justify-between gap-4"
              >
                {/* Left: Category Title & Dot */}
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ring.colorScheme.stroke }}
                    />
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {ring.category} Standards
                    </span>
                    {ring.isClosed ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 uppercase">
                        Closed 100%
                      </span>
                    ) : hasData ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                        {scoreVal}% closed
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-slate-800 text-gray-400">
                        Pending
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-3 pt-0.5 font-mono">
                    <span>
                      Actual: <strong className="text-gray-900 dark:text-white">{hasData ? `${scoreVal}%` : "0%"}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Target: <strong className="text-emerald-600 dark:text-emerald-400">100%</strong>
                    </span>
                    {total > 0 && (
                      <>
                        <span>•</span>
                        <span>
                          {meets}/{total} controls
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Ring Closure Progress Bar */}
                <div className="w-24 sm:w-28 flex-shrink-0 text-right space-y-1">
                  <div className="h-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${hasData ? scoreVal : 0}%`,
                        backgroundColor: ring.colorScheme.stroke,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                    {hasData && scoreVal < 100 ? `${100 - scoreVal}% remaining` : hasData ? "Passes Baseline" : "Ready to Audit"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
