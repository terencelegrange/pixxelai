/**
 * lib/jwt-secret.ts — SERVER ONLY
 *
 * Resolves the JWT signing secret at boot. An operator-supplied JWT_SECRET
 * env var always wins. If unset, a secret is generated once and persisted
 * to .jwt-secret (sibling to site.config.json, same "written to /app at
 * runtime" pattern) so it survives process restarts.
 */
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const SECRET_FILE = path.join(process.cwd(), ".jwt-secret");

export function getOrCreateJwtSecret(): string {
  try {
    const existing = fs.readFileSync(SECRET_FILE, "utf-8").trim();
    if (existing.length >= 32) return existing;
  } catch {
    // File doesn't exist yet (or is unreadable) — generate below.
  }

  const generated = randomBytes(32).toString("base64");
  try {
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  } catch {
    // In read-only filesystems or environments where write fails, return generated in-memory
  }
  return generated;
}
