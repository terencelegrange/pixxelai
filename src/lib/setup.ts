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

interface LegacyDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export interface SiteConfig {
  setupComplete: boolean;
  appName: string;
  orgName?: string;
  db: DbConfig;
}

const CONFIG_PATH = path.join(process.cwd(), "site.config.json");

function normalizeDbConfig(db: DbConfig | LegacyDbConfig): DbConfig {
  if ("dialect" in db && (db.dialect === "sqlite" || db.dialect === "mysql")) {
    return db as DbConfig;
  }
  return { dialect: "mysql", ...(db as LegacyDbConfig) };
}

export function getDbDialect(): DbDialect {
  const config = getSiteConfig();
  if (config?.db?.dialect) return config.db.dialect;
  if (process.env.DB_TYPE === "sqlite") return "sqlite";
  if (process.env.DATABASE_URL?.startsWith("file:")) return "sqlite";
  return "mysql";
}

export function getSqliteFilePath(): string {
  const config = getSiteConfig();
  if (config?.db?.dialect === "sqlite" && config.db.file) {
    return path.isAbsolute(config.db.file)
      ? config.db.file
      : path.join(process.cwd(), config.db.file);
  }
  if (process.env.DB_FILE) {
    return path.isAbsolute(process.env.DB_FILE)
      ? process.env.DB_FILE
      : path.join(process.cwd(), process.env.DB_FILE);
  }
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    const rawPath = process.env.DATABASE_URL.replace(/^file:/, "");
    return path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
  }
  return path.join(process.cwd(), "data", "pixxelai.db");
}

export function isSetupComplete(): boolean {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const config = JSON.parse(raw) as SiteConfig;
      if (config.setupComplete === true) return true;
    }
  } catch {
    // ignore parse error
  }

  // Pre-configured environments (e.g. Proxmox/Jenkins via pixxelai.env)
  // have both DATABASE_URL and ADMIN_EMAIL explicitly supplied.
  if (process.env.SETUP_COMPLETE === "true" || (Boolean(process.env.DATABASE_URL) && Boolean(process.env.ADMIN_EMAIL))) {
    return true;
  }

  return false;
}

export function getSiteConfig(): SiteConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...parsed, db: normalizeDbConfig(parsed.db) };
    }
    if (process.env.DB_TYPE === "sqlite" || process.env.DATABASE_URL?.startsWith("file:")) {
      return {
        setupComplete: Boolean(process.env.SETUP_COMPLETE === "true" || process.env.ADMIN_EMAIL),
        appName: "PixxelAI",
        orgName: "",
        db: {
          dialect: "sqlite",
          file: getSqliteFilePath(),
        },
      };
    }
    if (process.env.DATABASE_URL) {
      try {
        const parsedUrl = new URL(process.env.DATABASE_URL);
        return {
          setupComplete: Boolean(process.env.SETUP_COMPLETE === "true" || process.env.ADMIN_EMAIL),
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
