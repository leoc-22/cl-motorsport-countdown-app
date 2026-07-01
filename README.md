# CL Motorsport's Countdown App

A Cloudflare-native countdown scheduler for CL Motorsport team.

## Stack Overview
- **UI**: React 19 + TanStack Router + TypeScript + Tailwind CSS, built with Vite 7 and served by Cloudflare Workers Static Assets.
- **API**: Cloudflare Worker exposing public reads and Cloudflare Access-protected configuration mutations.
- **Persistence**: Cloudflare D1 is the source of truth, with one row per countdown session and optimistic version checks for concurrent updates.

## Project Layout
- `web/` – Vite + React + Tailwind frontend that visualizes countdown data and connects to the Worker API.
- `worker/` – Cloudflare Worker exposing `/api/sessions/...` and reading/writing D1 directly.

## Architecture
1. The Worker serves the React SPA and HTTP API from one origin.
2. Live and focus views read countdown sessions from the public API.
3. Cloudflare Access gates `/configure` and `/configure/api/*`; the Worker also validates the Access JWT before every mutation.
4. The Worker validates requests and executes row-oriented SQL against D1.
5. Updates and deletes include the last-read row version. D1 applies the mutation only when that version still matches, returning `409 Conflict` for stale clients.

```
Worker Static Assets (React UI) ──▶ Worker API ──SQL──▶ D1
                Cloudflare Access ──────▲
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
cp .dev.vars.example .dev.vars
bun run dev
```

### API Endpoints
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Simple readiness check. |
| `GET` | `/api/sessions` | List all sessions. |
| `GET` | `/api/sessions/:sessionId` | Get a specific session. |
| `GET` | `/configure/api/me` | Return the authenticated Access identity. |
| `POST` | `/configure/api/sessions` | Create a session. Requires Cloudflare Access. |
| `PATCH` | `/configure/api/sessions/:sessionId` | Update a session. Requires Access and `expectedVersion`. |
| `DELETE` | `/configure/api/sessions/:sessionId` | Delete a session. Requires Access and `expectedVersion`. |

Example:
```bash
# Create a session
curl -X POST http://localhost:8787/configure/api/sessions \
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
- Cloudflare account with access to Workers, D1, and Zero Trust Access.
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

### 3. Configure Cloudflare Access

1. In **Zero Trust → Integrations → Identity providers**, add Google.
2. In **Access controls → Applications**, add a self-hosted application for the deployed app hostname with the path `configure`.
3. Set the application session to the desired duration, such as 30 days.
4. Add an Allow policy containing only the administrators' email addresses.
5. Copy the application audience tag and your team domain, then store them as Worker secrets:

```bash
cd worker
bunx wrangler secret put TEAM_DOMAIN
# Enter https://<your-team>.cloudflareaccess.com

bunx wrangler secret put POLICY_AUD
# Enter the Access application's AUD tag
```

The single `/configure` Access application also covers `/configure/api/*`.
The Worker independently verifies the JWT signature, issuer, audience, and expiry.
Do not set `AUTH_DISABLED` in Cloudflare; it is a localhost-only development switch.

### 4. Build and deploy the application
```bash
cd web
bun install
bun run build

cd ../worker
bun install
bun run deploy
```
The Worker deploy includes `web/dist` as static assets. Use `bunx wrangler tail`
to stream Worker logs after deployment.

### 5. Post-deployment verification
```bash
# Health check
curl https://<worker-domain>/health
# Expected: { "status": "ok" }

# List sessions
curl https://<worker-domain>/api/sessions
```
Visit `/configure` in a browser. Cloudflare should require Google sign-in before
serving the route, and the page should show the authenticated email address.

### 6. Rolling updates & maintenance
- **Application updates**: build `web/`, then re-run `bun run deploy` from `worker/`.
- **Access changes**: manage allowed email addresses in the Access policy without rebuilding the app.
- **Database backups**: `bunx wrangler d1 export countdown-db --remote --output backup.sql` before major changes.

## Status
- [x] Architecture + data model defined
- [x] UI scaffolded with Tailwind theme
- [x] Worker CRUD routes backed directly by normalized D1 rows
- [x] UI wired to Worker API (sessions CRUD)
- [ ] GitHub Actions CI/CD workflow
