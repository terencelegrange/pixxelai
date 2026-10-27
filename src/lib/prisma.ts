import { PrismaClient as MysqlClient } from "@/generated/client-mysql";
import { PrismaClient as SqliteClient } from "@/generated/client-sqlite";
import { getSiteConfig, getDbDialect, getSqliteFilePath } from "./setup";

export type AnyPrismaClient = MysqlClient | SqliteClient;
export type PrismaClient = MysqlClient;

const globalForPrisma = globalThis as unknown as {
  prisma: AnyPrismaClient | undefined;
  dialect: "mysql" | "sqlite" | undefined;
};

export function getDatabaseUrl(): string | undefined {
  const dialect = getDbDialect();
  if (dialect === "sqlite") {
    const file = getSqliteFilePath();
    return `file:${file}`;
  }
  const config = getSiteConfig();
  if (config?.db && config.db.dialect === "mysql") {
    const { user, password, host, port, name } = config.db;
    const encodedUser = encodeURIComponent(user);
    const encodedPass = encodeURIComponent(password);
    return `mysql://${encodedUser}:${encodedPass}@${host}:${port || 3306}/${name}`;
  }
  return process.env.DATABASE_URL;
}

export function createPrismaClient(): AnyPrismaClient {
  const dialect = getDbDialect();
  if (dialect === "sqlite") {
    const file = getSqliteFilePath();
    const url = `file:${file}`;
    return new SqliteClient({
      datasources: {
        db: {
          url,
        },
      },
      log: ["error"],
    });
  }

  const url = getDatabaseUrl();
  if (url) {
    return new MysqlClient({
      datasources: {
        db: {
          url,
        },
      },
      log: ["error"],
    });
  }
  return new MysqlClient({ log: ["error"] });
}

export function resetPrisma(): void {
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
    globalForPrisma.dialect = undefined;
  }
}

export const prisma = new Proxy({} as MysqlClient, {
  get(_target, prop) {
    const currentDialect = getDbDialect();
    if (!globalForPrisma.prisma || globalForPrisma.dialect !== currentDialect) {
      if (globalForPrisma.prisma) {
        globalForPrisma.prisma.$disconnect().catch(() => {});
      }
      globalForPrisma.prisma = createPrismaClient();
      globalForPrisma.dialect = currentDialect;
    }
    const val = (globalForPrisma.prisma as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === "function") {
      return val.bind(globalForPrisma.prisma);
    }
    return val;
  },
});

