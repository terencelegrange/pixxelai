import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "PixxelAI API",
    version: "1.0.0",
    description: "REST API for the PixxelAI platform.",
  },
  servers: [{ url: "/api", description: "Current server" }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "bp_token",
        description: "JWT session cookie set on login",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id:         { type: "integer" },
          email:      { type: "string", format: "email" },
          name:       { type: "string", nullable: true },
          role:       { type: "string", enum: ["user", "admin"] },
          status:     { type: "string", enum: ["pending", "approved", "rejected"] },
          created_at: { type: "string", format: "date-time" },
        },
      },
      AuditEntry: {
        type: "object",
        properties: {
          id:          { type: "integer" },
          action:      { type: "string" },
          resource:    { type: "string", nullable: true },
          resource_id: { type: "string", nullable: true },
          details:     { type: "string", nullable: true },
          ip:          { type: "string", nullable: true },
          created_at:  { type: "string", format: "date-time" },
          user_email:  { type: "string", nullable: true },
          user_name:   { type: "string", nullable: true },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      ObservabilityConfig: {
        type: "object",
        properties: {
          type:          { type: "string", enum: ["analytics", "logcollector"] },
          enabled:       { type: "boolean" },
          endpoint:      { type: "string" },
          apiKey:        { type: "string" },
          siteId:        { type: "string" },
          logLevel:      { type: "string" },
          customHeaders: { type: "object" },
          updatedAt:     { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
  paths: {
    // ── Auth ────────────────────────────────────────────────────────────
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description: "Authenticates a user and sets `bp_token` + `bp_theme` cookies.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email:        { type: "string", format: "email" },
                  password:     { type: "string" },
                  trustDevice:  { type: "boolean", description: "If true, also issues a device token so this device can skip the password step next time (see /auth/device)" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Logged in",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    user: {
                      type: "object",
                      properties: {
                        id:     { type: "integer" },
                        email:  { type: "string", format: "email" },
                        name:   { type: "string", nullable: true },
                        avatar: { type: "integer", nullable: true, description: "Avatar number 1-127, null for default" },
                      },
                    },
                    deviceToken: { type: "string", description: "Opaque trust token, only present when trustDevice was true. Store client-side and redeem via POST /auth/device." },
                  },
                },
              },
            },
          },
          400: { description: "Missing fields", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          403: { description: "Account pending or rejected", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/device": {
      post: {
        tags: ["Auth"],
        summary: "Log in with a trusted device token",
        description: "Exchanges a device token (issued by /auth/login with trustDevice: true) for a session, skipping the password step. Sets `bp_token` + `bp_theme` cookies.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "token"],
                properties: {
                  email: { type: "string", format: "email" },
                  token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Logged in",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    user: {
                      type: "object",
                      properties: {
                        id:     { type: "integer" },
                        email:  { type: "string", format: "email" },
                        name:   { type: "string", nullable: true },
                        avatar: { type: "integer", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Missing fields", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Device token invalid or expired", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          403: { description: "Account not active", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Auth"],
        summary: "Revoke a trusted device token",
        description: "Used by the login screen's 'forget' action to untrust a device. Public endpoint — the token itself is the credential.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "token"],
                properties: {
                  email: { type: "string", format: "email" },
                  token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Revoked (idempotent — no error if the token didn't exist)" },
          400: { description: "Missing fields", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out",
        description: "Clears the session cookie.",
        responses: {
          200: { description: "Logged out" },
        },
      },
    },
    "/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Register a new account",
        description: "Creates a new user with `pending` status. Requires admin approval before login is allowed.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  name:     { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Account created, awaiting approval" },
          400: { description: "Validation error or duplicate email", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Me ──────────────────────────────────────────────────────────────
    "/me/theme": {
      patch: {
        tags: ["Me"],
        summary: "Update theme preference",
        description: "Saves dark/light preference to the database and refreshes the `bp_theme` cookie.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["theme"], properties: { theme: { type: "string", enum: ["dark", "light"] } } },
            },
          },
        },
        responses: {
          200: { description: "Theme updated" },
          400: { description: "Invalid theme value" },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/me/profile": {
      get: {
        tags: ["Me"],
        summary: "Get own profile",
        description: "Returns the current user's name, email, and avatar number (1–127; null means no avatar saved — caller should derive a default).",
        responses: {
          200: { description: "Profile data", content: { "application/json": { schema: { type: "object", properties: { name: { type: "string", nullable: true }, email: { type: "string" }, avatar: { type: "integer", nullable: true, minimum: 1, maximum: 127 } } } } } },
          401: { description: "Not authenticated" },
          404: { description: "User not found" },
        },
      },
      patch: {
        tags: ["Me"],
        summary: "Update own profile",
        description: "Update name, email, and/or password for the currently logged-in user. Password change requires `currentPassword`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:            { type: "string", nullable: true },
                  email:           { type: "string", format: "email" },
                  currentPassword: { type: "string", description: "Required when changing password" },
                  newPassword:     { type: "string" },
                  avatar:          { type: "integer", minimum: 1, maximum: 127, description: "Avatar number (1–127); values outside this range are ignored" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Profile updated, new JWT cookie set", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, name: { type: "string", nullable: true }, email: { type: "string" } } } } } },
          400: { description: "Validation error or wrong current password" },
          401: { description: "Not authenticated" },
        },
      },
    },

    // ── Dashboard ───────────────────────────────────────────────────────
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Dashboard stats",
        description: "Returns user counts and recent registrations.",
        responses: {
          200: {
            description: "Stats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalUsers:    { type: "integer" },
                    pendingUsers:  { type: "integer" },
                    approvedUsers: { type: "integer" },
                    auditCount:    { type: "integer" },
                    recentUsers:   { type: "array", items: { $ref: "#/components/schemas/User" } },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },

    // ── Users ───────────────────────────────────────────────────────────
    "/users": {
      get: {
        tags: ["Users"],
        summary: "List all users",
        description: "Returns all users ordered by creation date. Admin only.",
        responses: {
          200: { description: "User list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/User" } } } } },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
        },
      },
    },
    "/users/{id}": {
      patch: {
        tags: ["Users"],
        summary: "Update a user",
        description: "Update status and/or role. Admin only.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["pending", "approved", "rejected"] },
                  role:   { type: "string", enum: ["user", "admin"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated" },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
          404: { description: "User not found" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete a user",
        description: "Permanently removes a user. Admin only.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Deleted" },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
        },
      },
    },

    // ── Audit ───────────────────────────────────────────────────────────
    "/audit": {
      get: {
        tags: ["Audit"],
        summary: "List audit log entries",
        description: "Paginated audit log with optional action filter. Admin only.",
        parameters: [
          { name: "page",   in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",  in: "query", schema: { type: "integer", default: 25 } },
          { name: "action", in: "query", schema: { type: "string" }, description: "Filter by action name" },
        ],
        responses: {
          200: {
            description: "Paginated results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    entries: { type: "array", items: { $ref: "#/components/schemas/AuditEntry" } },
                    total:   { type: "integer" },
                    page:    { type: "integer" },
                    pages:   { type: "integer" },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
        },
      },
    },

    // ── Feature Flags ────────────────────────────────────────────────────
    "/feature-flags": {
      get: {
        tags: ["Feature Flags"],
        summary: "List all feature flags",
        description: "Returns all flags and their enabled state. Available to all authenticated users (for client-side enforcement).",
        responses: {
          200: {
            description: "Map of flag key → flag object",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: {
                    type: "object",
                    properties: {
                      key:         { type: "string" },
                      enabled:     { type: "boolean" },
                      label:       { type: "string" },
                      description: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/feature-flags/{key}": {
      patch: {
        tags: ["Feature Flags"],
        summary: "Toggle a feature flag",
        description: "Enable or disable a named feature flag. Admin only.",
        parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["enabled"], properties: { enabled: { type: "boolean" } } },
            },
          },
        },
        responses: {
          200: { description: "Flag updated" },
          400: { description: "Invalid payload" },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
          404: { description: "Flag not found" },
        },
      },
    },

    // ── Changelog ───────────────────────────────────────────────────────
    "/changelog": {
      get: {
        tags: ["Changelog"],
        summary: "List changelog entries",
        description: "Returns all development changelog entries ordered by date descending. Entries are sourced from `src/data/changelog.ts` and synced to the DB on startup.",
        responses: {
          200: {
            description: "Array of changelog entries",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id:          { type: "integer" },
                      date:        { type: "string", format: "date" },
                      description: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },

    // ── Setup & Installation ───────────────────────────────────────────
    "/setup/status": {
      get: {
        tags: ["Setup"],
        summary: "Check setup status",
        description: "Returns whether the application installation is complete.",
        security: [],
        responses: {
          200: {
            description: "Setup completion status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { complete: { type: "boolean" } },
                },
              },
            },
          },
        },
      },
    },
    "/setup/test-db": {
      post: {
        tags: ["Setup"],
        summary: "Test database connectivity",
        description: "Tests MySQL connection credentials and verifies/creates the database.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["host", "user", "name"],
                properties: {
                  host:     { type: "string" },
                  port:     { type: "integer", default: 3306 },
                  user:     { type: "string" },
                  password: { type: "string" },
                  name:     { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Connection successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                },
              },
            },
          },
          400: {
            description: "Connection or validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" }, error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/setup/complete": {
      post: {
        tags: ["Setup"],
        summary: "Complete installation",
        description: "Saves database connection settings, creates schema tables, and creates initial administrator account.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["db", "admin"],
                properties: {
                  db: {
                    type: "object",
                    required: ["host", "user", "name"],
                    properties: {
                      host:     { type: "string" },
                      port:     { type: "integer" },
                      user:     { type: "string" },
                      password: { type: "string" },
                      name:     { type: "string" },
                    },
                  },
                  admin: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                      name:     { type: "string" },
                      email:    { type: "string", format: "email" },
                      password: { type: "string" },
                    },
                  },
                  appName: { type: "string" },
                  orgName: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Installation complete",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                },
              },
            },
          },
          400: { description: "Invalid configuration or already completed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          500: { description: "Setup error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Observability ───────────────────────────────────────────────────
    "/observability": {
      get: {
        tags: ["Observability"],
        summary: "Get observability configurations",
        description: "Returns configuration for Analytics and LogCollector integrations.",
        responses: {
          200: {
            description: "Observability configurations map",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: { $ref: "#/components/schemas/ObservabilityConfig" },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
      post: {
        tags: ["Observability"],
        summary: "Update observability configuration",
        description: "Updates settings for Analytics or LogCollector. Admin only.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "endpoint"],
                properties: {
                  type:          { type: "string", enum: ["analytics", "logcollector"] },
                  enabled:       { type: "boolean" },
                  endpoint:      { type: "string" },
                  apiKey:        { type: "string" },
                  siteId:        { type: "string" },
                  logLevel:      { type: "string" },
                  customHeaders: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated configuration",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ObservabilityConfig" },
              },
            },
          },
          401: { description: "Not authenticated" },
          403: { description: "Admin access required" },
        },
      },
    },
    "/observability/test": {
      post: {
        tags: ["Observability"],
        summary: "Test custom connector payload",
        description: "Dispatches a live test request to the specified observability endpoint and reports latency and response status. Admin only.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["endpoint"],
                properties: {
                  type:          { type: "string", enum: ["analytics", "logcollector"] },
                  endpoint:      { type: "string" },
                  apiKey:        { type: "string" },
                  payload:       { type: "object" },
                  customHeaders: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Test execution result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success:    { type: "boolean" },
                    statusCode: { type: "integer" },
                    statusText: { type: "string" },
                    latencyMs:  { type: "number" },
                    response:   { type: "object", nullable: true },
                    error:      { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
          403: { description: "Admin access required" },
        },
      },
    },

    // ── LLM Settings ─────────────────────────────────────────────────────
    "/settings/llm": {
      get: {
        tags: ["Settings"],
        summary: "Get LLM provider configurations",
        description: "Returns configuration for Ollama, Antigravity, Codex, and Claude providers with masked API keys.",
        responses: {
          200: { description: "Provider configurations" },
          401: { description: "Not authenticated" },
        },
      },
      put: {
        tags: ["Settings"],
        summary: "Update LLM provider configuration",
        description: "Update model, URL, API key, or designate as the active review engine.",
        responses: {
          200: { description: "Updated successfully" },
          401: { description: "Not authenticated" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/settings/llm/test": {
      post: {
        tags: ["Settings"],
        summary: "Test LLM provider connection",
        description: "Tests connectivity, authentication, and model list discovery for a specified provider.",
        responses: {
          200: { description: "Test result with latency" },
          401: { description: "Not authenticated" },
        },
      },
    },

    // ── OpenAPI ─────────────────────────────────────────────────────────
    "/openapi": {
      get: {
        tags: ["Meta"],
        summary: "OpenAPI specification",
        description: "Returns this OpenAPI 3.0 spec as JSON.",
        security: [],
        responses: {
          200: { description: "OpenAPI spec" },
        },
      },
    },
  },
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(spec);
}
