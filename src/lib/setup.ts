/**
 * lib/setup.ts — SERVER ONLY
 *
 * Utilities for reading and writing site.config.json.
 * Source of truth for whether the application has been configured.
 */
import fs from "fs";
import path from "path";

export type DbDialect = "mysql" | "sqlite";

export interface MysqlDbConfig {
  dialect: "mysql";
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export interface SqliteDbConfig {
  dialect: "sqlite";
  file: string;
}

export type DbConfig = MysqlDbConfig | SqliteDbConfig;

export interface SiteConfig {
  setupComplete: boolean;
  appName: string;
  orgName?: string;
  db: DbConfig;
}

const CONFIG_PATH = path.join(process.cwd(), "site.config.json");

export function isSetupComplete(): boolean {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const config = JSON.parse(raw) as SiteConfig;
      if (config.setupComplete === true) return true;
    }
    // In environment-configured deployments (e.g. Proxmox/Docker via pixxelai.env),
    // DATABASE_URL is provided directly in the environment and pre-seeded.
    return Boolean(process.env.DATABASE_URL);
  } catch {
    return Boolean(process.env.DATABASE_URL);
  }
}

export function getSiteConfig(): SiteConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw) as SiteConfig;
      return parsed;
    }
    if (process.env.DATABASE_URL) {
      try {
        const parsedUrl = new URL(process.env.DATABASE_URL);
        return {
          setupComplete: true,
          appName: "PixxelAI",
          orgName: "",
          db: {
            dialect: "mysql",
            host: parsedUrl.hostname,
            port: Number(parsedUrl.port) || 3306,
            user: decodeURIComponent(parsedUrl.username),
            password: decodeURIComponent(parsedUrl.password),
            name: parsedUrl.pathname.replace(/^\//, ""),
          },
        };
      } catch {
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSiteConfig(config: SiteConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
