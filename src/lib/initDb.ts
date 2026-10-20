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

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`pixxel_sync_config\` (
        \`id\`                  INT NOT NULL AUTO_INCREMENT,
        \`server_url\`          VARCHAR(255) NOT NULL DEFAULT 'http://192.168.100.228:3030',
        \`api_key\`             TEXT NULL,
        \`sync_source\`         VARCHAR(20) NOT NULL DEFAULT 'api',
        \`last_sync_at\`        DATETIME NULL,
        \`last_sync_status\`    VARCHAR(50) NULL,
        \`last_sync_message\`   TEXT NULL,
        \`assets_synced_count\` INT NOT NULL DEFAULT 0,
        \`created_at\`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`pixxel360_sync_config\` (
        \`id\`                    INT NOT NULL AUTO_INCREMENT,
        \`server_url\`            VARCHAR(255) NOT NULL DEFAULT 'http://192.168.100.228:7002',
        \`api_key\`               TEXT NULL,
        \`sync_source\`           VARCHAR(20) NOT NULL DEFAULT 'database',
        \`last_sync_at\`          DATETIME NULL,
        \`last_sync_status\`      VARCHAR(50) NULL,
        \`last_sync_message\`     TEXT NULL,
        \`controls_synced_count\` INT NOT NULL DEFAULT 0,
        \`created_at\`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`applications\` (
        \`id\`                 VARCHAR(36) NOT NULL,
        \`pixxel_asset_id\`    VARCHAR(100) NULL,
        \`name\`               VARCHAR(255) NOT NULL,
        \`short_code\`         VARCHAR(50) NULL,
        \`category\`           VARCHAR(100) NOT NULL DEFAULT 'Application',
        \`type\`               VARCHAR(50) NOT NULL DEFAULT 'SaaS',
        \`lifecycle_status\`   VARCHAR(50) NOT NULL DEFAULT 'Production',
        \`description\`        TEXT NULL,
        \`business_owner\`     VARCHAR(255) NULL,
        \`technical_owner\`    VARCHAR(255) NULL,
        \`vendor\`             VARCHAR(255) NULL,
        \`app_url\`            VARCHAR(500) NULL,
        \`doc_url\`            VARCHAR(500) NULL,
        \`repo_url\`           VARCHAR(500) NULL,
        \`knowledge_base_url\` VARCHAR(500) NULL,
        \`regulatory_sources\` TEXT NULL,
        \`raw_sync_data\`      LONGTEXT NULL,
        \`created_at\`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`applications_pixxel_asset_id_unique\` (\`pixxel_asset_id\`),
        KEY \`applications_category_idx\` (\`category\`),
        KEY \`applications_lifecycle_status_idx\` (\`lifecycle_status\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`standards\` (
        \`id\`          VARCHAR(36) NOT NULL,
        \`category\`    VARCHAR(50) NOT NULL DEFAULT 'Security',
        \`title\`       VARCHAR(200) NOT NULL,
        \`slug\`        VARCHAR(100) NOT NULL,
        \`description\` VARCHAR(500) NULL,
        \`content\`     LONGTEXT NOT NULL,
        \`source\`      VARCHAR(50) NOT NULL DEFAULT 'pixxel360',
        \`item_count\`  INT NOT NULL DEFAULT 0,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`standards_slug_unique\` (\`slug\`),
        KEY \`standards_category_idx\` (\`category\`)
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

    // Seed default Pixxel connection config
    await prisma.$executeRaw`
      INSERT IGNORE INTO \`pixxel_sync_config\` (\`id\`, \`server_url\`, \`api_key\`, \`sync_source\`)
      VALUES (1, 'http://192.168.100.228:3030', 'pxk_MANzGm0z5ys3OcEwMXLEh8QWfXS5_vh1bqP5BRtethk', 'api')
    `;

    // Seed default Pixxel360 connection config
    await prisma.$executeRaw`
      INSERT IGNORE INTO \`pixxel360_sync_config\` (\`id\`, \`server_url\`, \`sync_source\`)
      VALUES (1, 'http://192.168.100.228:7002', 'database')
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`llm_provider_configs\` (
        \`id\`               VARCHAR(50) NOT NULL,
        \`name\`             VARCHAR(100) NOT NULL,
        \`enabled\`          TINYINT(1) NOT NULL DEFAULT 0,
        \`is_active\`        TINYINT(1) NOT NULL DEFAULT 0,
        \`base_url\`         VARCHAR(500) NULL,
        \`api_key\`          TEXT NULL,
        \`default_model\`    VARCHAR(100) NOT NULL,
        \`available_models\` TEXT NULL,
        \`temperature\`      DOUBLE NOT NULL DEFAULT 0.2,
        \`max_tokens\`       INT NOT NULL DEFAULT 4096,
        \`timeout_seconds\`  INT NOT NULL DEFAULT 60,
        \`last_test_at\`     DATETIME(3) NULL,
        \`last_test_status\` VARCHAR(50) NULL,
        \`last_test_msg\`    TEXT NULL,
        \`created_at\`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Seed default LLM providers
    const defaultProviders = [
      {
        id: "ollama",
        name: "Ollama (Local LLM)",
        enabled: 1,
        is_active: 1,
        base_url: "http://localhost:11434",
        default_model: "llama3",
        available_models: "llama3, llama3.1, mistral, deepseek-r1, qwen2.5, codellama, phi3",
      },
      {
        id: "antigravity",
        name: "Antigravity (Gemini)",
        enabled: 0,
        is_active: 0,
        base_url: "https://generativelanguage.googleapis.com",
        default_model: "gemini-2.5-pro",
        available_models: "gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-pro",
      },
      {
        id: "codex",
        name: "Codex (OpenAI)",
        enabled: 0,
        is_active: 0,
        base_url: "https://api.openai.com/v1",
        default_model: "gpt-4o",
        available_models: "gpt-4o, gpt-4o-mini, o3-mini, o1, gpt-4-turbo, gpt-3.5-turbo",
      },
      {
        id: "claude",
        name: "Claude (Anthropic)",
        enabled: 0,
        is_active: 0,
        base_url: "https://api.anthropic.com/v1",
        default_model: "claude-3-7-sonnet-20250219",
        available_models: "claude-3-7-sonnet-20250219, claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229",
      },
    ];

    for (const p of defaultProviders) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO \`llm_provider_configs\` (\`id\`, \`name\`, \`enabled\`, \`is_active\`, \`base_url\`, \`default_model\`, \`available_models\`)
        VALUES (${p.id}, ${p.name}, ${p.enabled}, ${p.is_active}, ${p.base_url}, ${p.default_model}, ${p.available_models})
      `;
    }

    // Seed single pre-configured standard: Security
    const initialSecurityMarkdown = `# Application Security Baseline

> Source: Pixxel360 Security Controls Catalog  
> Category: Security  
> Standard Identifier: SEC-APP-BASELINE  

---

## 1. Objective
Ensure all organizational applications and services adhere to foundational security controls to mitigate identity compromise, unauthorized data access, privilege escalation, and operational vulnerabilities.

---

## 2. Inherent Risk Considerations
Applications must be evaluated based on their operational exposure and data sensitivity:
- **Public / Internet Facing**: Requires WAF protection, rate limiting, and continuous edge monitoring.
- **Personally Identifiable Information (PII)**: Subject to privacy compliance, strict access auditing, and encrypted storage.
- **Financial & Payment Data (PCI)**: Requires segregated processing environments and annual compliance audits.
- **Third-Party / SaaS Hosting**: Requires vendor risk assessment and automated deprovisioning.

---

## 3. Mandatory Security Controls

| Control Identifier | Control Name | Severity | Default Weight | Description |
|---|---|---|---|---|
| **SEC-01** | SSO (Single Sign-On) | Critical | 10 | Integration with corporate identity provider (SAML / OIDC / Azure AD / Okta). |
| **SEC-02** | MFA (Multi-Factor Authentication) | Critical | 10 | Enforced multi-factor authentication for all logins and administrator access. |
| **SEC-03** | Centralized Audit Logging | High | 6 | Security events, logins, and administrative changes forwarded to central SIEM. |
| **SEC-04** | SCIM Automated Deprovisioning | Medium | 3 | Automated account deactivation when employees leave the organisation. |
| **SEC-05** | Role-Based Access Control (RBAC) | High | 6 | Granular permissions enforcing least-privilege principles. |
| **SEC-06** | Secrets & Vault Management | Critical | 10 | No hardcoded credentials, API keys stored in centralized secrets manager. |
| **SEC-07** | Vulnerability Scanning & Patching | High | 6 | Regular scanning of dependencies and infrastructure vulnerabilities. |
| **SEC-08** | Data Encryption in Transit & at Rest | Critical | 10 | Enforced TLS 1.2+ for network transit and AES-256 for persistent data. |

---

## 4. Verification & Review Checklist
- [ ] Central identity provider SSO configured
- [ ] MFA enforced for all user roles, including emergency break-glass
- [ ] Audit logs actively shipped to SIEM / log aggregator
- [ ] Zero plain-text credentials in repository source code or environment files
- [ ] All network endpoints enforce TLS 1.3/1.2 with HSTS
`;

    await prisma.$executeRaw`
      INSERT IGNORE INTO \`standards\` (\`id\`, \`category\`, \`title\`, \`slug\`, \`description\`, \`content\`, \`source\`, \`item_count\`)
      VALUES ('std-security-core', 'Security', 'Application Security Baseline', 'security', 'Core baseline security controls and requirements for organizational applications', ${initialSecurityMarkdown}, 'pixxel360', 8)
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
