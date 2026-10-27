/**
 * lib/env.ts — SERVER ONLY
 *
 * Validates required environment variables at startup.
 * Called from instrumentation.ts so configuration issues surface before requests are served.
 */
import { isSetupComplete } from "@/lib/setup";
import { getOrCreateJwtSecret } from "@/lib/jwt-secret";

export function validateEnv(): void {
  const errors: string[] = [];

  const providedSecret = process.env.JWT_SECRET ?? "";
  if (providedSecret && providedSecret.length < 32) {
    errors.push(`JWT_SECRET is too short (${providedSecret.length} chars — need >= 32)`);
  } else if (!providedSecret) {
    process.env.JWT_SECRET = getOrCreateJwtSecret();
  }

  if (!isSetupComplete()) {
    const dbEnv: [string, string][] = [
      ["DB_HOST", process.env.DB_HOST ?? ""],
      ["DB_USER", process.env.DB_USER ?? ""],
      ["DB_PASSWORD", process.env.DB_PASSWORD ?? ""],
      ["DB_NAME", process.env.DB_NAME ?? ""],
    ];
    const anyDbEnvSet = dbEnv.some(([, value]) => value !== "");
    if (anyDbEnvSet) {
      for (const [name, value] of dbEnv) {
        if (!value) errors.push(`${name} is not set`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `\n\nServer startup aborted — missing or invalid configuration:\n` +
        errors.map((e) => `  • ${e}`).join("\n") +
        `\n\nFix the above in your environment or .env.local and restart the server.\n`
    );
  }
}
