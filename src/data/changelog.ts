/**
 * Changelog entries for the Boilerplate app.
 *
 * INSTRUCTIONS FOR CLAUDE:
 * When you complete a feature or make a significant change, add a new entry
 * to the TOP of this array (most recent first). Use today's actual date.
 * initDb() will sync these to the `changelog` DB table on next startup.
 *
 * Format: { date: "YYYY-MM-DD", description: "Short description of the change" }
 */
export const CHANGELOG: { date: string; description: string }[] = [
  { date: "2026-10-22", description: "Added Standards Feature Flags subset — dedicated Standards & Governance section in Feature Flags with individual toggle controls for Privacy, Legal, Compliance, Security, Architecture, and Quality; dynamic standards filtering in reviews, catalog, and workflow assignment" },
  { date: "2026-10-21", description: "Added Workflow Configuration and 'My Tasks' Workspace — map standards to specialist reviewer roles (Security, Architecture, Developer), auto-generate review tasks from assessment scans, status actions (Approve, Reject, Seek Clarification, Assign to Developer), and targeted single-control Re-checks with real-time score updates" },
  { date: "2026-10-20", description: "Added Application Review Engine and Assessments Center — independent Review button in application directory, isolated git repo clone and context extraction, async Security Baseline evaluation via active LLM, animated live progress bar in top navigation bar, and comprehensive Assessments report view with controls breakdown and evidence" },
  { date: "2026-10-20", description: "Added LLM Providers Integration in Settings — configure Ollama (local LLM), Antigravity (Google Gemini), Codex (OpenAI), and Claude (Anthropic) with API key masking, real-time connectivity testing with latency measurement, and primary review engine selection" },
  { date: "2026-10-09", description: "Added Forensic Screen Watermarking — admin configurable 45-degree tiled text, adjustable opacity, and scannable user session QR codes for leak prevention" },
  { date: "2026-10-09", description: "Added Personal Security Audit history in profile dropdown — tracks login method (Password, Passkeys, MFA Authenticator, Recovery Code), browser/OS, IP address, and timestamps" },
  { date: "2026-10-09", description: "Implemented Multi-Factor Authentication (MFA / TOTP) with Authenticator Apps (Google/Microsoft Authenticator), QR setup, 8 emergency recovery codes, admin toggle, and post-login 2FA verification" },
  { date: "2026-10-09", description: "Implemented Passkeys (FIDO2/WebAuthn) passwordless authentication — system-wide admin toggle and telemetry in Settings, personal Security center with hardware and biometric key management, and Passkey sign-in on login screen" },
  { date: "2026-10-09", description: "Added Security settings hub with dedicated landing pages for Multi-Factor Authentication (MFA), Passkeys (FIDO2/WebAuthn), and Forensic Watermarking" },
  { date: "2026-10-09", description: "Added Observability Settings Hub with dedicated Analytics and Log Collector configuration, API key management, custom payload connector, and test suite" },
  { date: "2026-10-09", description: "Added first-run install and setup wizard with live MySQL database connection testing, application configuration, and administrator account creation" },
  { date: "2026-09-10", description: "Added 'Trust this device' to login — a checkbox at the password step issues a 30-day device token so a remembered profile can sign in without re-entering the password; revocable via the profile's 'forget' control" },
  { date: "2026-09-10", description: "Added Netflix-style login screen — remembers previously signed-in accounts as avatar profiles on this device, with a password-only re-login step and a per-profile 'forget' control; login response now returns avatar/name for the client" },
  { date: "2026-08-04", description: "Removed site monitoring / health-check feature and environment selector to restore this as a generic app template" },
  { date: "2026-06-27", description: "Add dedicated profile page with identity and password change cards; simplify top-right dropdown to navigation links" },

  { date: "2026-06-26", description: "Replaced profile modal with inline top-bar dropdown; added avatar display, randomizer, and inline profile editing" },
  { date: "2026-06-26", description: "Moved dark mode toggle from sidebar to top bar next to profile dropdown" },
  { date: "2026-05-30", description: "Updated platform server and dev port configuration to 3333" },
  { date: "2026-03-30", description: "Added API Access tab in Settings — generate named API keys with contact, optional expiry, revoke/delete; keys authenticate via Authorization: Bearer header" },
  { date: "2026-03-30", description: "Added RBAC — viewer, editor, admin roles with configurable nav permissions; Roles tab in Settings with permission matrix" },
  { date: "2026-03-30", description: "Added Settings overview tiles — All Users, New Registrations, and Recent Activity summary cards" },
  { date: "2026-03-30", description: "Added Changelog tab to Settings — development changes tracked in DB and displayed as dated list" },
  { date: "2026-03-30", description: "Added OpenAPI 3.0 documentation tab to Settings — live spec viewer grouped by tag with expandable endpoints" },
  { date: "2026-03-30", description: "Added Feature Flags tab to Settings — toggle switches for signup, dashboard, and menu with immediate enforcement" },
  { date: "2026-03-30", description: "Added profile tile in top-right header — edit name, email, and password with current password verification" },
  { date: "2026-03-30", description: "Consolidated Settings into tabbed layout — Users, Audit Log, Feature Flags, and Documentation in one page" },
  { date: "2026-03-30", description: "Removed standalone Audit Log nav item — audit browser moved into Settings tabs" },
  { date: "2026-03-30", description: "Added audit log viewer with search, action filter, and pagination" },
  { date: "2026-03-30", description: "Added dark/light mode toggle — preference persisted to database and applied server-side via bp_theme cookie" },
  { date: "2026-03-30", description: "Added Settings page — user management with approve, reject, revoke, re-approve, delete, and role assignment" },
  { date: "2026-03-30", description: "Added Dashboard page — stat tiles (total, approved, pending users, audit events) and recent registrations" },
  { date: "2026-03-30", description: "Added user registration with admin approval flow — new accounts start as pending" },
  { date: "2026-03-30", description: "Initial boilerplate setup — Next.js 15, Tailwind CSS, MySQL via Prisma, JWT auth, audit logging" },
];
