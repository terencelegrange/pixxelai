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
        \`category\`    VARCHAR(50) NOT NULL DEFAULT 'system',
        PRIMARY KEY (\`key\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`feature_flags\` ADD COLUMN \`category\` VARCHAR(50) NOT NULL DEFAULT 'system'`);
    } catch {
      // Column already exists or table freshly created
    }

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

    // Seed default flags (System & Standards)
    const defaultFlags = [
      // System & Access Control Flags
      { key: "signup",                 category: "system",    label: "Sign Up",                           description: "Allow new users to register an account" },
      { key: "dashboard",              category: "system",    label: "Dashboard",                         description: "Show the dashboard page in the navigation" },
      { key: "menu",                   category: "system",    label: "Navigation Menu",                   description: "Show navigation links in the sidebar" },
      { key: "passkeys",               category: "system",    label: "Passkeys (FIDO2/WebAuthn)",         description: "Allow users to register and sign in with biometric passkeys and security keys" },
      { key: "mfa",                    category: "system",    label: "Multi-Factor Authentication (MFA)",   description: "Allow users to configure and sign in with TOTP Authenticator Apps" },
      { key: "watermarking",           category: "system",    label: "Forensic Watermarking",             description: "Display subtle 45-degree tiled watermark and user QR verification overlay" },

      // Standards & Governance Flags
      { key: "standards_security",     category: "standards", label: "Security Standards",               description: "Enable Security baseline standards, application hardening, and vulnerability controls" },
      { key: "standards_architecture", category: "standards", label: "Architecture Standards",           description: "Enable Architecture baseline standards, system design, modularity, and resilience controls" },
      { key: "standards_privacy",      category: "standards", label: "Privacy Standards",                description: "Enable Privacy baseline standards, data governance, PII handling, and user consent controls" },
      { key: "standards_compliance",   category: "standards", label: "Compliance Standards",             description: "Enable Compliance baseline standards, regulatory requirements, and audit evidence checks" },
      { key: "standards_legal",        category: "standards", label: "Legal Standards",                  description: "Enable Legal baseline standards, software licensing, and intellectual property review" },
      { key: "standards_quality",      category: "standards", label: "Quality Standards",                description: "Enable Quality baseline standards, automated test coverage, static analysis, and code health checks" },
    ];
    for (const f of defaultFlags) {
      await prisma.$executeRaw`
        INSERT INTO feature_flags (\`key\`, enabled, label, description, category)
        VALUES (${f.key}, 1, ${f.label}, ${f.description}, ${f.category})
        ON DUPLICATE KEY UPDATE label = ${f.label}, description = ${f.description}, category = ${f.category}
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

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`assessments\` (
        \`id\`               VARCHAR(36) NOT NULL,
        \`application_id\`   VARCHAR(36) NOT NULL,
        \`category\`         VARCHAR(50) NOT NULL DEFAULT 'Security',
        \`status\`           VARCHAR(50) NOT NULL DEFAULT 'queued',
        \`compliance_score\` DOUBLE NULL,
        \`summary\`          TEXT NULL,
        \`items_count\`      INT NOT NULL DEFAULT 0,
        \`meets_count\`      INT NOT NULL DEFAULT 0,
        \`partial_count\`    INT NOT NULL DEFAULT 0,
        \`fails_count\`      INT NOT NULL DEFAULT 0,
        \`na_count\`         INT NOT NULL DEFAULT 0,
        \`llm_provider\`     VARCHAR(50) NULL,
        \`llm_model\`        VARCHAR(100) NULL,
        \`error_message\`    TEXT NULL,
        \`started_at\`       DATETIME(3) NULL,
        \`completed_at\`     DATETIME(3) NULL,
        \`created_at\`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`assessments_app_fk\` (\`application_id\`),
        KEY \`assessments_status_idx\` (\`status\`),
        CONSTRAINT \`assessments_app_fk\` FOREIGN KEY (\`application_id\`) REFERENCES \`applications\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`assessment_items\` (
        \`id\`             VARCHAR(36) NOT NULL,
        \`assessment_id\`  VARCHAR(36) NOT NULL,
        \`standard_id\`    VARCHAR(100) NOT NULL,
        \`title\`          VARCHAR(255) NOT NULL,
        \`category\`       VARCHAR(50) NOT NULL DEFAULT 'Security',
        \`result\`         VARCHAR(50) NOT NULL,
        \`severity\`       VARCHAR(50) NOT NULL DEFAULT 'Medium',
        \`evidence\`       TEXT NULL,
        \`recommendation\` TEXT NULL,
        \`created_at\`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`assessment_items_ass_fk\` (\`assessment_id\`),
        CONSTRAINT \`assessment_items_ass_fk\` FOREIGN KEY (\`assessment_id\`) REFERENCES \`assessments\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`workflow_configs\` (
        \`id\`                VARCHAR(36) NOT NULL,
        \`standard_id\`       VARCHAR(36) NULL,
        \`category\`          VARCHAR(50) NOT NULL DEFAULT 'Security',
        \`assigned_role\`     VARCHAR(50) NOT NULL DEFAULT 'security',
        \`auto_create_tasks\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`workflow_configs_cat_std_key\` (\`category\`, \`standard_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`review_tasks\` (
        \`id\`                  VARCHAR(36) NOT NULL,
        \`application_id\`      VARCHAR(36) NOT NULL,
        \`assessment_id\`       VARCHAR(36) NOT NULL,
        \`assessment_item_id\`  VARCHAR(36) NOT NULL,
        \`standard_id\`         VARCHAR(100) NOT NULL,
        \`standard_title\`      VARCHAR(255) NOT NULL,
        \`category\`            VARCHAR(50) NOT NULL DEFAULT 'Security',
        \`assigned_role\`       VARCHAR(50) NOT NULL DEFAULT 'security',
        \`assigned_to_user_id\` INT NULL,
        \`status\`              VARCHAR(50) NOT NULL DEFAULT 'pending',
        \`severity\`            VARCHAR(50) NOT NULL DEFAULT 'Medium',
        \`resolution_notes\`    TEXT NULL,
        \`clarification_req\`   TEXT NULL,
        \`last_recheck_at\`     DATETIME(3) NULL,
        \`recheck_count\`       INT NOT NULL DEFAULT 0,
        \`created_at\`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`review_tasks_app_fk\` (\`application_id\`),
        KEY \`review_tasks_ass_fk\` (\`assessment_id\`),
        KEY \`review_tasks_item_fk\` (\`assessment_item_id\`),
        KEY \`review_tasks_user_fk\` (\`assigned_to_user_id\`),
        CONSTRAINT \`review_tasks_app_fk\` FOREIGN KEY (\`application_id\`) REFERENCES \`applications\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`review_tasks_ass_fk\` FOREIGN KEY (\`assessment_id\`) REFERENCES \`assessments\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`review_tasks_item_fk\` FOREIGN KEY (\`assessment_item_id\`) REFERENCES \`assessment_items\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`review_tasks_user_fk\` FOREIGN KEY (\`assigned_to_user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`task_activities\` (
        \`id\`          VARCHAR(36) NOT NULL,
        \`task_id\`     VARCHAR(36) NOT NULL,
        \`user_id\`     INT NULL,
        \`action\`      VARCHAR(50) NOT NULL,
        \`from_status\` VARCHAR(50) NULL,
        \`to_status\`   VARCHAR(50) NULL,
        \`comment\`     TEXT NULL,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`task_activities_task_fk\` (\`task_id\`),
        KEY \`task_activities_user_fk\` (\`user_id\`),
        CONSTRAINT \`task_activities_task_fk\` FOREIGN KEY (\`task_id\`) REFERENCES \`review_tasks\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`task_activities_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Seed default workflow mappings
    await prisma.$executeRaw`
      INSERT IGNORE INTO \`workflow_configs\` (\`id\`, \`category\`, \`assigned_role\`, \`auto_create_tasks\`)
      VALUES 
        ('wf-security', 'Security', 'security', 1),
        ('wf-architecture', 'Architecture', 'architecture', 1),
        ('wf-privacy', 'Privacy', 'security', 1),
        ('wf-compliance', 'Compliance', 'security', 1)
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

    const initialArchitectureMarkdown = `# System Architecture & Resilience Baseline

## 1. Overview
Defines fundamental software architecture requirements for organizational applications, emphasizing modularity, stateless horizontal scalability, robust API contracts, and graceful fault tolerance.

## 2. Applicability
Mandatory for all microservices, web applications, and backend services deployed in the organization's cloud and homelab infrastructure.

## 3. Mandatory Architecture Controls

| Control Identifier | Control Name | Severity | Default Weight | Description |
|---|---|---|---|---|
| **ARCH-01** | Modular & Service Separation | High | 8 | Clean bounded contexts and decoupled domain services with well-defined interfaces. |
| **ARCH-02** | Stateless Application Tier | High | 8 | Horizontal scalability without in-memory session pinning; session state persisted externally. |
| **ARCH-03** | API Contract & Versioning | Medium | 6 | Formal API specifications (OpenAPI/GraphQL) enforcing backwards compatibility. |
| **ARCH-04** | Resilience & Circuit Breaking | High | 8 | Graceful degradation, timeout management, retries with jitter, and circuit breaking. |
| **ARCH-05** | Connection Pooling & Caching | Medium | 6 | Controlled database connection pooling and distributed cache layer to prevent saturation. |
| **ARCH-06** | Asynchronous Processing | Medium | 6 | Decoupled queue/worker architecture for long-running workflows and background tasks. |

---

## 4. Verification Checklist
- [ ] Application state stored in external persistent stores (Redis, database), not local container memory
- [ ] API endpoints versioned (/api/v1) or governed with explicit contracts
- [ ] Network client calls implement timeouts and retry policies
- [ ] Database client configures connection pool limits
`;

    const initialPrivacyMarkdown = `# Data Privacy & Protection Baseline

## 1. Overview
Establishes mandatory privacy engineering controls governing personal information (PII) collection, consent management, storage minimization, and subject rights enforcement.

## 2. Applicability
Applies to all systems that process, store, or transmit personally identifiable information (PII) or confidential client data.

## 3. Mandatory Privacy Controls

| Control Identifier | Control Name | Severity | Default Weight | Description |
|---|---|---|---|---|
| **PRIV-01** | Data Minimization & PII Inventory | Critical | 10 | Restrict personal data collection to strictly defined and justified business purposes. |
| **PRIV-02** | Consent & Preference Management | High | 8 | Granular user consent recording with clear opt-in and withdrawal mechanisms. |
| **PRIV-03** | Right to Erasure & Deletion | Critical | 10 | Automated erasure mechanisms for customer and user records upon verified request. |
| **PRIV-04** | Retention & Automated Purge | High | 8 | Defined lifecycle retention periods with automated data deletion and purging. |
| **PRIV-05** | Anonymization & Data Masking | High | 8 | Sanitized and masked PII in logs, crash reports, analytics, and non-production environments. |
| **PRIV-06** | Geographic Data Residency | High | 8 | Storage and processing restricted to authorized geographical jurisdictions. |

---

## 4. Verification Checklist
- [ ] PII data elements documented in data catalog
- [ ] Automated user deletion workflow verified
- [ ] Application logs free of raw passwords, credit cards, or personal identifiers
- [ ] Database retention policies active and automated
`;

    const initialComplianceMarkdown = `# Regulatory Compliance & Audit Baseline

## 1. Overview
Defines regulatory governance, non-repudiation, and audit readiness controls across corporate and customer-facing digital applications.

## 2. Applicability
Mandatory for all enterprise applications subject to internal audit, ISO 27001, SOC 2, or regulatory oversight.

## 3. Mandatory Compliance Controls

| Control Identifier | Control Name | Severity | Default Weight | Description |
|---|---|---|---|---|
| **COMP-01** | Immutable Audit Trail | Critical | 10 | Non-repudiable audit logs recording all data mutations and admin actions with tamper-evidence. |
| **COMP-02** | Change Control & Peer Review | High | 8 | Mandatory peer reviews, automated CI verification, and dual approval for production deployments. |
| **COMP-03** | Disaster Recovery & Backup Validation | High | 8 | Documented RTO/RPO targets with automated regular recovery and restoration tests. |
| **COMP-04** | Vendor & Third-Party Risk Review | Medium | 6 | Formal security and compliance evaluation of third-party SaaS and integrations. |
| **COMP-05** | Access Recertification | High | 8 | Periodic access reviews and automated revocation of inactive accounts. |

---

## 4. Verification Checklist
- [ ] Audit logs write-only or shipped to tamper-resistant log aggregator
- [ ] Production deployments locked behind pull request approvals and CI gates
- [ ] Automated database backup snapshots running with documented recovery test schedule
`;

    const initialLegalMarkdown = `# Software Licensing & Legal Compliance Baseline

## 1. Overview
Ensures all software assets respect open-source licenses, avoid incompatible copyleft obligations, and preserve organizational intellectual property rights.

## 2. Applicability
Applies to all source code repositories, third-party libraries, container images, and software artifacts distributed or operated by the organization.

## 3. Mandatory Legal Controls

| Control Identifier | Control Name | Severity | Default Weight | Description |
|---|---|---|---|---|
| **LEG-01** | Open Source License Compliance | Critical | 10 | Automated license scanning ensuring no unapproved restrictive or viral copyleft licenses (e.g. AGPL). |
| **LEG-02** | Third-Party Attribution & Notices | Medium | 6 | Comprehensive inventory of third-party software with compliant copyright notices and attribution. |
| **LEG-03** | Terms of Service & Privacy Synchronization | High | 8 | Accurate and up-to-date legal terms and privacy policies presented and version-tracked in UI. |
| **LEG-04** | Intellectual Property & Trade Secret Protection | Critical | 10 | Protection of proprietary source code, algorithms, and confidential assets against leakage. |

---

## 4. Verification Checklist
- [ ] Dependency license scanner (e.g. license-checker) active in CI pipeline
- [ ] No unapproved copyleft dependencies in proprietary applications
- [ ] Third-party attribution file packaged with distributions
`;

    const initialQualityMarkdown = `# Software Quality & Testing Baseline

## 1. Overview
Establishes engineering rigor, test automation, continuous code inspection, and operational performance standards across applications.

## 2. Applicability
Applies to all software engineering codebases maintained or developed by the organization.

## 3. Mandatory Quality Controls

| Control Identifier | Control Name | Severity | Default Weight | Description |
|---|---|---|---|---|
| **QAL-01** | Automated Test Coverage | High | 8 | Comprehensive automated unit and integration tests executed in CI before merging. |
| **QAL-02** | Static Analysis & Code Linting | Medium | 6 | Automated linting, type checks, and static analysis without unreviewed bypasses. |
| **QAL-03** | Deterministic CI/CD Pipelines | High | 8 | Reproducible, containerized automated build and test pipelines with fast feedback loops. |
| **QAL-04** | Real-time Error Monitoring | High | 8 | Automated exception tracking, error budgets, and alerting for production defects. |
| **QAL-05** | Performance & Response Time SLOs | Medium | 6 | Documented and tested performance criteria, latency SLOs, and resource constraints. |

---

## 4. Verification Checklist
- [ ] Automated test suite runs on every pull request
- [ ] Linter and TypeScript compiler pass with zero errors
- [ ] Error tracker (Sentry / Pixxel247) configured for uncaught exceptions
- [ ] API latency conforms to defined service level objectives (p95 < 500ms)
`;

    const additionalStandards = [
      { id: 'std-architecture-core', category: 'Architecture', title: 'System Architecture & Resilience Baseline', slug: 'architecture', description: 'Core architecture guidelines covering modularity, stateless tiers, API versioning, and caching', content: initialArchitectureMarkdown, itemCount: 6 },
      { id: 'std-privacy-core', category: 'Privacy', title: 'Data Privacy & Protection Baseline', slug: 'privacy', description: 'Data privacy and protection controls covering consent, PII minimization, retention, and erasure', content: initialPrivacyMarkdown, itemCount: 6 },
      { id: 'std-compliance-core', category: 'Compliance', title: 'Regulatory Compliance & Audit Baseline', slug: 'compliance', description: 'Governance and compliance controls covering audit logging, change management, and disaster recovery', content: initialComplianceMarkdown, itemCount: 5 },
      { id: 'std-legal-core', category: 'Legal', title: 'Software Licensing & Legal Compliance Baseline', slug: 'legal', description: 'Legal compliance controls covering open-source license attribution, copyleft avoidance, and IP protection', content: initialLegalMarkdown, itemCount: 4 },
      { id: 'std-quality-core', category: 'Quality', title: 'Software Quality & Testing Baseline', slug: 'quality', description: 'Quality engineering controls covering automated unit/integration tests, linting, error budgeting, and performance SLOs', content: initialQualityMarkdown, itemCount: 5 },
    ];

    for (const std of additionalStandards) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO \`standards\` (\`id\`, \`category\`, \`title\`, \`slug\`, \`description\`, \`content\`, \`source\`, \`item_count\`, \`created_at\`, \`updated_at\`)
        VALUES (${std.id}, ${std.category}, ${std.title}, ${std.slug}, ${std.description}, ${std.content}, 'pixxelai', ${std.itemCount}, NOW(), NOW())
      `;
    }

    try {
      await prisma.$executeRawUnsafe(`UPDATE \`standards\` SET created_at = NOW(), updated_at = NOW() WHERE updated_at IS NULL OR CAST(updated_at AS CHAR) LIKE '0000%'`);
    } catch {}

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
