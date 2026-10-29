# PixxelAI

**AI-Powered Architecture & Compliance Assessment Platform**

PixxelAI is a self-hosted platform for continuous architecture reviews, compliance scoring, and automated software assessment. It bridges architecture governance with engineering reality by evaluating code repositories and system architectures against organisational standards (Security, Architecture, Privacy, Legal, Cloud, Cost, etc.), providing automated AI reviews, compliance ring charts, real-time assessment processing queues, and comprehensive gap analysis.

Docker Hub: [`tlgrange/pixxelai`](https://hub.docker.com/r/tlgrange/pixxelai)  
Source: [github.com/terencelegrange/pixxelai](https://github.com/terencelegrange/pixxelai)

---

## Quick start

Just pull and run — nothing has to be configured up front. If you don't set `JWT_SECRET` (which signs session cookies), PixxelAI generates one itself on first boot and persists it to `.jwt-secret` inside the container, so restarts keep working sessions. Set it explicitly if you want a stable secret across container recreations (e.g. mount it in, or use `--env-file`), or if you're running more than one replica — see the [Environment variables](#environment-variables) table.

PixxelAI ships with two database options — pick whichever fits your use case. Neither requires any env vars to boot: a container with no database configured starts up and serves the first-run setup wizard at `/setup`, where you name the instance, pick a database dialect (SQLite trial or MySQL/MariaDB), and create the initial admin account.

### Option A — SQLite trial mode (fastest way to try it out)

No separate database container needed. All data lives in a single file inside a named volume.

```bash
docker run -d \
  --name pixxelai \
  -p 3000:3000 \
  -v pixxelai-data:/app/data \
  -e DB_TYPE=sqlite \
  -e DB_FILE=data/pixxelai.db \
  tlgrange/pixxelai:latest
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the first-run setup wizard to name your instance, initialize the database schema, and create the initial admin account.

### Option B — MySQL / MariaDB (recommended for production)

```bash
docker run -d \
  --name pixxelai \
  -p 3000:3000 \
  -e DB_TYPE=mysql \
  -e DB_HOST=your-db-host \
  -e DB_PORT=3306 \
  -e DB_USER=pixxelai \
  -e DB_PASSWORD=your_password \
  -e DB_NAME=pixxelai \
  tlgrange/pixxelai:latest
```

The target database only needs to exist (`CREATE DATABASE pixxelai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`) — schema and reference tables are automatically created on first boot.

> **Pre-configured MySQL vs Setup Wizard**: If you provide `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `ADMIN_EMAIL` via environment variables, PixxelAI auto-initializes the database and activates standard login. If unconfigured or partial, PixxelAI serves the visual setup wizard at `/setup`.

### docker-compose

```yaml
services:
  app:
    image: tlgrange/pixxelai:latest
    ports:
      - "3000:3000"
    environment:
      # Optional — omit to auto-generate on first boot (see Quick start above).
      # JWT_SECRET: your_generated_secret # openssl rand -base64 32
      DB_TYPE: mysql
      DB_HOST: db
      DB_PORT: 3306
      DB_USER: pixxelai
      DB_PASSWORD: your_password
      DB_NAME: pixxelai
    volumes:
      - pixxelai-data:/app/data
    depends_on:
      - db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: mariadb:11
    environment:
      MYSQL_DATABASE: pixxelai
      MYSQL_USER: pixxelai
      MYSQL_PASSWORD: your_password
      MYSQL_ROOT_PASSWORD: change_me
    volumes:
      - pixxelai-db:/var/lib/mysql

volumes:
  pixxelai-data:
  pixxelai-db:
```

Swap the `app` service for SQLite mode (mount `pixxelai-data:/app/data` and set `DB_TYPE=sqlite`) if you do not want to run a separate database container.

---

## Choosing a database

| | SQLite (trial mode) | MySQL / MariaDB |
|---|---|---|
| **Setup effort** | Zero — one file, one volume | Requires a running MySQL/MariaDB 8+ instance |
| **Concurrency** | Single file with WAL mode — ideal for single admin, trial, local testing | Full connection pool via Prisma ORM (`mysql2`) — safe under high concurrency |
| **Intended use** | Local evaluation, demos, POCs | Production enterprise deployments |
| **Persistence** | Named Docker volume mounted at `/app/data` | External managed or containerised database |
| **ORM Client** | Generated Prisma SQLite client (`src/generated/client-sqlite`) | Generated Prisma MySQL client (`src/generated/client-mysql`) |

Both dialects share the exact same application code, API routes, and Prisma schema definitions via a dynamic client proxy (`src/lib/prisma.ts`).

---

## Environment variables

| Variable | Applies to | Default | Notes |
|---|---|---|---|
| `JWT_SECRET` | always | auto-generated | Optional. ≥ 32 chars if set. Signs session cookies; never written to `site.config.json`. If unset, generated on first boot and persisted to `.jwt-secret` in the container. Set explicitly for multi-replica setups. |
| `DB_TYPE` | both | `mysql` | `mysql` or `sqlite`. Determines active Prisma client and driver. |
| `DB_HOST` | mysql | — | Database hostname or IP address. |
| `DB_PORT` | mysql | `3306` | Database port. |
| `DB_USER` | mysql | — | Database username. |
| `DB_PASSWORD` | mysql | — | Database password. |
| `DB_NAME` | mysql | — | Database name. |
| `DB_FILE` | sqlite | `data/pixxelai.db` | Path relative to the container's working dir. Mount `/app/data` as a volume to persist. |
| `DATABASE_URL` | both | computed | Standard connection string (e.g. `mysql://user:pass@host:3306/db` or `file:data/pixxelai.db`). |
| `ADMIN_EMAIL` | both | — | Optional initial admin email for unattended setups. |
| `ADMIN_PASSWORD` | both | — | Optional initial admin password for unattended setups. |

---

## Health check

`GET /api/health` performs a database probe (`SELECT 1`) against the active dialect and returns:
- `200 OK` — `{ "status": "ok", "dialect": "mysql"|"sqlite", "timestamp": "..." }`
- `503 Service Unavailable` — `{ "status": "error", "error": "Database connection failed", ... }`

Use this endpoint for Docker Compose health checks, Kubernetes liveness/readiness probes, or load balancer health monitors.

---

## Architecture

- **Framework:** Next.js 15 (App Router), React 19, Tailwind CSS, TypeScript (strict)
- **Database Engine:** Dual Prisma ORM (isolated SQLite and MySQL code generation) switched dynamically at runtime
- **Runtime Image:** Multi-stage Debian container (`node:22-bookworm-slim`) running as a non-privileged `nextjs` user (`next build --standalone`)
- **Authentication:** Custom JWT sessions, bcrypt password hashing, Multi-Factor Authentication (MFA/TOTP), WebAuthn/Passkeys, and Enterprise SSO (Microsoft Entra ID) with local account bypass toggle
- **Assessment Engine:** AI-assisted architecture assessment against customisable standards (Security, Architecture, Privacy, Legal, Performance, Cost, Observability)
- **Reporting & Visualisation:** Ring charts for compliance closure, assessment queue monitoring, and exportable executive reports

---

## Test coverage

The repository includes comprehensive unit, functional, integration, and accessibility test suites powered by Vitest, Testing Library, and axe-core:

- **Unit tests** — Core utilities, database dialect resolver, JWT secret manager, and setup state
- **Functional tests** — Complete API route coverage across auth, setup, assessments, apps, and health checks
- **Accessibility tests** — Full WCAG 2.1 AA automated compliance scanning using `vitest-axe`

All test suites pass cleanly with strict TypeScript checks (`npx tsc --noEmit`).

---

## Tags

| Tag | Description |
|---|---|
| `latest` | Most recent build of `main` |
| `<version>` | Semantic version releases (e.g. `1.0.0`) |

---

## License

MIT © [Terence Le Grange](https://github.com/terencelegrange/pixxelai)
