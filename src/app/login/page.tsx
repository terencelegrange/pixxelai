"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { getDisplayAvatar } from "@/lib/avatar";
import { getRememberedProfiles, rememberProfile, forgetProfile, RememberedProfile } from "@/lib/profiles";

type View = "profiles" | "password" | "form" | "mfa";

export default function LoginPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<RememberedProfile[]>([]);
  const [view, setView] = useState<View>("form");
  const [activeProfile, setActiveProfile] = useState<RememberedProfile | null>(null);
  const [silentLogin, setSilentLogin] = useState(false);
  const [passkeysEnabled, setPasskeysEnabled] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // MFA Challenge State
  const [pendingMfaToken, setPendingMfaToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<any | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then(({ complete }) => {
        if (!complete) {
          router.replace("/setup");
        } else {
          setCheckingSetup(false);
        }
      })
      .catch(() => setCheckingSetup(false));

    fetch("/api/auth/passkeys/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.enabled) setPasskeysEnabled(true);
      })
      .catch(() => {});

    const remembered = getRememberedProfiles();
    setProfiles(remembered);
    setView(remembered.length > 0 ? "profiles" : "form");
  }, [router]);

  async function performLogin(loginEmail: string, loginPassword: string, trust: boolean) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword, trustDevice: trust }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.mfaRequired) {
          setPendingMfaToken(data.mfaToken);
          setPendingUser(data.user);
          setMfaCode("");
          setUseBackupCode(false);
          setView("mfa");
          return;
        }

        const existing = getRememberedProfiles().find((p) => p.email === (data.user?.email ?? loginEmail));
        rememberProfile({
          id: data.user?.id ?? null,
          email: data.user?.email ?? loginEmail,
          name: data.user?.name ?? null,
          avatar: data.user?.avatar ?? null,
          deviceToken: data.deviceToken ?? existing?.deviceToken ?? null,
        });
        router.push("/");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingMfaToken || !mfaCode.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mfaToken: pendingMfaToken,
          code: mfaCode.trim(),
          isBackupCode: useBackupCode,
          trustDevice,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        const existing = getRememberedProfiles().find((p) => p.email === (data.user?.email ?? pendingUser?.email));
        rememberProfile({
          id: data.user?.id ?? pendingUser?.id,
          email: data.user?.email ?? pendingUser?.email,
          name: data.user?.name ?? pendingUser?.name,
          avatar: data.user?.avatar ?? pendingUser?.avatar,
          deviceToken: data.deviceToken ?? existing?.deviceToken ?? null,
        });
        router.push("/");
      } else {
        setError(data.error || "MFA verification failed");
      }
    } catch {
      setError("Network error during verification");
    } finally {
      setLoading(false);
    }
  }

  async function performPasskeyLogin(targetEmail?: string) {
    setError("");
    setLoading(true);
    try {
      const optRes = await fetch("/api/auth/passkeys/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetEmail ? { email: targetEmail } : {}),
      });
      const optData = await optRes.json();
      if (!optRes.ok) {
        throw new Error(optData.error || "Failed to initialize passkey sign-in");
      }

      let authResp;
      try {
        authResp = await startAuthentication({ optionsJSON: optData.options });
      } catch (err: any) {
        if (err.name === "NotAllowedError" || err.message?.includes("cancelled") || err.message?.includes("timed out")) {
          setLoading(false);
          return;
        }
        throw new Error(err.message || "Passkey authentication was not completed");
      }

      const verifyRes = await fetch("/api/auth/passkeys/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: authResp,
          challengeId: optData.challengeId,
        }),
      });

      const data = await verifyRes.json();
      if (verifyRes.ok && data.ok) {
        rememberProfile({
          id: data.user?.id ?? null,
          email: data.user?.email ?? targetEmail ?? "",
          name: data.user?.name ?? null,
          avatar: data.user?.avatar ?? null,
          deviceToken: null,
        });
        router.push("/");
      } else {
        setError(data.error || "Passkey authentication failed");
      }
    } catch (err: any) {
      setError(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function performDeviceLogin(profile: RememberedProfile): Promise<boolean> {
    if (!profile.deviceToken) return false;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, token: profile.deviceToken }),
      });
      const data = await res.json();
      if (res.ok) {
        rememberProfile({
          id: data.user?.id ?? profile.id,
          email: data.user?.email ?? profile.email,
          name: data.user?.name ?? profile.name,
          avatar: data.user?.avatar ?? profile.avatar,
          deviceToken: profile.deviceToken,
        });
        router.push("/");
        return true;
      }
      rememberProfile({ ...profile, deviceToken: null });
      return false;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    performLogin(email, password, trustDevice);
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProfile) return;
    performLogin(activeProfile.email, password, trustDevice);
  }

  async function selectProfile(profile: RememberedProfile) {
    setActiveProfile(profile);
    setPassword("");
    setTrustDevice(false);
    setError("");
    setView("password");

    if (profile.deviceToken) {
      setSilentLogin(true);
      const ok = await performDeviceLogin(profile);
      if (!ok) {
        setSilentLogin(false);
        setProfiles(getRememberedProfiles());
      }
    }
  }

  function handleForget(e: React.MouseEvent, profileEmail: string) {
    e.stopPropagation();
    const profile = profiles.find((p) => p.email === profileEmail);
    forgetProfile(profileEmail);
    if (profile?.deviceToken) {
      fetch("/api/auth/device", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profileEmail, token: profile.deviceToken }),
      }).catch(() => {});
    }
    const remaining = profiles.filter((p) => p.email !== profileEmail);
    setProfiles(remaining);
    if (remaining.length === 0) setView("form");
  }

  function backToProfiles() {
    setActiveProfile(null);
    setPassword("");
    setSilentLogin(false);
    setError("");
    setView(profiles.length > 0 ? "profiles" : "form");
  }

  if (checkingSetup) {
    return (
      <div className="min-h-full flex items-center justify-center px-4 bg-gray-50 dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 bg-gray-50 dark:bg-slate-950">
      <div className={view === "profiles" ? "w-full max-w-2xl" : "w-full max-w-sm"}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 mb-4 shadow-md shadow-indigo-500/20">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.9" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.6" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.6" />
              <circle cx="17.5" cy="17.5" r="3.5" fill="#38BDF8" />
              <path d="M17.5 15.5v4M15.5 17.5h4" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Pixxel<span className="text-cyan-500">AI</span></h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            {view === "profiles"
              ? "Who's signing in?"
              : view === "mfa"
              ? "Two-Step Verification"
              : "Sign in to your account"}
          </p>
        </div>

        {/* Two-Step Verification (MFA) View */}
        {view === "mfa" && pendingUser && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center mb-5">
              <img
                src={`/avatars/${getDisplayAvatar(pendingUser.avatar, pendingUser.id)}.png`}
                alt={pendingUser.name ?? pendingUser.email}
                className="w-14 h-14 rounded-xl object-cover mb-2"
              />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{pendingUser.name ?? pendingUser.email}</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">{pendingUser.email}</p>
            </div>

            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl mb-4 text-center">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                {useBackupCode
                  ? "Enter an Emergency Recovery Code"
                  : "Enter the 6-digit code from your Authenticator app"}
              </p>
            </div>

            <form onSubmit={handleMfaSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-xs">
                  {error}
                </div>
              )}

              <div>
                <input
                  type="text"
                  maxLength={useBackupCode ? 10 : 6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(useBackupCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))}
                  placeholder={useBackupCode ? "XXXX-XXXX" : "123456"}
                  className="w-full text-center tracking-widest font-mono text-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-3 focus:outline-none focus:border-indigo-500"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode);
                    setMfaCode("");
                    setError("");
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {useBackupCode ? "Use Authenticator App code" : "Use an emergency recovery code"}
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500"
                />
                Trust this device for 30 days
              </label>

              <button
                type="submit"
                disabled={loading || !mfaCode.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition shadow-sm"
              >
                {loading ? "Verifying code…" : "Verify & Sign In"}
              </button>
            </form>

            <button
              onClick={() => {
                setPendingMfaToken(null);
                setPendingUser(null);
                setError("");
                setView(profiles.length > 0 ? "profiles" : "form");
              }}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 mt-4 transition"
            >
              ← Cancel & sign in as someone else
            </button>
          </div>
        )}

        {/* Netflix-style profile picker */}
        {view === "profiles" && (
          <div>
            <div className="flex flex-wrap items-center justify-center gap-6 mb-6">
              {profiles.map((p) => (
                <button
                  key={p.email}
                  onClick={() => selectProfile(p)}
                  className="group flex flex-col items-center gap-2 w-20"
                >
                  <div className="relative">
                    <img
                      src={`/avatars/${getDisplayAvatar(p.avatar, p.id)}.png`}
                      alt={p.name ?? p.email}
                      className="w-20 h-20 rounded-xl object-cover border-2 border-transparent group-hover:border-emerald-500 transition"
                    />
                    <span
                      role="button"
                      aria-label={`Forget ${p.name ?? p.email}`}
                      onClick={(e) => handleForget(e, p.email)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900/80 dark:bg-slate-800 text-white border border-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                    {p.deviceToken && (
                      <span
                        title="This device is trusted — no password needed"
                        className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white border-2 border-gray-50 dark:border-slate-950 flex items-center justify-center"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 1.5c-3.6 0-6.75 1.35-9 3.6v6.15c0 5.55 3.825 10.5 9 11.7 5.175-1.2 9-6.15 9-11.7V5.1c-2.25-2.25-5.4-3.6-9-3.6zm-1.2 15.6l-4.05-4.05 1.5-1.5 2.55 2.55 6-6 1.5 1.5-7.5 7.5z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white truncate w-full text-center">
                    {p.name ?? p.email}
                  </span>
                </button>
              ))}

              <button
                onClick={() => setView("form")}
                className="group flex flex-col items-center gap-2 w-20"
              >
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 flex items-center justify-center group-hover:border-emerald-500 transition">
                  <svg className="w-8 h-8 text-gray-400 dark:text-slate-500 group-hover:text-emerald-500 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-xs text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white text-center">
                  Add Account
                </span>
              </button>
            </div>

            {passkeysEnabled && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => performPasskeyLogin()}
                  disabled={loading}
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-emerald-500/50 text-gray-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-semibold shadow-sm transition"
                >
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                  {loading ? "Authenticating Passkey…" : "Sign in with Passkey / Biometrics"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Password step for a selected remembered profile */}
        {view === "password" && activeProfile && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center mb-5">
              <img
                src={`/avatars/${getDisplayAvatar(activeProfile.avatar, activeProfile.id)}.png`}
                alt={activeProfile.name ?? activeProfile.email}
                className="w-16 h-16 rounded-xl object-cover mb-3"
              />
              <p className="text-sm font-medium text-gray-900 dark:text-white">{activeProfile.name ?? activeProfile.email}</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">{activeProfile.email}</p>
            </div>

            {silentLogin ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-slate-400">
                <svg className="w-4 h-4 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Signing in on this trusted device…
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition" />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400 select-none">
                  <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500" />
                  Trust this device — skip the password next time
                </label>
                <button type="submit" disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition mt-2">
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                {passkeysEnabled && (
                  <>
                    <div className="relative my-3">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200 dark:border-slate-800" />
                      </div>
                      <div className="relative flex justify-center text-[11px] uppercase">
                        <span className="bg-white dark:bg-slate-900 px-2 text-gray-400">or</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => performPasskeyLogin(activeProfile.email)}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 font-semibold rounded-lg px-4 py-2.5 text-xs transition"
                    >
                      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                      Sign in with Passkey
                    </button>
                  </>
                )}
              </form>
            )}

            <button onClick={backToProfiles} className="w-full text-center text-sm text-gray-500 dark:text-slate-500 hover:text-emerald-500 transition mt-4">
              ← Back to profiles
            </button>
          </div>
        )}

        {/* Full email + password form */}
        {view === "form" && (
          <div>
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition" />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400 select-none">
                  <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500" />
                  Trust this device — skip the password next time
                </label>
                <button type="submit" disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition mt-2">
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                {passkeysEnabled && (
                  <>
                    <div className="relative my-3">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200 dark:border-slate-800" />
                      </div>
                      <div className="relative flex justify-center text-[11px] uppercase">
                        <span className="bg-white dark:bg-slate-900 px-2 text-gray-400">or</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => performPasskeyLogin(email ? email : undefined)}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 font-semibold rounded-lg px-4 py-2.5 text-xs transition"
                    >
                      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                      Sign in with Passkey / Security Key
                    </button>
                  </>
                )}
              </form>
            </div>

            {profiles.length > 0 && (
              <button onClick={backToProfiles} className="w-full text-center text-sm text-gray-500 dark:text-slate-500 hover:text-emerald-500 transition mt-4">
                ← Back to profiles
              </button>
            )}
          </div>
        )}

        <p className="text-center text-sm text-gray-500 dark:text-slate-500 mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-emerald-500 hover:text-emerald-400 transition">Request access</Link>
        </p>
      </div>
    </div>
  );
}
