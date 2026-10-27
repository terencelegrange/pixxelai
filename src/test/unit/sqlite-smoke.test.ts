import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { getDbDialect, getSqliteFilePath, isSetupComplete, writeSiteConfig } from "@/lib/setup";
import { getOrCreateJwtSecret } from "@/lib/jwt-secret";

describe("SQLite & Configuration Smoke Tests", () => {
  const configPath = path.join(process.cwd(), "site.config.json");
  const testDbDir = path.join(process.cwd(), "data");
  let backupConfig: string | null = null;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    if (fs.existsSync(configPath)) {
      backupConfig = fs.readFileSync(configPath, "utf-8");
      fs.unlinkSync(configPath);
    } else {
      backupConfig = null;
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (backupConfig !== null) {
      fs.writeFileSync(configPath, backupConfig, "utf-8");
    } else if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  });

  it("detects unconfigured instance when site.config.json is absent", () => {
    delete process.env.SETUP_COMPLETE;
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_EMAIL;

    expect(isSetupComplete()).toBe(false);
  });

  it("resolves sqlite dialect and default path when configured", () => {
    delete process.env.DATABASE_URL;
    process.env.DB_TYPE = "sqlite";

    expect(getDbDialect()).toBe("sqlite");
    expect(getSqliteFilePath()).toContain(path.join("data", "pixxelai.db"));
  });

  it("persists and reads SQLite site.config.json configuration", () => {
    writeSiteConfig({
      setupComplete: true,
      appName: "PixxelAI Unit Test",
      orgName: "Test Org",
      db: {
        dialect: "sqlite",
        file: "data/test.db",
      },
    });

    expect(isSetupComplete()).toBe(true);
    expect(getDbDialect()).toBe("sqlite");
    expect(getSqliteFilePath()).toContain(path.join("data", "test.db"));
  });

  it("generates a cryptographically strong 32-byte JWT secret if unset", () => {
    const secret = getOrCreateJwtSecret();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThanOrEqual(32);
  });
});
