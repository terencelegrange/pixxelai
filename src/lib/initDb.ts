import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { CHANGELOG } from "@/data/changelog";
import { DEFAULT_ROLE_PERMISSIONS } from "@/data/nav";

let initialized = false;

export async function initDb() {
  if (initialized) return;

  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\`            INT NOT NULL AUTO_INCREMENT,
        \`email\`         VARCHAR(200) NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`name\`          VARCHAR(200) NULL,
        \`role\`          VARCHAR(20) NOT NULL DEFAULT 'user',
        \`status\`        VARCHAR(20) NOT NULL DEFAULT 'pending',
        \`theme\`         VARCHAR(10) NOT NULL DEFAULT 'dark',
        \`created_at\`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`users_email_key\` (\`email\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    const avatarExists = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'
    `;
    if (Number(avatarExists[0].cnt) === 0) {
      await prisma.$executeRaw`
        ALTER TABLE \`users\` ADD COLUMN \`avatar\` SMALLINT NULL DEFAULT NULL
      `;
    }

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`user_id\`     INT NULL,
        \`action\`      VARCHAR(50) NOT NULL,
        \`resource\`    VARCHAR(100) NOT NULL,
        \`resource_id\` VARCHAR(100) NULL,
        \`details\`     TEXT NULL,
        \`ip\`          VARCHAR(45) NULL,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`audit_logs_user_id_fk\` (\`user_id\`),
        CONSTRAINT \`audit_logs_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`feature_flags\` (
        \`key\`         VARCHAR(50) NOT NULL,
        \`enabled\`     TINYINT(1) NOT NULL DEFAULT 1,
        \`label\`       VARCHAR(100) NOT NULL,
        \`description\` VARCHAR(255) NOT NULL,
        PRIMARY KEY (\`key\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`changelog\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`date\`        DATE NOT NULL,
        \`description\` TEXT NOT NULL,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`changelog_unique\` (\`date\`, \`description\`(200))
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Sync changelog entries from static data
    for (const entry of CHANGELOG) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO changelog (\`date\`, description)
        VALUES (${entry.date}, ${entry.description})
      `;
    }

    // Seed default flags
    const defaultFlags = [
      { key: "signup",        label: "Sign Up",                         description: "Allow new users to register an account" },
      { key: "dashboard",     label: "Dashboard",                       description: "Show the dashboard page in the navigation" },
      { key: "menu",          label: "Navigation Menu",                 description: "Show navigation links in the sidebar" },
      { key: "passkeys",      label: "Passkeys (FIDO2/WebAuthn)",       description: "Allow users to register and sign in with biometric passkeys and security keys" },
      { key: "mfa",           label: "Multi-Factor Authentication (MFA)", description: "Allow users to configure and sign in with TOTP Authenticator Apps" },
      { key: "watermarking",  label: "Forensic Watermarking",           description: "Display subtle 45-degree tiled watermark and user QR verification overlay" },
    ];
    for (const f of defaultFlags) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO feature_flags (\`key\`, enabled, label, description)
        VALUES (${f.key}, 1, ${f.label}, ${f.description})
      `;
    }

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`user_mfa\` (
        \`user_id\`      INT NOT NULL,
        \`secret\`       VARCHAR(128) NOT NULL,
        \`enabled\`      TINYINT(1) NOT NULL DEFAULT 0,
        \`backup_codes\` TEXT NULL,
        \`created_at\`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`user_id\`),
        CONSTRAINT \`user_mfa_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`watermark_config\` (
        \`id\`          INT NOT NULL DEFAULT 1,
        \`enabled\`     TINYINT(1) NOT NULL DEFAULT 0,
        \`custom_text\` VARCHAR(255) NOT NULL DEFAULT '{{email}} • CONFIDENTIAL',
        \`show_qr\`     TINYINT(1) NOT NULL DEFAULT 1,
        \`opacity\`     INT NOT NULL DEFAULT 7,
        \`font_size\`   INT NOT NULL DEFAULT 12,
        \`updated_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Ensure font_size column exists for existing tables
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`watermark_config\` ADD COLUMN IF NOT EXISTS \`font_size\` INT NOT NULL DEFAULT 12
    `).catch(() => {});

    await prisma.$executeRaw`
      INSERT IGNORE INTO \`watermark_config\` (\`id\`, \`enabled\`, \`custom_text\`, \`show_qr\`, \`opacity\`, \`font_size\`)
      VALUES (1, 0, '{{email}} • CONFIDENTIAL', 1, 7, 12)
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`role_permissions\` (
        \`role\`    VARCHAR(20) NOT NULL,
        \`nav_key\` VARCHAR(50) NOT NULL,
        PRIMARY KEY (\`role\`, \`nav_key\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`passkey_credentials\` (
        \`id\`          VARCHAR(255) NOT NULL,
        \`user_id\`     INT NOT NULL,
        \`public_key\`  TEXT NOT NULL,
        \`counter\`     BIGINT NOT NULL DEFAULT 0,
        \`device_type\` VARCHAR(64) NOT NULL DEFAULT 'singleDevice',
        \`backed_up\`   TINYINT(1) NOT NULL DEFAULT 0,
        \`transports\`  VARCHAR(255) NULL,
        \`name\`        VARCHAR(200) NOT NULL DEFAULT 'Passkey',
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`last_used\`   DATETIME NULL,
        PRIMARY KEY (\`id\`),
        KEY \`passkey_credentials_user_id\` (\`user_id\`),
        CONSTRAINT \`passkey_credentials_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`passkey_challenges\` (
        \`id\`         VARCHAR(255) NOT NULL,
        \`challenge\`  VARCHAR(255) NOT NULL,
        \`user_id\`    INT NULL,
        \`expires_at\` DATETIME NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`api_keys\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`key_hash\`   VARCHAR(64) NOT NULL,
        \`prefix\`     VARCHAR(12) NOT NULL,
        \`name\`       VARCHAR(200) NOT NULL,
        \`contact\`    VARCHAR(200) NOT NULL,
        \`expires_at\` DATETIME NULL,
        \`created_by\` INT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`last_used\`  DATETIME NULL,
        \`active\`     TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`api_keys_prefix\` (\`prefix\`),
        KEY \`api_keys_created_by\` (\`created_by\`),
        CONSTRAINT \`api_keys_created_by_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`device_tokens\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`user_id\`    INT NOT NULL,
        \`token_hash\` VARCHAR(64) NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`last_used\`  DATETIME NULL,
        \`expires_at\` DATETIME NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`device_tokens_hash\` (\`token_hash\`),
        KEY \`device_tokens_user_id\` (\`user_id\`),
        CONSTRAINT \`device_tokens_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`observability_config\` (
        \`type\`           VARCHAR(50) NOT NULL,
        \`enabled\`        TINYINT(1) NOT NULL DEFAULT 0,
        \`endpoint\`       VARCHAR(255) NOT NULL,
        \`api_key\`        VARCHAR(255) NULL,
        \`site_id\`        VARCHAR(100) NULL,
        \`log_level\`      VARCHAR(20) NULL DEFAULT 'info',
        \`custom_headers\` TEXT NULL,
        \`updated_at\`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`type\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Seed default observability rows
    await prisma.$executeRaw`
      INSERT IGNORE INTO \`observability_config\` (\`type\`, \`enabled\`, \`endpoint\`, \`site_id\`, \`log_level\`)
      VALUES ('analytics', 0, 'http://192.168.100.228:8030/api/collect', 'pixxelai', 'info')
    `;

    await prisma.$executeRaw`
      INSERT IGNORE INTO \`observability_config\` (\`type\`, \`enabled\`, \`endpoint\`, \`api_key\`, \`site_id\`, \`log_level\`)
      VALUES ('logcollector', 0, 'http://192.168.100.228:8020/ingest', '', 'pixxelai', 'info')
    `;

    // Seed default role permissions
    for (const [role, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const nav_key of keys) {
        await prisma.$executeRaw`
          INSERT IGNORE INTO role_permissions (role, nav_key) VALUES (${role}, ${nav_key})
        `;
      }
    }

    // Seed admin from env
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHash  = process.env.ADMIN_PASSWORD_HASH;
    if (adminEmail && adminHash) {
      const existing = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1
      `;
      if (existing.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO users (email, password_hash, role, status, created_at, updated_at)
          VALUES (${adminEmail}, ${adminHash}, 'admin', 'approved', NOW(), NOW())
        `;
      }
    }

    initialized = true;
  } catch (e) {
    console.error("[initDb] failed:", e);
    throw e;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
