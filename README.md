# CL Motorsport's Countdown App

Cloudflare-native countdown scheduler for motorsport (or any time-critical event) series. The project keeps every browser tab in sync by letting a single Durable Object instance manage all countdown sessions, while Cloudflare Pages serves the React UI.

## Stack Overview
- **UI**: Vite + React + TypeScript + Tailwind CSS, deployed through Cloudflare Pages. Tooling runs on Bun 1.2+ while still targeting Node.js 22 for Cloudflare runtime parity.
- **API**: Cloudflare Worker (modules syntax) routing REST + WebSocket/SSE traffic.
- **State coordinator**: Single Cloudflare Durable Object responsible for managing all `CountdownSession`s, triggering automatic starts, and broadcasting real-time ticks.
- **Persistence**: Cloudflare D1 keeps durable snapshots/events. Optional R2 backups for exports.

## Project Layout
- `web/` – Vite + React + Tailwind frontend that visualizes countdown data and connects to the Worker API.
- `worker/` – Cloudflare Worker with a `CountdownDurableObject`, REST surface (`/api/sessions/...`), and D1 bindings for snapshots + audit events.
- `.nvmrc` – pins Node.js 22 for both workspaces.

## Architecture
1. User creates/edits countdown sessions via the React UI.
2. UI calls the Worker HTTP API. Worker routes to the Durable Object.
3. Durable Object validates mutations, updates its in-memory `sessions` list, syncs changes to D1 (snapshot plus append-only `events` row), and notifies any connected clients.
4. Clients maintain a WebSocket/SSE subscription; the DO emits authoritative timestamps roughly every second so all tabs show the same remaining time.
5. DO alarms wake up at exact session boundaries to flip statuses (`scheduled → running → complete`) and immediately start the next session (the "plan ahead" chain).

```
Pages (React UI) ──HTTP/WebSocket──▶ Worker Router ──fetchStub──▶ Countdown Durable Object
                                                   │
                                                   └────SQL────▶ D1 (snapshots + events)
```

## Data Model

### CountdownSession
| Field | Type | Notes |
| --- | --- | --- |
| `sessionId` | string (UUID) | Unique identifier. |
| `label` | string | e.g., "Qualifying". |
| `startTimeUtc` | string (ISO) | UTC start timestamp; primary ordering key. |
| `durationMs` | number | Duration in milliseconds (deterministic end = start + duration). |
| `status` | enum | `scheduled`, `running`, `complete`, `canceled`. |
| `metadata` | JSON | Optional notes (track, stream URL, etc.). |

### D1 tables
```sql
countdown_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  version INTEGER,
  snapshot TEXT,        -- JSON blob of DO state
  created_at TEXT,
  updated_at TEXT
);

events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT,
  action TEXT,
  payload TEXT,
  occurred_at TEXT
);
```
Durable Object appends to `events` for every mutation and periodically refreshes `countdown_state.snapshot`. Cold starts replay snapshot + subsequent events to rebuild memory.

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
Run the following once after `bunx wrangler d1 create countdown-db` to create the tables in your **local** database:
```bash
# Create countdown_state table
bunx wrangler d1 execute countdown-db --local --persist-to=./.wrangler --command "CREATE TABLE IF NOT EXISTS countdown_state (id TEXT PRIMARY KEY DEFAULT 'default', version INTEGER NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);"

# Create events table
bunx wrangler d1 execute countdown-db --local --persist-to=./.wrangler --command "CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, action TEXT NOT NULL, payload TEXT, occurred_at TEXT NOT NULL);"
```
> **Important:** The `--local --persist-to=./.wrangler` flags ensure the tables are created in the same local database that `wrangler dev --local --persist-to=./.wrangler` uses. Without these flags, the tables may be created in a different location.
>
> To apply the schema to the **remote** (deployed) database, use `--remote` instead:
> ```bash
> bunx wrangler d1 execute countdown-db --remote --command "CREATE TABLE ..."
> ```

## Deployment Guide (Cloudflare)
### 1. Prerequisites
- Cloudflare account with access to Workers, D1, Durable Objects, and Pages.
- [Bun 1.2+](https://bun.sh) installed locally (`curl -fsSL https://bun.sh/install | bash`).
- Logged in with Wrangler: `bunx wrangler login` (opens a browser, stores OAuth token locally).
- Verify access: `bunx wrangler whoami` should print the target account ID.

### 2. Provision Cloudflare resources
1. **D1 database** (once per account):
   ```bash
   cd worker
   bunx wrangler d1 create countdown-db --binding COUNTDOWN_DB
   ```
   Wrangler will output the `database_name`/`database_id`; copy those values into `worker/wrangler.jsonc` **alongside** the same `COUNTDOWN_DB` binding so the Worker environment (`env.COUNTDOWN_DB`) stays consistent.
2. **Schema**: run the following to create the required tables:
   ```bash
   # Create countdown_state table
   bunx wrangler d1 execute countdown-db --remote --command "CREATE TABLE IF NOT EXISTS countdown_state (id TEXT PRIMARY KEY DEFAULT 'default', version INTEGER NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);"

   # Create events table
   bunx wrangler d1 execute countdown-db --remote --command "CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, action TEXT NOT NULL, payload TEXT, occurred_at TEXT NOT NULL);"
   ```
3. **Durable Object migration**: the first `wrangler deploy` automatically registers the `CountdownDurableObject` because `wrangler.jsonc` already includes the `new_sqlite_classes` migration tag. No manual step is needed beyond the initial deploy.

### 3. Deploy the Worker API
```bash
cd worker
bun install                                # if not already installed
bunx wrangler deploy                       # uploads Worker, Durable Object, bindings
```
Environment considerations:
- To deploy to a preview account/environment, append `--env <name>` and configure that env in `wrangler.jsonc`.
- D1 bindings are environment-specific; ensure each env references the correct `database_id`.
- Use `bunx wrangler tail` to stream Worker logs immediately after deploy.

### 4. Deploy the React UI via Cloudflare Pages
You can deploy through CI (recommended) or manually with Wrangler.

**Manual one-off deploy**
```bash
cd web
bun install
VITE_API_URL=https://countdown-worker.<your-subdomain>.workers.dev bun run build
bunx wrangler pages deploy dist --project-name countdown-ui
```
- Replace `countdown-ui` with your Pages project name.
- Set `VITE_API_URL` to your deployed Worker URL.
- The first run will prompt you to create the project if it does not exist.

**Git/CI-driven deploy (typical flow)**
1. Create a Pages project in the Cloudflare dashboard pointing at your repository.
2. Set the build command to `bun run build` and the output directory to `web/dist`.
3. Configure the root directory to `web/` so the Pages builder runs inside the frontend workspace.
4. Set the environment variable `VITE_API_URL` to your Worker URL.
5. On each push to the production branch, Pages builds and publishes automatically.

### 5. Post-deployment verification
- **Health check**: `curl https://<worker-domain>/health` should return `{ "status": "ok" }`.
- **Create session**: `curl -X POST https://<worker-domain>/api/sessions -d '{"label":"Test","startTimeUtc":"2026-01-01T00:00:00Z","durationMs":3600000}' -H 'content-type: application/json'`.
- **List sessions**: `curl https://<worker-domain>/api/sessions` to verify D1 writes succeed.
- **UI**: Visit the Cloudflare Pages URL; confirm it fetches from the Worker.

### 6. Rolling updates & maintenance
- Re-run `bunx wrangler deploy` after modifying Worker code, Durable Object logic, or `wrangler.jsonc` bindings.
- Re-run `bunx wrangler d1 migrations apply <name>` once you introduce formal migrations (recommended for future schema changes).
- For coordinated releases, deploy the Worker first (API compatibility), then publish the Pages build.
- Capture backups via `bunx wrangler d1 export countdown-db > backup.sql` before major schema or data changes.

### GitHub Actions Automation
A workflow at `.github/workflows/deploy.yml` automates both deployments:
- Triggers on pushes to `main` or via manual `workflow_dispatch`.
- **Secrets required:** `CLOUDFLARE_API_TOKEN` (with Workers + Pages + D1 permissions) and `CLOUDFLARE_ACCOUNT_ID`.
- **Repository variables:**
  - `CF_PAGES_PROJECT_NAME` – Cloudflare Pages project slug receiving the frontend build.
  - `CF_D1_DATABASE_NAME` – Name/identifier of the D1 database (enables the optional migration step).
  - `CF_D1_MIGRATIONS_ENABLED` – Set to `true` to run `wrangler d1 migrations apply` before deploying the Worker.
- Worker job runs `bunx wrangler deploy`; the web job builds `web/` and publishes via `bunx wrangler pages deploy`.

## Status
- [x] Architecture + data model defined
- [x] UI scaffolded with Tailwind theme
- [x] Worker + Durable Object scaffolded with CRUD routes and D1 sync hooks
- [x] UI wired to Worker API (sessions CRUD)
- [ ] Countdown logic + live updates implemented
- [ ] Deployment targets configured
