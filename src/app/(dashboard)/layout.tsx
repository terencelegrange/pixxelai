"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS } from "@/data/nav";
import { getDisplayAvatar } from "@/lib/avatar";
import { rememberProfile } from "@/lib/profiles";
import WatermarkOverlay from "@/components/WatermarkOverlay";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [avatar, setAvatar] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({ menu: true, dashboard: true, signup: true });
  const [allowedNavKeys, setAllowedNavKeys] = useState<string[]>(["dashboard", "settings"]);

  useEffect(() => {
    fetch("/api/feature-flags")
      .then((r) => r.json())
      .then((data: Record<string, { enabled: boolean }>) => {
        const map: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(data)) map[k] = v.enabled;
        setFlags(map);
      })
      .catch(() => { /* keep defaults */ });

    fetch("/api/rbac/me")
      .then((r) => r.json())
      .then((data: { navKeys: string[] }) => { if (data.navKeys) setAllowedNavKeys(data.navKeys); })
      .catch(() => { /* keep defaults */ });

    const theme = document.cookie.split("; ").find((c) => c.startsWith("bp_theme="))?.split("=")[1];
    setIsDark(theme !== "light");

    fetch("/api/me/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setUserName(data.name ?? data.email ?? null);
        setUserId(data.id ?? null);
        setAvatar(data.avatar ?? null);
        if (data.email) {
          rememberProfile({ id: data.id ?? null, email: data.email, name: data.name ?? null, avatar: data.avatar ?? null });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggleTheme() {
    const next = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    setIsDark(next === "dark");
    await fetch("/api/me/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navItems = flags.menu
    ? NAV_ITEMS.filter((item) => allowedNavKeys.includes(item.key))
    : [];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-500/20">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.9" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.6" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.6" />
                <circle cx="17.5" cy="17.5" r="3.5" fill="#38BDF8" />
                <path d="M17.5 15.5v4M15.5 17.5h4" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">Pixxel<span className="text-cyan-500">AI</span></span>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium leading-none">Intelligence Platform</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {!flags.menu ? (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500 italic">Navigation disabled</p>
          ) : navItems.length === 0 ? null : navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <div key={item.key}>
                {item.section && (
                  <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    {item.section}
                  </p>
                )}
                <Link href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {item.icon.split(" M").map((part, i) => (
                      <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={i === 0 ? part : "M" + part} />
                    ))}
                  </svg>
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>


      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-950">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-gray-50/80 dark:bg-slate-950/80 backdrop-blur border-b border-gray-200 dark:border-slate-800 px-6 py-3 flex items-center justify-end gap-2">
          {/* Theme toggle */}
          <button onClick={toggleTheme} title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
            {isDark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {userName && (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setShowDropdown((prev) => !prev)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition group">
                <img
                  src={`/avatars/${getDisplayAvatar(avatar, userId)}.png`}
                  alt="avatar"
                  className="w-7 h-7 rounded-full object-cover border border-emerald-500/30"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white">{userName}</span>
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showDropdown ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
                  {/* Identity header */}
                  <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800">
                    <img
                      src={`/avatars/${getDisplayAvatar(avatar, userId)}.png`}
                      alt="avatar"
                      className="w-10 h-10 rounded-full object-cover border border-emerald-500/30 flex-shrink-0"
                    />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userName}</p>
                  </div>
                  {/* Nav links */}
                  <div className="px-2 py-2 space-y-0.5">
                    <Link href="/profile" onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      Your Profile
                    </Link>
                    <Link href="/profile/security" onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                      Security
                    </Link>
                    <Link href="/settings" onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </Link>
                  </div>
                  {/* Logout */}
                  <div className="border-t border-gray-100 dark:border-slate-800 px-2 py-2">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
      <WatermarkOverlay />
    </div>
  );
}
