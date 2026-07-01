# CL Motorsport's Countdown App

A Cloudflare-native countdown scheduler for CL Motorsport team.

## Stack Overview
- **UI**: React 19 + TanStack Router + TypeScript + Tailwind CSS, built with Vite 7 and deployed through Cloudflare Pages. Package management via Bun 1.2+, targeting Node.js 22 for Cloudflare runtime parity.
- **API**: Cloudflare Worker (modules syntax) exposing RESTful endpoints for session CRUD.
- **Persistence**: Cloudflare D1 is the source of truth, with one row per countdown session and optimistic version checks for concurrent updates.

## Project Layout
- `web/` – Vite + React + Tailwind frontend that visualizes countdown data and connects to the Worker API.
- `worker/` – Cloudflare Worker exposing `/api/sessions/...` and reading/writing D1 directly.

## Architecture
1. User creates/edits countdown sessions via the React UI.
2. The UI calls the Worker HTTP API.
3. The Worker validates requests and executes row-oriented SQL against D1.
4. Updates and deletes include the last-read row version. D1 applies the mutation only when that version still matches, returning `409 Conflict` for stale clients.

```
Pages (React UI) ──HTTP──▶ Worker API ──SQL──▶ D1
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
| `version` | number | Incremented on update and used to reject stale writes. |
| `createdAt` | string (ISO) | Creation timestamp. |
| `updatedAt` | string (ISO) | Last update timestamp. |

### D1 tables
```sql
sessions (
  session_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  start_time_utc TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  metadata TEXT,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

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
bun run db:migrate:local
bun run dev
```

### API Endpoints
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Simple readiness check. |
| `GET` | `/api/sessions` | List all sessions. |
| `POST` | `/api/sessions` | Create a new session. Body: `{ "label": "Name", "startTimeUtc": "...", "durationMs": 1800000 }`. |
| `GET` | `/api/sessions/:sessionId` | Get a specific session. |
| `PATCH` | `/api/sessions/:sessionId` | Update a session. Body must include `expectedVersion`. |
| `DELETE` | `/api/sessions/:sessionId` | Delete a session. Body must include `expectedVersion`. |

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
Apply the checked-in migration after creating the database:
```bash
cd worker
bun run db:migrate:local
```

Migration `0001_normalize_sessions.sql` also imports sessions from the legacy `countdown_state` JSON snapshot. It intentionally retains the legacy snapshot and event tables for rollback and audit purposes; the refactored Worker does not read or write them.

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

2. **Schema**: apply the checked-in migration to the remote database:
   ```bash
   bun run db:migrate:remote
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
- [x] Worker CRUD routes backed directly by normalized D1 rows
- [x] UI wired to Worker API (sessions CRUD)
- [ ] GitHub Actions CI/CD workflow
