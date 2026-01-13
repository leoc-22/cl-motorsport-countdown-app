# CL Motorsport's Countdown App

A Cloudflare-native countdown scheduler for CL Motorsport team.

## Stack Overview
- **UI**: React 19 + TanStack Router + TypeScript + Tailwind CSS, built with Vite 7 and deployed through Cloudflare Pages. Package management via Bun 1.2+, targeting Node.js 22 for Cloudflare runtime parity.
- **API**: Cloudflare Worker (modules syntax) exposing RESTful endpoints for session CRUD.
- **State coordinator**: Single Cloudflare Durable Object (`CountdownDurableObject`) responsible for managing all `CountdownSession`s with in-memory caching and D1-backed persistence.
- **Persistence**: Cloudflare D1 stores snapshots (`countdown_state`) and an append-only event log (`events`) for durability and cold-start recovery.

## Project Layout
- `web/` – Vite + React + Tailwind frontend that visualizes countdown data and connects to the Worker API.
- `worker/` – Cloudflare Worker with a `CountdownDurableObject`, REST surface (`/api/sessions/...`), and D1 bindings for snapshots + audit events.

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
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,        -- JSON blob of DO state
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,                  -- nullable JSON
  occurred_at TEXT NOT NULL
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
   bunx wrangler d1 create countdown-db
   ```
   Wrangler outputs a `database_id`; update the `database_id` field in `worker/wrangler.jsonc` under the `d1_databases` binding.

2. **Schema**: run the following to create the required tables on the **remote** database:
   ```bash
   # Create countdown_state table
   bunx wrangler d1 execute countdown-db --remote --command "CREATE TABLE IF NOT EXISTS countdown_state (id TEXT PRIMARY KEY DEFAULT 'default', version INTEGER NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);"

   # Create events table
   bunx wrangler d1 execute countdown-db --remote --command "CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, action TEXT NOT NULL, payload TEXT, occurred_at TEXT NOT NULL);"
   ```

3. **Durable Object migration**: the first `wrangler deploy` automatically registers the `CountdownDurableObject` because `wrangler.jsonc` includes the `new_sqlite_classes` migration tag (`v2`). No manual step needed.

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

## Troubleshooting

### `wrangler types` fails with migration errors

If you see errors like:
```
Cannot apply new_sqlite_classes migration to existing class CountdownDurableObject
```
or
```
Cannot apply deleted_classes migration to non-existent class ...
```

This happens when Wrangler's local or remote migration state is out of sync with your `wrangler.jsonc` migrations.

**Solution:**
1. Clear local Wrangler state: `rm -rf worker/.wrangler`
2. If the error persists, consolidate your migrations in `wrangler.jsonc`. For a fresh deployment, you can combine multiple migration steps into one (e.g., use `new_sqlite_classes` directly instead of `new_classes` followed by a separate SQLite migration).
3. Remove any `deleted_classes` migrations that reference classes that were never deployed.

**Important:** Only consolidate migrations if you haven't deployed them to production yet. Once migrations are deployed, they become part of the permanent history.

## Status
- [x] Architecture + data model defined
- [x] UI scaffolded with Tailwind theme
- [x] Worker + Durable Object scaffolded with CRUD routes and D1 sync hooks
- [x] UI wired to Worker API (sessions CRUD)
- [ ] Countdown logic + live updates implemented
- [ ] GitHub Actions CI/CD workflow
