# CL Motorsport's Countdown App

Cloudflare-native countdown scheduler for motorsport (or any time-critical event) series. The project keeps every browser tab in sync by letting a single Durable Object instance own each set of related countdown sessions, while Cloudflare Pages serves the React UI.

## Stack Overview
- **UI**: Vite + React + TypeScript + Tailwind CSS, deployed through Cloudflare Pages. Tooling runs on Bun 1.2+ while still targeting Node.js 22 for Cloudflare runtime parity.
- **API**: Cloudflare Worker (modules syntax) routing REST + WebSocket/SSE traffic.
- **State coordinator**: Cloudflare Durable Object per `CountdownGroup`, responsible for ordering `CountdownSession`s, triggering automatic starts, and broadcasting real-time ticks.
- **Persistence**: Cloudflare D1 keeps durable snapshots/events. Optional R2 backups for exports.

## Project Layout
- `web/` – Vite + React + Tailwind frontend mock that already visualizes countdown data and will later subscribe to the Worker.
- `worker/` – Cloudflare Worker with a `CountdownGroupDurableObject`, REST surface (`/api/groups/...`), and D1 bindings for snapshots + audit events.
- `.nvmrc` – pins Node.js 22 for both workspaces.

## Architecture
1. User creates/edit countdown sessions via the React UI.
2. UI calls the Worker HTTP API. Worker routes to the relevant Durable Object (group id deterministic name).
3. Durable Object validates mutations, updates its in-memory `sessions` list, syncs changes to D1 (`groups` snapshot plus append-only `events` row), and notifies any connected clients.
4. Clients maintain a WebSocket/SSE subscription per group; the DO emits authoritative timestamps roughly every second so all tabs show the same remaining time.
5. DO alarms wake up at exact session boundaries to flip statuses (`scheduled → running → complete`) and immediately start the next session (the “plan ahead” chain).

```
Pages (React UI) ──HTTP/WebSocket──▶ Worker Router ──fetchStub──▶ CountdownGroup Durable Object
                                                   │
                                                   └────SQL────▶ D1 (snapshots + events)
```

## Data Model

### CountdownGroup (Durable Object state + `groups` table snapshot)
| Field | Type | Notes |
| --- | --- | --- |
| `groupId` | string | Deterministic durable object name, also PK in D1 `groups`. |
| `label` | string | Display name (e.g., “Day 1”). |
| `timezone` | string | IANA identifier for human-facing display math. |
| `sessions` | `CountdownSession[]` | Sorted array in-memory; serialized into D1 snapshot JSON. |
| `activeSessionId` | string \| null | The session currently `running`. |
| `listeners` | runtime set | WebSocket/SSE references (not persisted). |
| `version` | number | Incremented on each mutation; used for optimistic D1 writes. |

### CountdownSession
| Field | Type | Notes |
| --- | --- | --- |
| `sessionId` | string (UUID) | Unique within group. |
| `label` | string | e.g., “Qualifying”. |
| `startTimeUtc` | string (ISO) | UTC start timestamp; primary ordering key. |
| `durationMs` | number | Duration in milliseconds (deterministic end = start + duration). |
| `status` | enum | `scheduled`, `running`, `complete`, `canceled`. |
| `metadata` | JSON | Optional notes (track, stream URL, etc.). |

### D1 tables
```
groups (
  group_id TEXT PRIMARY KEY,
  label TEXT,
  timezone TEXT,
  version INTEGER,
  snapshot TEXT,        -- JSON blob of DO state excluding listeners
  created_at TEXT,
  updated_at TEXT
);

events (
  event_id TEXT PRIMARY KEY,
  group_id TEXT,
  session_id TEXT,
  action TEXT,
  payload TEXT,
  occurred_at TEXT
);
```
Durable Object appends to `events` for every mutation and periodically refreshes `groups.snapshot`. Cold starts replay snapshot + subsequent events to rebuild memory.

## Implementation Roadmap
1. ✅ Scaffold UI with Vite/React/TS/Tailwind (Node 22).
2. ✅ Initialize Worker project via `wrangler`, including bindings for Durable Object + D1.
3. ☐ Implement DO scheduling/timer logic, alarms, and WebSocket fan-out.
4. ☐ Connect UI to Worker APIs (mutations + live data) and add auth.
5. ☐ Add deployment scripts (Pages build, `wrangler deploy` for worker) plus infra as code for D1.

## Development Setup
> Requires Node.js 22 (run `nvm use 22` from the repo root to sync with `.nvmrc`) and Bun 1.2+ for package management (`curl -fsSL https://bun.sh/install | bash`).

### Frontend (`web/`)
```bash
cd web
bun install
bun run dev        # starts Vite on http://localhost:5173
```
The current UI uses mocked countdown data but exercises the layout + Tailwind theme we’ll reuse once the Worker API is wired up.

### Worker (`worker/`)
```bash
cd worker
bun install
bunx wrangler d1 create countdown-db                # once per account, creates the D1 database backing the binding
bunx wrangler dev --local --persist-to=./.wrangler  # runs the Worker + Durable Object locally
```
Endpoints available while `bunx wrangler dev` is running:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Simple readiness check. |
| `POST` | `/api/groups` | Creates/initializes a countdown group. Body: `{ "label": "Name", "timezone": "UTC" }`. |
| `GET` | `/api/groups/:groupId` | Fetches stored state for a group (proxied to the Durable Object). |
| `POST` | `/api/groups/:groupId/sessions` | Adds a scheduled session to the group. |
| `PATCH`/`DELETE` | `/api/groups/:groupId/sessions/:sessionId` | Update or delete an existing session. |

Example:
```bash
curl -X POST http://localhost:8787/api/groups \
  -H "content-type: application/json" \
  -d '{"label":"NYE 2026","timezone":"UTC"}'
```
Use the returned `groupId` to add sessions:
```bash
curl -X POST http://localhost:8787/api/groups/ny-2026/sessions \
  -H "content-type: application/json" \
  -d '{"label":"Warm-up","startTimeUtc":"2026-01-01T13:00:00.000Z","durationMs":1800000}'
```

### Database bootstrap (D1)
Run the following once after `bunx wrangler d1 create countdown-db` to lay down tables:
```sql
CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  timezone TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  occurred_at TEXT NOT NULL
);
```
These mirror the schema the Durable Object already writes to.

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
   bunx wrangler d1 create countdown-db
   ```
   Copy the returned `binding`, `database_name`, and `database_id` into `worker/wrangler.jsonc` if they differ from the placeholders.
2. **Schema**: run the statements from [Database bootstrap (D1)](#database-bootstrap-d1) so the Worker can persist snapshots/events:
   ```bash
   bunx wrangler d1 execute countdown-db --command "CREATE TABLE IF NOT EXISTS ..."
   ```
   (Paste both `groups` and `events` `CREATE TABLE` statements into the `--command` flag or a `.sql` file.)
3. **Durable Object migration**: the first `wrangler deploy` automatically registers the `CountdownGroupDurableObject` because `wrangler.jsonc` already includes the `new_sqlite_classes` migration tag (`v1`). No manual step is needed beyond the initial deploy.

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
bun run build                              # produces dist/
bunx wrangler pages deploy dist --project-name countdown-ui
```
- Replace `countdown-ui` with your Pages project name.
- The first run will prompt you to create the project if it does not exist.

**Git/CI-driven deploy (typical flow)**
1. Create a Pages project in the Cloudflare dashboard pointing at your repository.
2. Set the build command to `bun run build` and the output directory to `web/dist`.
3. Configure the root directory to `web/` so the Pages builder runs inside the frontend workspace.
4. On each push to the production branch, Pages builds and publishes automatically.

### 5. Post-deployment verification
- **Health check**: `curl https://<worker-domain>/healthz` should return `{ "status": "ok" }`.
- **Bootstrap group**: `curl -X POST https://<worker-domain>/api/groups -d '{"label":"Launch","timezone":"UTC"}' -H 'content-type: application/json'`.
- **Add session**: `curl -X POST https://<worker-domain>/api/groups/<groupId>/sessions ...` to ensure D1 writes succeed (check via `bunx wrangler d1 execute countdown-db --command "SELECT * FROM groups"`).
- **UI**: Visit the Cloudflare Pages URL; confirm it fetches from the Worker (or uses mocked data until integration is complete).

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
- [x] UI scaffolded with Tailwind theme + mock data
- [x] Worker + Durable Object scaffolded with CRUD routes and D1 sync hooks
- [ ] Countdown logic + live updates implemented
- [ ] Deployment targets configured
