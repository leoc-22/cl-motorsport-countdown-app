# CL Motorsport's Countdown App

Cloudflare-native countdown scheduler for motorsport (or any time-critical event) series. Built with Cloudflare Workers and D1 database for simple, cost-effective session management.

## Stack Overview
- **UI**: Vite + React + TypeScript + Tailwind CSS, deployed through Cloudflare Pages. Tooling runs on Bun 1.2+ while still targeting Node.js 22 for Cloudflare runtime parity.
- **API**: Cloudflare Worker (modules syntax) providing REST endpoints for session management.
- **ORM**: Drizzle ORM for type-safe database queries and schema management.
- **Persistence**: Cloudflare D1 (SQLite) database for storing countdown sessions and event audit logs.

## Project Layout
- `web/` – Vite + React + Tailwind frontend that visualizes countdown data and connects to the Worker API.
- `worker/` – Cloudflare Worker with REST endpoints (`/api/sessions/...`) and D1 database integration.
- `.nvmrc` – pins Node.js 22 for both workspaces.

## Architecture
1. User creates/edits countdown sessions via the React UI.
2. UI calls the Worker HTTP API for CRUD operations.
3. Worker uses Drizzle ORM to execute type-safe queries against D1 database.
4. Sessions are stored in D1 `sessions` table, with audit events in `events` table.
5. Clients calculate countdowns locally using session start times and durations.

```
Pages (React UI) ──HTTP REST──▶ Worker ──Drizzle ORM──▶ D1 Database (sessions + events)
```

## Data Model

### CountdownSession
| Field | Type | Notes |
| --- | --- | --- |
| `sessionId` | string (UUID) | Unique identifier. |
| `label` | string | e.g., "Qualifying". |
| `startTimeUtc` | string (ISO) | UTC start timestamp; primary ordering key. |
| `durationMs` | number | Duration in milliseconds (deterministic end = start + duration). |
| `metadata` | JSON | Optional notes (track, stream URL, etc.). |

### D1 tables

The database schema is defined using Drizzle ORM in `worker/src/schema.ts`:

```typescript
// sessions table
export const sessions = sqliteTable('sessions', {
  sessionId: text('session_id').primaryKey(),
  label: text('label').notNull(),
  startTimeUtc: text('start_time_utc').notNull(),
  durationMs: integer('duration_ms').notNull(),
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// events table
export const events = sqliteTable('events', {
  eventId: text('event_id').primaryKey(),
  sessionId: text('session_id').notNull(),
  action: text('action').notNull(),
  payload: text('payload'), // JSON string
  occurredAt: text('occurred_at').notNull(),
});
```

The Worker uses Drizzle ORM to write to the `sessions` table for all CRUD operations and appends to the `events` table for audit logging. This provides full TypeScript type safety and IntelliSense support.

## Development Setup
> Requires Node.js 22 (run `nvm use 22` from the repo root to sync with `.nvmrc`) and Bun 1.2+ for package management (`curl -fsSL https://bun.sh/install | bash`).

### Frontend (`web/`)
```bash
cd web
bun install
bun run dev        # starts Vite on http://localhost:5173
```
The UI connects to the Worker API via Vite's proxy (configured in `vite.config.ts`).

### Worker (`worker/`)
```bash
cd worker
bun install
bunx wrangler d1 create countdown-db --binding COUNTDOWN_DB   # once per account
bunx wrangler dev --local --persist-to=./.wrangler            # runs the Worker + Durable Object locally
```

### API Endpoints
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Simple readiness check. |
| `GET` | `/api/sessions` | List all sessions. |
| `POST` | `/api/sessions` | Create a new session. Body: `{ "label": "Name", "startTimeUtc": "...", "durationMs": 1800000 }`. |
| `GET` | `/api/sessions/:sessionId` | Get a specific session. |
| `PATCH` | `/api/sessions/:sessionId` | Update a session. |
| `DELETE` | `/api/sessions/:sessionId` | Delete a session. |

Example:
```bash
# Create a session
curl -X POST http://localhost:8787/api/sessions \
  -H "content-type: application/json" \
  -d '{"label":"Warm-up","startTimeUtc":"2026-01-01T13:00:00.000Z","durationMs":1800000}'

# List all sessions
curl http://localhost:8787/api/sessions
```

### Database bootstrap (D1)

The database schema is managed using Drizzle ORM. To set up your database:

#### Option 1: Using Drizzle Kit (Recommended)
```bash
cd worker

# Generate migration SQL from schema
npx drizzle-kit generate

# Push schema to local database
npx drizzle-kit push --dialect=sqlite --driver=d1-http

# Or push to remote database
npx drizzle-kit push --dialect=sqlite --driver=d1-http
```

#### Option 2: Using the generated SQL file
If you prefer to apply the schema manually:
```bash
# Apply schema.sql to local database
bunx wrangler d1 execute countdown-db --local --persist-to=./.wrangler --file=./schema.sql

# Or apply to remote database
bunx wrangler d1 execute countdown-db --remote --file=./schema.sql
```

> **Note:** The Drizzle schema is defined in `worker/src/schema.ts`. Any changes to the database structure should be made there, then migrations regenerated using `drizzle-kit generate`.

## Deployment Guide (Cloudflare)

### 1. Prerequisites
- Cloudflare account with access to Workers, D1, and Pages.
- [Bun 1.2+](https://bun.sh) installed locally (`curl -fsSL https://bun.sh/install | bash`).
- Logged in with Wrangler: `bunx wrangler login` (opens a browser, stores OAuth token locally).
- Verify access: `bunx wrangler whoami` should print the target account ID.

### 2. Provision Cloudflare resources
1. **D1 database** (once per account):
   ```bash
   cd worker
   bunx wrangler d1 create countdown-db
   ```
   Wrangler outputs a `database_id`; update the `database_id` field in `worker/wrangler.jsonc` under the `d1_databases` binding.

2. **Schema**: apply the database schema using Drizzle Kit:
   ```bash
   cd worker
   npx drizzle-kit push --dialect=sqlite --driver=d1-http
   ```
   Or manually apply the SQL:
   ```bash
   bunx wrangler d1 execute countdown-db --remote --file=./schema.sql
   ```

### 3. Deploy the Worker API
```bash
cd worker
bun install
bun run deploy          # alias for `wrangler deploy`
```
Use `bunx wrangler tail` to stream Worker logs after deploy.

### 4. Deploy the React UI via Cloudflare Pages

**Manual deploy (recommended for initial setup)**
```bash
cd web
bun install
VITE_API_URL=https://countdown-worker.<your-subdomain>.workers.dev bun run build
bunx wrangler pages deploy dist --project-name <your-pages-project>
```
- Replace `<your-pages-project>` with your Pages project name (created on first run if it doesn't exist).
- Set `VITE_API_URL` to your deployed Worker URL so the frontend knows where to send API requests.

**Dashboard-driven deploy (CI alternative)**
1. Create a Pages project in the Cloudflare dashboard pointing at your repository.
2. Set root directory to `web/`, build command to `bun run build`, and output directory to `dist`.
3. Add environment variable `VITE_API_URL` set to your Worker URL.
4. Pushes to the production branch trigger automatic builds.

### 5. Post-deployment verification
```bash
# Health check
curl https://<worker-domain>/health
# Expected: { "status": "ok" }

# Create a test session
curl -X POST https://<worker-domain>/api/sessions \
  -H 'content-type: application/json' \
  -d '{"label":"Test","startTimeUtc":"2026-01-01T00:00:00Z","durationMs":3600000}'

# List sessions
curl https://<worker-domain>/api/sessions
```
Visit the Cloudflare Pages URL to confirm the UI loads and connects to the Worker.

### 6. Rolling updates & maintenance
- **Worker updates**: re-run `bun run deploy` from `worker/` after code changes.
- **Frontend updates**: rebuild and redeploy via `wrangler pages deploy` or push to trigger dashboard CI.
- **Coordinated releases**: deploy the Worker first (maintains API compatibility), then the Pages build.
- **Database backups**: `bunx wrangler d1 export countdown-db --remote --output backup.sql` before major changes.

## Status
- [x] Architecture + data model defined
- [x] UI scaffolded with Tailwind theme
- [x] Worker with CRUD routes and D1 integration
- [x] UI wired to Worker API (sessions CRUD)
- [x] Client-side countdown calculations
- [ ] Real-time synchronization (WebSocket/SSE) - future enhancement
- [ ] Automatic session transitions - future enhancement
- [ ] GitHub Actions CI/CD workflow
