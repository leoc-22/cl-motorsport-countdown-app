# CL Motorsport's Countdown App

Cloudflare-native countdown scheduler for motorsport (or any time-critical event) series. The project keeps every browser tab in sync by letting a single Durable Object instance own each set of related countdown sessions, while Cloudflare Pages serves the React UI.

## Stack Overview
- **UI**: Vite + React + TypeScript + Tailwind CSS, deployed through Cloudflare Pages. Targets Node.js 22 for local tooling parity with Cloudflare’s workers runtime.
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
3. ✅ Add deployment scripts (GitHub Actions CI/CD for automated deployments).
4. ☐ Implement DO scheduling/timer logic, alarms, and WebSocket fan-out.
5. ☐ Connect UI to Worker APIs (mutations + live data) and add auth.

## Development Setup
> Requires Node.js 22 (run `nvm use 22` from the repo root to sync with `.nvmrc`).

### Frontend (`web/`)
```bash
cd web
npm install
npm run dev        # starts Vite on http://localhost:5173
```
The current UI uses mocked countdown data but exercises the layout + Tailwind theme we’ll reuse once the Worker API is wired up.

### Worker (`worker/`)
```bash
cd worker
npm install
wrangler d1 create countdown-db                # once per account, creates the D1 database backing the binding
wrangler dev --local --persist-to=./.wrangler  # runs the Worker + Durable Object locally
```
Endpoints available while `wrangler dev` is running:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/healthz` | Simple readiness check. |
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
Run the following once after `wrangler d1 create countdown-db` to lay down tables:
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

## Deployment

The project includes automated CI/CD via GitHub Actions for deploying to Cloudflare.

### Automated Deployment (Recommended)

Every push to `main` automatically deploys:
- **Worker** → Cloudflare Workers
- **Web** → Cloudflare Pages

**Setup instructions**: See [`.github/DEPLOYMENT.md`](.github/DEPLOYMENT.md) for:
- Required GitHub secrets configuration
- One-time Cloudflare setup steps
- Troubleshooting guide

### Manual Deployment

For manual deployments or local testing:

```bash
# Deploy worker
cd worker
npm run deploy

# Deploy web
cd web
pnpm build
wrangler pages deploy dist --project-name=motorsport-countdown
```

## Status
- [x] Architecture + data model defined
- [x] UI scaffolded with Tailwind theme + mock data
- [x] Worker + Durable Object scaffolded with CRUD routes and D1 sync hooks
- [x] GitHub Actions CI/CD pipeline configured
- [ ] Countdown logic + live updates implemented
