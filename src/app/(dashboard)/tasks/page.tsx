"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ReviewTask {
  id: string;
  application_id: string;
  assessment_id: string;
  assessment_item_id: string;
  standard_id: string;
  standard_title: string;
  category: string;
  assigned_role: string;
  assigned_to_user_id: number | null;
  status: "pending" | "approved" | "rejected" | "clarification_needed" | "assigned_to_developer";
  severity: string;
  resolution_notes: string | null;
  clarification_req: string | null;
  last_recheck_at: string | null;
  recheck_count: number;
  created_at: string;
  application: {
    id: string;
    name: string;
    short_code: string | null;
    category: string;
    type: string;
    repo_url: string | null;
  };
  assessment_item: {
    id: string;
    result: string;
    severity: string;
    evidence: string | null;
    recommendation: string | null;
  };
  assigned_user: {
    id: number;
    name: string | null;
    email: string;
  } | null;
}

interface UserOption {
  id: number;
  name: string | null;
  email: string;
  role: string;
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userRole, setUserRole] = useState<string>("user");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [recheckMessage, setRecheckMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Action Modal State
  const [activeTask, setActiveTask] = useState<ReviewTask | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "clarify" | "assign" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Status counts
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    clarification_needed: 0,
    assigned_to_developer: 0,
  });

  async function loadTasks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        if (data.counts) setCounts(data.counts);
        if (data.users) setUsers(data.users);
        if (data.user_role) setUserRole(data.user_role);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, [statusFilter]);

  async function handleRecheck(taskId: string) {
    setRecheckingId(taskId);
    setRecheckMessage(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/recheck`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setRecheckMessage({
          text: `Targeted re-check complete! Control evaluated as: ${data.result}. Application compliance score updated to ${data.compliance_score}%.`,
        });
        await loadTasks();
        setTimeout(() => setRecheckMessage(null), 6000);
      } else {
        setRecheckMessage({ text: `Re-check failed: ${data.error}`, error: true });
      }
    } catch (err: any) {
      setRecheckMessage({ text: `Error executing re-check: ${err.message}`, error: true });
    } finally {
      setRecheckingId(null);
    }
  }

  function openActionModal(task: ReviewTask, action: "approve" | "reject" | "clarify" | "assign") {
    setActiveTask(task);
    setActionType(action);
    setActionNotes("");
    setSelectedDeveloperId(task.assigned_to_user_id || (users[0]?.id ?? null));
  }

  function closeActionModal() {
    setActiveTask(null);
    setActionType(null);
    setActionNotes("");
    setSelectedDeveloperId(null);
  }

  async function handleSubmitAction(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTask || !actionType) return;

    setSubmitting(true);
    try {
      const body: any = { action: actionType };

      if (actionType === "approve") {
        body.action = "approve";
        body.resolution_notes = actionNotes || "Approved by standard reviewer.";
      } else if (actionType === "reject") {
        body.action = "reject";
        body.resolution_notes = actionNotes || "Rejected by standard reviewer.";
      } else if (actionType === "clarify") {
        body.action = "seek_clarification";
        body.clarification_req = actionNotes;
      } else if (actionType === "assign") {
        body.action = "assign_developer";
        body.assigned_to_user_id = selectedDeveloperId;
        body.resolution_notes = actionNotes;
      }

      const res = await fetch(`/api/tasks/${activeTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        closeActionModal();
        await loadTasks();
      } else {
        const data = await res.json();
        alert(`Failed to update task: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error updating task: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      t.application.name.toLowerCase().includes(term) ||
      t.standard_id.toLowerCase().includes(term) ||
      t.standard_title.toLowerCase().includes(term) ||
      (t.assessment_item.evidence && t.assessment_item.evidence.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
            <span>Governance & Advice</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">My Tasks</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Assigned Standard Tasks
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              {userRole === "admin" ? "All Roles (Admin)" : `Role: ${userRole}`}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Review assessed standards, approve controls, reject, seek clarification, assign to developers, or trigger targeted re-checks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings/workflow"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-300 transition"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Workflow Config
          </Link>
          <Link
            href="/applications"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white text-xs font-semibold shadow-sm transition"
          >
            Review App
          </Link>
        </div>
      </div>

      {/* Notification Toast */}
      {recheckMessage && (
        <div
          className={`p-4 rounded-2xl text-sm font-semibold flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 ${
            recheckMessage.error
              ? "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
          }`}
        >
          <span>{recheckMessage.text}</span>
          <button onClick={() => setRecheckMessage(null)} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
      )}

      {/* Summary KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Pending Review
          </span>
          <p className="text-2xl font-extrabold text-amber-500 mt-1">{counts.pending}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Awaiting triage & decision</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Assigned to Dev
          </span>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {counts.assigned_to_developer}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Remediation in progress</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Clarification
          </span>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
            {counts.clarification_needed}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Questions pending owner</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Approved / Closed
          </span>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {counts.approved}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Standard signoff granted</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search tasks by application, control ID (e.g. SEC-03), or evidence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          />
        </div>

        {/* Status Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === "all"
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
                : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-800"
            }`}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === "pending"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border border-gray-200 dark:border-slate-800"
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => setStatusFilter("assigned_to_developer")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === "assigned_to_developer"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-slate-800"
            }`}
          >
            Assigned to Dev ({counts.assigned_to_developer})
          </button>
          <button
            onClick={() => setStatusFilter("clarification_needed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === "clarification_needed"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 border border-gray-200 dark:border-slate-800"
            }`}
          >
            Clarification ({counts.clarification_needed})
          </button>
          <button
            onClick={() => setStatusFilter("approved")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === "approved"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-slate-800"
            }`}
          >
            Approved ({counts.approved})
          </button>
        </div>
      </div>

      {/* Task List Cards */}
      <div className="space-y-4">
        {loading && tasks.length === 0 ? (
          <div className="p-16 text-center text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl">
            <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Loading your assigned tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">All clear! No tasks found</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              There are no open standard review tasks for your role under the current filter.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isRechecking = recheckingId === task.id;

            return (
              <div
                key={task.id}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:border-gray-300 dark:hover:border-slate-700 transition space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/assessments/${task.assessment_id}`}
                        className="text-base font-bold text-gray-900 dark:text-white hover:text-cyan-500 transition"
                      >
                        {task.application.name}
                      </Link>
                      {task.application.short_code && (
                        <span className="text-xs font-mono font-bold text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800">
                          {task.application.short_code}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">/</span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                        {task.standard_id}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                        {task.standard_title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* AI Assessment Result Badge */}
                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                        task.assessment_item.result === "Meets"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : task.assessment_item.result === "Partially Meets"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      }`}
                    >
                      AI: {task.assessment_item.result}
                    </span>

                    {/* Workflow Status Badge */}
                    <span
                      className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                        task.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : task.status === "rejected"
                          ? "bg-rose-50 text-rose-700 border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300"
                          : task.status === "assigned_to_developer"
                          ? "bg-blue-50 text-blue-700 border-blue-500/30 dark:bg-blue-950/50 dark:text-blue-300"
                          : task.status === "clarification_needed"
                          ? "bg-purple-50 text-purple-700 border-purple-500/30 dark:bg-purple-950/50 dark:text-purple-300"
                          : "bg-amber-50 text-amber-700 border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}
                    >
                      Status: {task.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Body: AI Findings, Recommendation & Developer Assignee */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <span className="font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      AI Codebase Observations & Evidence:
                    </span>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {task.assessment_item.evidence || "No evidence recorded."}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Remediation Guidance & Task Context:
                    </span>
                    <div className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-gray-700 dark:text-slate-300 leading-relaxed space-y-2">
                      <p>{task.assessment_item.recommendation || "Ensure baseline standard compliance."}</p>
                      {task.assigned_user && (
                        <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-semibold">
                          <span>Assigned Developer:</span>
                          <span>{task.assigned_user.name || task.assigned_user.email}</span>
                        </div>
                      )}
                      {task.resolution_notes && (
                        <div className="text-[11px] text-gray-600 dark:text-slate-400 italic">
                          Notes: {task.resolution_notes}
                        </div>
                      )}
                      {task.clarification_req && (
                        <div className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                          Question asked: {task.clarification_req}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span>Re-checks run: {task.recheck_count}</span>
                    {task.last_recheck_at && (
                      <span>• Last re-check: {new Date(task.last_recheck_at).toLocaleTimeString()}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 1. Targeted Re-check Button */}
                    <button
                      onClick={() => handleRecheck(task.id)}
                      disabled={isRechecking}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                      title="Trigger isolated LLM evaluation of only this control on latest git commit"
                    >
                      <svg className={`w-3.5 h-3.5 ${isRechecking ? "animate-spin" : "text-cyan-200"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {isRechecking ? "Re-checking..." : "Re-check"}
                    </button>

                    {/* 2. Approve Button */}
                    <button
                      onClick={() => openActionModal(task, "approve")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold transition"
                    >
                      ✓ Approve
                    </button>

                    {/* 3. Reject Button */}
                    <button
                      onClick={() => openActionModal(task, "reject")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition"
                    >
                      ✕ Reject
                    </button>

                    {/* 4. Seek Clarification */}
                    <button
                      onClick={() => openActionModal(task, "clarify")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-semibold transition"
                    >
                      ❓ Seek Clarification
                    </button>

                    {/* 5. Assign to Developer */}
                    <button
                      onClick={() => openActionModal(task, "assign")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold transition"
                    >
                      👤 Assign to Developer
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action Dialog / Modal */}
      {activeTask && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {actionType === "approve" && `Approve: ${activeTask.standard_id} - ${activeTask.standard_title}`}
                  {actionType === "reject" && `Reject: ${activeTask.standard_id} - ${activeTask.standard_title}`}
                  {actionType === "clarify" && `Seek Clarification: ${activeTask.standard_id}`}
                  {actionType === "assign" && `Assign to Developer: ${activeTask.standard_id}`}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Application: {activeTask.application.name}
                </p>
              </div>
              <button onClick={closeActionModal} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitAction} className="p-6 space-y-4">
              {actionType === "assign" && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Select Developer / Remediation Owner
                  </label>
                  <select
                    value={selectedDeveloperId || ""}
                    onChange={(e) => setSelectedDeveloperId(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  {actionType === "approve" && "Approval Notes / Risk Acceptance Rationale"}
                  {actionType === "reject" && "Rejection Reason & Required Safeguards"}
                  {actionType === "clarify" && "Question for Application Owner / Developer"}
                  {actionType === "assign" && "Remediation Instructions for Developer"}
                </label>
                <textarea
                  rows={4}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={
                    actionType === "approve"
                      ? "e.g. Compensating controls confirmed or risk accepted for next release..."
                      : actionType === "reject"
                      ? "e.g. Must configure centralized SIEM logging before production rollout..."
                      : actionType === "clarify"
                      ? "e.g. Can you confirm if audit logs are forwarded via syslog or CloudWatch?"
                      : "e.g. Please install winston logger and configure shipping to SIEM endpoint..."
                  }
                  required={actionType !== "approve"}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeActionModal}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 rounded-xl text-white font-semibold text-xs shadow-sm transition disabled:opacity-50 ${
                    actionType === "approve"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : actionType === "reject"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : actionType === "clarify"
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {submitting ? "Saving..." : "Confirm Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
