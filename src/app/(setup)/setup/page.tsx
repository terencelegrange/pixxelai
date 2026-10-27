"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
interface DbForm {
  dialect: "mysql" | "sqlite";
  host: string;
  port: string;
  user: string;
  password: string;
  name: string;
  sqliteFile: string;
}

interface AdminForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface AppForm {
  appName: string;
  orgName: string;
}

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { number: 1, label: "Database" },
  { number: 2, label: "Admin Account" },
  { number: 3, label: "Application" },
  { number: 4, label: "Review" },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const done = step.number < current;
        const active = step.number === current;
        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  done
                    ? "bg-emerald-500 text-white shadow-sm"
                    : active
                    ? "border-2 border-emerald-500 bg-emerald-500/10 text-emerald-500"
                    : "border-2 border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-gray-400 dark:text-slate-500"
                }`}
              >
                {done ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs ${
                  active
                    ? "font-semibold text-gray-900 dark:text-white"
                    : "text-gray-400 dark:text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mb-5 h-0.5 w-12 sm:w-20 transition-all ${
                  done ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  hint,
  error,
  showToggle,
  onToggle,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  showToggle?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border bg-gray-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            error
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-200 dark:border-slate-800"
          } ${showToggle ? "pr-10" : ""}`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            tabIndex={-1}
          >
            {type === "password" ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>
        )}
      </div>
      {hint && !error && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Database
// ---------------------------------------------------------------------------
function StepDatabase({
  form,
  onChange,
  onNext,
}: {
  form: DbForm;
  onChange: (f: Partial<DbForm>) => void;
  onNext: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testError, setTestError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof DbForm, string>>>({});

  function validate() {
    const e: typeof errors = {};
    if (form.dialect === "mysql") {
      if (!form.host.trim()) e.host = "Host is required.";
      if (!form.user.trim()) e.user = "Username is required.";
      if (!form.name.trim()) e.name = "Database name is required.";
      const port = Number(form.port);
      if (form.port && (isNaN(port) || port < 1 || port > 65535)) {
        e.port = "Port must be between 1 and 65535.";
      }
    } else {
      if (!form.sqliteFile?.trim()) e.sqliteFile = "Database file path is required.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleTest() {
    if (!validate()) return;
    setTestState("testing");
    setTestError("");
    try {
      const res = await fetch("/api/setup/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialect: form.dialect,
          host: form.host.trim(),
          port: Number(form.port) || 3306,
          user: form.user.trim(),
          password: form.password,
          name: form.name.trim(),
          file: form.sqliteFile?.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestState("ok");
      } else {
        setTestState("error");
        setTestError(data.error ?? "Connection failed.");
      }
    } catch {
      setTestState("error");
      setTestError("Network error: Could not reach setup endpoint.");
    }
  }

  function handleNext() {
    if (testState !== "ok") return;
    onNext();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Database Configuration</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Choose between MySQL/MariaDB for production or SQLite for standalone trial mode. Click <strong>Test Connection</strong> to verify storage readiness.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => { onChange({ dialect: "mysql" }); setTestState("idle"); }}
          className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all ${
            form.dialect === "mysql"
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
        >
          <div className="font-bold text-gray-900 dark:text-white">MySQL / MariaDB</div>
          <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">
            External production database server.
          </span>
        </button>
        <button
          type="button"
          onClick={() => { onChange({ dialect: "sqlite" }); setTestState("idle"); }}
          className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all ${
            form.dialect === "sqlite"
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
        >
          <div className="font-bold text-gray-900 dark:text-white">SQLite (Trial Mode)</div>
          <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">
            Single file, zero external database setup.
          </span>
        </button>
      </div>

      {form.dialect === "sqlite" ? (
        <div className="space-y-4">
          <Field
            label="Database File Path"
            id="sqlite-file"
            value={form.sqliteFile}
            onChange={(v) => { onChange({ sqliteFile: v }); setTestState("idle"); }}
            placeholder="data/pixxelai.db"
            hint="Stored inside the container. Mount a volume at /app/data to persist across container restarts."
            error={errors.sqliteFile}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field
                label="Database Host"
                id="db-host"
                value={form.host}
                onChange={(v) => { onChange({ host: v }); setTestState("idle"); }}
                placeholder="127.0.0.1 or db.example.com"
                error={errors.host}
              />
            </div>
            <div>
              <Field
                label="Port"
                id="db-port"
                value={form.port}
                onChange={(v) => { onChange({ port: v }); setTestState("idle"); }}
                placeholder="3306"
                error={errors.port}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Database User"
              id="db-user"
              value={form.user}
              onChange={(v) => { onChange({ user: v }); setTestState("idle"); }}
              placeholder="root"
              error={errors.user}
            />
            <Field
              label="Database Password"
              id="db-password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(v) => { onChange({ password: v }); setTestState("idle"); }}
              placeholder="Password"
              showToggle
              onToggle={() => setShowPassword((s) => !s)}
            />
          </div>

          <div>
            <Field
              label="Database Name"
              id="db-name"
              value={form.name}
              onChange={(v) => { onChange({ name: v }); setTestState("idle"); }}
              placeholder="pixxelai"
              hint="Will be created if it does not already exist."
              error={errors.name}
            />
          </div>
        </>
      )}

      {testState === "ok" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold">Connection verified successfully! Database is reachable.</span>
        </div>
      )}

      {testState === "error" && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <span className="font-bold">Connection failed: </span>
          <span>{testError}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={testState === "testing"}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition"
        >
          {testState === "testing" ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Testing Connection...</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Test Connection</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={testState !== "ok"}
          className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next Step &rarr;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Admin Account
// ---------------------------------------------------------------------------
function StepAdmin({
  form,
  onChange,
  onBack,
  onNext,
}: {
  form: AdminForm;
  onChange: (f: Partial<AdminForm>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AdminForm, string>>>({});

  function handleNext() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = "Please enter a valid email address.";
    }
    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 8) {
      e.password = "Password must be at least 8 characters.";
    }
    if (form.password !== form.confirmPassword) {
      e.confirmPassword = "Passwords do not match.";
    }
    setErrors(e);
    if (Object.keys(e).length === 0) {
      onNext();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Initial Administrator</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          This account will have full administrative rights to manage users, roles, feature flags, and settings.
        </p>
      </div>

      <div className="space-y-4">
        <Field
          label="Full Name"
          id="admin-name"
          value={form.name}
          onChange={(v) => onChange({ name: v })}
          placeholder="System Administrator"
          error={errors.name}
        />
        <Field
          label="Email Address"
          id="admin-email"
          type="email"
          value={form.email}
          onChange={(v) => onChange({ email: v })}
          placeholder="admin@example.com"
          error={errors.email}
        />
        <Field
          label="Password"
          id="admin-password"
          type={showPassword ? "text" : "password"}
          value={form.password}
          onChange={(v) => onChange({ password: v })}
          hint="Must be at least 8 characters."
          error={errors.password}
          showToggle
          onToggle={() => setShowPassword((s) => !s)}
        />
        <Field
          label="Confirm Password"
          id="admin-confirm"
          type={showConfirm ? "text" : "password"}
          value={form.confirmPassword}
          onChange={(v) => onChange({ confirmPassword: v })}
          error={errors.confirmPassword}
          showToggle
          onToggle={() => setShowConfirm((s) => !s)}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
        >
          &larr; Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition"
        >
          Next Step &rarr;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Application Details
// ---------------------------------------------------------------------------
function StepApplication({
  form,
  onChange,
  onBack,
  onNext,
}: {
  form: AppForm;
  onChange: (f: Partial<AppForm>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Application Identity</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Configure application naming displayed in headers, emails, and platform logs.
        </p>
      </div>

      <div className="space-y-4">
        <Field
          label="Application Name"
          id="app-name"
          value={form.appName}
          onChange={(v) => onChange({ appName: v })}
          placeholder="Boilerplate Admin"
          hint="Displayed across the app interface and top bar."
        />
        <Field
          label="Organisation Name (Optional)"
          id="org-name"
          value={form.orgName}
          onChange={(v) => onChange({ orgName: v })}
          placeholder="Acme Corp"
          hint="Your team or organization identifier."
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
        >
          &larr; Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition"
        >
          Review &rarr;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Review & Complete
// ---------------------------------------------------------------------------
function StepReview({
  db,
  admin,
  app,
  onBack,
  onComplete,
}: {
  db: DbForm;
  admin: AdminForm;
  app: AppForm;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleFinish() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db: db.dialect === "sqlite"
            ? { dialect: "sqlite", file: db.sqliteFile.trim() }
            : {
                dialect: "mysql",
                host: db.host.trim(),
                port: Number(db.port) || 3306,
                user: db.user.trim(),
                password: db.password,
                name: db.name.trim(),
              },
          admin: {
            name: admin.name.trim(),
            email: admin.email.trim(),
            password: admin.password,
          },
          appName: app.appName.trim() || "PixxelAI",
          orgName: app.orgName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        onComplete();
      } else {
        setError(data.error ?? "Setup failed. Please try again.");
      }
    } catch {
      setError("Network error: Could not complete setup.");
    } finally {
      setSubmitting(false);
    }
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between items-center py-2 text-sm">
        <span className="text-gray-500 dark:text-slate-400">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-xs">{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Review & Complete Installation</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Verify your configuration details below before completing setup.
        </p>
      </div>

      <div className="space-y-4">
        {/* DB Summary */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4 bg-gray-50 dark:bg-slate-950/50">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-2">Database</p>
          <div className="divide-y divide-gray-200 dark:divide-slate-800/80">
            <Row label="Engine" value={db.dialect === "sqlite" ? "SQLite (Trial Mode)" : "MySQL / MariaDB"} />
            {db.dialect === "sqlite" ? (
              <Row label="Database File" value={db.sqliteFile || "data/pixxelai.db"} />
            ) : (
              <>
                <Row label="Host & Port" value={`${db.host}:${db.port || 3306}`} />
                <Row label="Username" value={db.user} />
                <Row label="Database Name" value={db.name} />
              </>
            )}
          </div>
        </div>

        {/* Admin Summary */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4 bg-gray-50 dark:bg-slate-950/50">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-2">Administrator</p>
          <div className="divide-y divide-gray-200 dark:divide-slate-800/80">
            <Row label="Name" value={admin.name} />
            <Row label="Email" value={admin.email} />
            <Row label="Role" value="Administrator (Full Access)" />
          </div>
        </div>

        {/* App Summary */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4 bg-gray-50 dark:bg-slate-950/50">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-2">Application</p>
          <div className="divide-y divide-gray-200 dark:divide-slate-800/80">
            <Row label="App Name" value={app.appName || "PixxelAI"} />
            {app.orgName && <Row label="Organisation" value={app.orgName} />}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition"
        >
          &larr; Back
        </button>
        <button
          type="button"
          onClick={handleFinish}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50 transition"
        >
          {submitting && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {submitting ? "Configuring System..." : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard Root
// ---------------------------------------------------------------------------
export default function SetupWizardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>(1);

  const [db, setDb] = useState<DbForm>({
    dialect: "mysql",
    host: "127.0.0.1",
    port: "3306",
    user: "root",
    password: "",
    name: "pixxelai",
    sqliteFile: "data/pixxelai.db",
  });

  const [admin, setAdmin] = useState<AdminForm>({
    name: "Admin User",
    email: "admin@example.com",
    password: "",
    confirmPassword: "",
  });

  const [app, setApp] = useState<AppForm>({
    appName: "PixxelAI",
    orgName: "",
  });

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then(({ complete }) => {
        if (complete) {
          router.replace("/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 1 && (
        <StepDatabase
          form={db}
          onChange={(f) => setDb((d) => ({ ...d, ...f }))}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepAdmin
          form={admin}
          onChange={(f) => setAdmin((a) => ({ ...a, ...f }))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepApplication
          form={app}
          onChange={(f) => setApp((a) => ({ ...a, ...f }))}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <StepReview
          db={db}
          admin={admin}
          app={app}
          onBack={() => setStep(3)}
          onComplete={() => router.push("/setup/complete")}
        />
      )}
    </div>
  );
}
