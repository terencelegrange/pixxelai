import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { CHANGELOG } from "@/data/changelog";
import { DEFAULT_ROLE_PERMISSIONS } from "@/data/nav";
import { getDbDialect, getSqliteFilePath } from "./setup";

let initialized = false;

export function resetInitDbState() {
  initialized = false;
}

const SQLITE_SCHEMA_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS users (\n    id            INTEGER PRIMARY KEY AUTOINCREMENT,\n    email         TEXT NOT NULL UNIQUE,\n    password_hash TEXT NOT NULL,\n    name          TEXT,\n    role          TEXT NOT NULL DEFAULT 'user',\n    status        TEXT NOT NULL DEFAULT 'pending',\n    theme         TEXT NOT NULL DEFAULT 'dark',\n    avatar        INTEGER,\n    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS audit_logs (\n    id          INTEGER PRIMARY KEY AUTOINCREMENT,\n    user_id     INTEGER,\n    action      TEXT NOT NULL,\n    resource    TEXT NOT NULL,\n    resource_id TEXT,\n    details     TEXT,\n    ip          TEXT,\n    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL\n  )",
  "CREATE TABLE IF NOT EXISTS feature_flags (\n    key         TEXT PRIMARY KEY,\n    enabled     INTEGER NOT NULL DEFAULT 1,\n    label       TEXT NOT NULL,\n    description TEXT NOT NULL,\n    category    TEXT NOT NULL DEFAULT 'system'\n  )",
  "CREATE TABLE IF NOT EXISTS changelog (\n    id          INTEGER PRIMARY KEY AUTOINCREMENT,\n    date        DATETIME NOT NULL,\n    description TEXT NOT NULL,\n    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS user_mfa (\n    user_id      INTEGER PRIMARY KEY,\n    secret       TEXT NOT NULL,\n    enabled      INTEGER NOT NULL DEFAULT 0,\n    backup_codes TEXT,\n    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE\n  )",
  "CREATE TABLE IF NOT EXISTS watermark_config (\n    id          INTEGER PRIMARY KEY DEFAULT 1,\n    enabled     INTEGER NOT NULL DEFAULT 0,\n    custom_text TEXT NOT NULL DEFAULT '{{email}} • CONFIDENTIAL',\n    show_qr     INTEGER NOT NULL DEFAULT 1,\n    opacity     INTEGER NOT NULL DEFAULT 7,\n    font_size   INTEGER NOT NULL DEFAULT 12,\n    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS role_permissions (\n    role    TEXT NOT NULL,\n    nav_key TEXT NOT NULL,\n    PRIMARY KEY (role, nav_key)\n  )",
  "CREATE TABLE IF NOT EXISTS passkey_credentials (\n    id          TEXT PRIMARY KEY,\n    user_id     INTEGER NOT NULL,\n    public_key  TEXT NOT NULL,\n    counter     BIGINT NOT NULL DEFAULT 0,\n    device_type TEXT NOT NULL DEFAULT 'singleDevice',\n    backed_up   INTEGER NOT NULL DEFAULT 0,\n    transports  TEXT,\n    name        TEXT NOT NULL DEFAULT 'Passkey',\n    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    last_used   DATETIME,\n    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE\n  )",
  "CREATE TABLE IF NOT EXISTS passkey_challenges (\n    id         TEXT PRIMARY KEY,\n    challenge  TEXT NOT NULL,\n    user_id    INTEGER,\n    expires_at DATETIME NOT NULL,\n    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS api_keys (\n    id         INTEGER PRIMARY KEY AUTOINCREMENT,\n    key_hash   TEXT NOT NULL,\n    prefix     TEXT NOT NULL UNIQUE,\n    name       TEXT NOT NULL,\n    contact    TEXT NOT NULL,\n    expires_at DATETIME,\n    created_by INTEGER,\n    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    last_used  DATETIME,\n    active     INTEGER NOT NULL DEFAULT 1,\n    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL\n  )",
  "CREATE TABLE IF NOT EXISTS device_tokens (\n    id         INTEGER PRIMARY KEY AUTOINCREMENT,\n    user_id    INTEGER NOT NULL,\n    token_hash TEXT NOT NULL UNIQUE,\n    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    last_used  DATETIME,\n    expires_at DATETIME NOT NULL,\n    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE\n  )",
  "CREATE TABLE IF NOT EXISTS observability_config (\n    type           TEXT PRIMARY KEY,\n    enabled        INTEGER NOT NULL DEFAULT 0,\n    endpoint       TEXT NOT NULL,\n    api_key        TEXT,\n    site_id        TEXT,\n    log_level      TEXT DEFAULT 'info',\n    custom_headers TEXT,\n    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS pixxel_sync_config (\n    id                  INTEGER PRIMARY KEY AUTOINCREMENT,\n    server_url          TEXT NOT NULL DEFAULT 'http://192.168.100.228:3030',\n    api_key             TEXT,\n    sync_source         TEXT NOT NULL DEFAULT 'api',\n    last_sync_at        DATETIME,\n    last_sync_status    TEXT,\n    last_sync_message   TEXT,\n    assets_synced_count INTEGER NOT NULL DEFAULT 0,\n    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS pixxel360_sync_config (\n    id                    INTEGER PRIMARY KEY AUTOINCREMENT,\n    server_url            TEXT NOT NULL DEFAULT 'http://192.168.100.228:7002',\n    api_key               TEXT,\n    sync_source           TEXT NOT NULL DEFAULT 'database',\n    last_sync_at          DATETIME,\n    last_sync_status      TEXT,\n    last_sync_message     TEXT,\n    controls_synced_count INTEGER NOT NULL DEFAULT 0,\n    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS applications (\n    id                 TEXT PRIMARY KEY,\n    pixxel_asset_id    TEXT UNIQUE,\n    name               TEXT NOT NULL,\n    short_code         TEXT,\n    category           TEXT NOT NULL DEFAULT 'Application',\n    type               TEXT NOT NULL DEFAULT 'SaaS',\n    lifecycle_status   TEXT NOT NULL DEFAULT 'Production',\n    description        TEXT,\n    business_owner     TEXT,\n    technical_owner    TEXT,\n    vendor             TEXT,\n    app_url            TEXT,\n    doc_url            TEXT,\n    repo_url           TEXT,\n    knowledge_base_url TEXT,\n    regulatory_sources TEXT,\n    raw_sync_data      TEXT,\n    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS standards (\n    id          TEXT PRIMARY KEY,\n    category    TEXT NOT NULL DEFAULT 'Security',\n    title       TEXT NOT NULL,\n    slug        TEXT NOT NULL UNIQUE,\n    description TEXT,\n    content     TEXT NOT NULL,\n    source      TEXT NOT NULL DEFAULT 'pixxel360',\n    item_count  INTEGER NOT NULL DEFAULT 0,\n    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS llm_provider_configs (\n    id               TEXT PRIMARY KEY,\n    name             TEXT NOT NULL,\n    enabled          INTEGER NOT NULL DEFAULT 0,\n    is_active        INTEGER NOT NULL DEFAULT 0,\n    base_url         TEXT,\n    api_key          TEXT,\n    default_model    TEXT NOT NULL,\n    available_models TEXT,\n    temperature      REAL NOT NULL DEFAULT 0.2,\n    max_tokens       INTEGER NOT NULL DEFAULT 4096,\n    timeout_seconds  INTEGER NOT NULL DEFAULT 60,\n    last_test_at     DATETIME,\n    last_test_status TEXT,\n    last_test_msg    TEXT,\n    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n  )",
  "CREATE TABLE IF NOT EXISTS assessments (\n    id               TEXT PRIMARY KEY,\n    application_id   TEXT NOT NULL,\n    category         TEXT NOT NULL DEFAULT 'Security',\n    status           TEXT NOT NULL DEFAULT 'queued',\n    compliance_score REAL,\n    summary          TEXT,\n    items_count      INTEGER NOT NULL DEFAULT 0,\n    meets_count      INTEGER NOT NULL DEFAULT 0,\n    partial_count    INTEGER NOT NULL DEFAULT 0,\n    fails_count      INTEGER NOT NULL DEFAULT 0,\n    na_count         INTEGER NOT NULL DEFAULT 0,\n    llm_provider     TEXT,\n    llm_model        TEXT,\n    error_message    TEXT,\n    started_at       DATETIME,\n    completed_at     DATETIME,\n    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE\n  )",
  "CREATE TABLE IF NOT EXISTS assessment_items (\n    id             TEXT PRIMARY KEY,\n    assessment_id  TEXT NOT NULL,\n    standard_id    TEXT NOT NULL,\n    title          TEXT NOT NULL,\n    category       TEXT NOT NULL DEFAULT 'Security',\n    result         TEXT NOT NULL,\n    severity       TEXT NOT NULL DEFAULT 'Medium',\n    evidence       TEXT,\n    recommendation TEXT,\n    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    FOREIGN KEY (assessment_id) REFERENCES assessments (id) ON DELETE CASCADE\n  )",
  "CREATE TABLE IF NOT EXISTS workflow_configs (\n    id                TEXT PRIMARY KEY,\n    standard_id       TEXT,\n    category          TEXT NOT NULL DEFAULT 'Security',\n    assigned_role     TEXT NOT NULL DEFAULT 'security',\n    auto_create_tasks INTEGER NOT NULL DEFAULT 1,\n    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    UNIQUE(category, standard_id)\n  )",
  "CREATE TABLE IF NOT EXISTS review_tasks (\n    id                  TEXT PRIMARY KEY,\n    application_id      TEXT NOT NULL,\n    assessment_id       TEXT NOT NULL,\n    assessment_item_id  TEXT NOT NULL,\n    standard_id         TEXT NOT NULL,\n    standard_title      TEXT NOT NULL,\n    category            TEXT NOT NULL DEFAULT 'Security',\n    assigned_role       TEXT NOT NULL DEFAULT 'security',\n    assigned_to_user_id INTEGER,\n    status              TEXT NOT NULL DEFAULT 'pending',\n    severity            TEXT NOT NULL DEFAULT 'Medium',\n    resolution_notes    TEXT,\n    clarification_req   TEXT,\n    last_recheck_at     DATETIME,\n    recheck_count       INTEGER NOT NULL DEFAULT 0,\n    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE,\n    FOREIGN KEY (assessment_id) REFERENCES assessments (id) ON DELETE CASCADE,\n    FOREIGN KEY (assessment_item_id) REFERENCES assessment_items (id) ON DELETE CASCADE,\n    FOREIGN KEY (assigned_to_user_id) REFERENCES users (id) ON DELETE SET NULL\n  )",
  "CREATE TABLE IF NOT EXISTS task_activities (\n    id          TEXT PRIMARY KEY,\n    task_id     TEXT NOT NULL,\n    user_id     INTEGER,\n    action      TEXT NOT NULL,\n    from_status TEXT,\n    to_status   TEXT,\n    comment     TEXT,\n    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    FOREIGN KEY (task_id) REFERENCES review_tasks (id) ON DELETE CASCADE,\n    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL\n  )"
];

async function initSqliteSchema() {
  const dbFile = getSqliteFilePath();
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  for (const stmt of SQLITE_SCHEMA_STATEMENTS) {
    await prisma.$executeRawUnsafe(stmt);
  }
}

async function initMysqlSchema() {
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

  try {
    const avatarExists = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'
    `;
    if (Number(avatarExists[0]?.cnt ?? 0) === 0) {
      await prisma.$executeRaw`ALTER TABLE \`users\` ADD COLUMN \`avatar\` SMALLINT NULL DEFAULT NULL`;
    }
  } catch {}

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
  } catch {}

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

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`watermark_config\` ADD COLUMN IF NOT EXISTS \`font_size\` INT NOT NULL DEFAULT 12`);
  } catch {}

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
}

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

    

const allStandards = [
  {
    id: "std-security-core",
    category: "Security",
    title: "Application Security Baseline",
    slug: "security",
    description: "Core baseline security controls and requirements for organizational applications",
    content: initialSecurityMarkdown,
    source: "pixxel360",
    itemCount: 8,
  },
  {
    id: "std-architecture-core",
    category: "Architecture",
    title: "System Architecture & Resilience Baseline",
    slug: "architecture",
    description: "Core architecture guidelines covering modularity, stateless tiers, API versioning, and caching",
    content: initialArchitectureMarkdown,
    source: "pixxelai",
    itemCount: 6,
  },
  {
    id: "std-privacy-core",
    category: "Privacy",
    title: "Data Privacy & Protection Baseline",
    slug: "privacy",
    description: "Data privacy and protection controls covering consent, PII minimization, retention, and erasure",
    content: initialPrivacyMarkdown,
    source: "pixxelai",
    itemCount: 6,
  },
  {
    id: "std-compliance-core",
    category: "Compliance",
    title: "Regulatory Compliance & Audit Baseline",
    slug: "compliance",
    description: "Governance and compliance controls covering audit logging, change management, and disaster recovery",
    content: initialComplianceMarkdown,
    source: "pixxelai",
    itemCount: 5,
  },
  {
    id: "std-legal-core",
    category: "Legal",
    title: "Software Licensing & Legal Compliance Baseline",
    slug: "legal",
    description: "Legal compliance controls covering open-source license attribution, copyleft avoidance, and IP protection",
    content: initialLegalMarkdown,
    source: "pixxelai",
    itemCount: 4,
  },
  {
    id: "std-quality-core",
    category: "Quality",
    title: "Software Quality & Testing Baseline",
    slug: "quality",
    description: "Quality engineering controls covering automated unit/integration tests, linting, error budgeting, and performance SLOs",
    content: initialQualityMarkdown,
    source: "pixxelai",
    itemCount: 5,
  },
];

async function seedDb() {
  // Changelog
  for (const entry of CHANGELOG) {
    const existing = await (prisma as any).changelog.findFirst({
      where: { description: entry.description },
    });
    if (!existing) {
      await (prisma as any).changelog.create({
        data: { date: new Date(entry.date), description: entry.description },
      });
    }
  }

  // Feature Flags
  const defaultFlags = [
    { key: "signup",                 category: "system",    label: "Sign Up",                           description: "Allow new users to register an account" },
    { key: "dashboard",              category: "system",    label: "Dashboard",                         description: "Show the dashboard page in the navigation" },
    { key: "menu",                   category: "system",    label: "Navigation Menu",                   description: "Show navigation links in the sidebar" },
    { key: "passkeys",               category: "system",    label: "Passkeys (FIDO2/WebAuthn)",         description: "Allow users to register and sign in with biometric passkeys and security keys" },
    { key: "mfa",                    category: "system",    label: "Multi-Factor Authentication (MFA)",   description: "Allow users to configure and sign in with TOTP Authenticator Apps" },
    { key: "watermarking",           category: "system",    label: "Forensic Watermarking",             description: "Display subtle 45-degree tiled watermark and user QR verification overlay" },
    { key: "standards_security",     category: "standards", label: "Security Standards",               description: "Enable Security baseline standards, application hardening, and vulnerability controls" },
    { key: "standards_architecture", category: "standards", label: "Architecture Standards",           description: "Enable Architecture baseline standards, system design, modularity, and resilience controls" },
    { key: "standards_privacy",      category: "standards", label: "Privacy Standards",                description: "Enable Privacy baseline standards, data governance, PII handling, and user consent controls" },
    { key: "standards_compliance",   category: "standards", label: "Compliance Standards",             description: "Enable Compliance baseline standards, regulatory requirements, and audit evidence checks" },
    { key: "standards_legal",        category: "standards", label: "Legal Standards",                  description: "Enable Legal baseline standards, software licensing, and intellectual property review" },
    { key: "standards_quality",      category: "standards", label: "Quality Standards",                description: "Enable Quality baseline standards, automated test coverage, static analysis, and code health checks" },
  ];
  for (const f of defaultFlags) {
    await (prisma as any).featureFlag.upsert({
      where: { key: f.key },
      update: { label: f.label, description: f.description, category: f.category },
      create: { key: f.key, enabled: 1, label: f.label, description: f.description, category: f.category },
    });
  }

  // Watermark Config
  const wm = await (prisma as any).watermarkConfig.findFirst({ where: { id: 1 } });
  if (!wm) {
    await (prisma as any).watermarkConfig.create({
      data: { id: 1, enabled: 0, custom_text: "{{email}} • CONFIDENTIAL", show_qr: 1, opacity: 7, font_size: 12 },
    });
  }

  // Role Permissions
  for (const [role, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const nav_key of keys) {
      const existing = await (prisma as any).rolePermission.findUnique({
        where: { role_nav_key: { role, nav_key } },
      });
      if (!existing) {
        await (prisma as any).rolePermission.create({
          data: { role, nav_key },
        });
      }
    }
  }

  // Observability Config
  const defaultObservability = [
    { type: "analytics", enabled: 0, endpoint: "http://192.168.100.228:8030/api/collect", site_id: "pixxelai", log_level: "info" },
    { type: "logcollector", enabled: 0, endpoint: "http://192.168.100.228:8020/ingest", api_key: "", site_id: "pixxelai", log_level: "info" },
  ];
  for (const obs of defaultObservability) {
    const existing = await (prisma as any).observabilityConfig.findUnique({ where: { type: obs.type } });
    if (!existing) {
      await (prisma as any).observabilityConfig.create({ data: obs });
    }
  }

  // Pixxel Sync Config
  const pxCount = await (prisma as any).pixxelSyncConfig.count();
  if (pxCount === 0) {
    await (prisma as any).pixxelSyncConfig.create({
      data: { id: 1, server_url: "http://192.168.100.228:3030", api_key: "pxk_MANzGm0z5ys3OcEwMXLEh8QWfXS5_vh1bqP5BRtethk", sync_source: "api" },
    });
  }

  // Pixxel360 Sync Config
  const px360Count = await (prisma as any).pixxel360SyncConfig.count();
  if (px360Count === 0) {
    await (prisma as any).pixxel360SyncConfig.create({
      data: { id: 1, server_url: "http://192.168.100.228:7002", sync_source: "database" },
    });
  }

  // Workflow Configs
  const defaultWorkflows = [
    { id: "wf-security", category: "Security", assigned_role: "security", auto_create_tasks: 1 },
    { id: "wf-architecture", category: "Architecture", assigned_role: "architecture", auto_create_tasks: 1 },
    { id: "wf-privacy", category: "Privacy", assigned_role: "security", auto_create_tasks: 1 },
    { id: "wf-compliance", category: "Compliance", assigned_role: "security", auto_create_tasks: 1 },
  ];
  for (const wf of defaultWorkflows) {
    const existing = await (prisma as any).workflowConfig.findUnique({ where: { id: wf.id } });
    if (!existing) {
      await (prisma as any).workflowConfig.create({ data: wf });
    }
  }

  // LLM Providers
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
    const existing = await (prisma as any).llmProviderConfig.findUnique({ where: { id: p.id } });
    if (!existing) {
      await (prisma as any).llmProviderConfig.create({ data: p });
    }
  }

  // Standards
  for (const std of allStandards) {
    const existing = await (prisma as any).standard.findUnique({ where: { slug: std.slug } });
    if (!existing) {
      await (prisma as any).standard.create({
        data: {
          id: std.id,
          category: std.category,
          title: std.title,
          slug: std.slug,
          description: std.description,
          content: std.content,
          source: std.source,
          item_count: std.itemCount,
        },
      });
    }
  }

  // Seed admin from env
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  if (adminEmail && adminHash) {
    const existing = await (prisma as any).user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      await (prisma as any).user.create({
        data: {
          email: adminEmail,
          password_hash: adminHash,
          role: "admin",
          status: "approved",
        },
      });
    }
  }
}

export async function initDb() {
  if (initialized) return;

  try {
    const dialect = getDbDialect();
    if (dialect === "sqlite") {
      await initSqliteSchema();
    } else {
      await initMysqlSchema();
    }

    await seedDb();
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
