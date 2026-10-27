/**
 * instrumentation.ts
 *
 * Next.js instrumentation hook — runs once on server startup before any
 * request is handled. We use it to validate the environment and resolve JWT secrets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
