# DETAILED ISSUE TRACKER WITH FIXES

## CRITICAL ISSUES (🔴 MUST FIX)

### ISSUE #1: No Authentication on API Endpoints
**Location**: `/home/user/cl-motorsport-countdown-app/worker/src/index.ts` (all endpoints)
**Severity**: CRITICAL
**Lines Affected**: 79, 109, 155, 188, 220

**Problem**:
All API endpoints are completely open:
- POST /api/groups (create unlimited groups)
- GET /api/groups/:groupId (access any group)
- POST/PATCH/DELETE /api/groups/:groupId/sessions (modify any session)

**Solution**:
```typescript
// Option 1: API Key Authentication (simple)
const validateApiKey = (request: Request, env: CountdownEnv): boolean => {
  const apiKey = request.headers.get('x-api-key');
  return apiKey === env.API_KEY;
};

// Option 2: JWT Authentication (recommended)
// Use a JWT library like jose for Cloudflare Workers
const validateJwt = async (request: Request, env: CountdownEnv): Promise<boolean> => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  // Verify token with env.JWT_SECRET
};

// Then add to fetch handler:
export default {
  async fetch(request, env): Promise<Response> {
    if (!validateApiKey(request, env)) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    // ... rest of code
  }
};
```

**Dependencies to add**: `jose` for JWT support
**Effort**: 2-4 hours

---

### ISSUE #2: Silent Database Failures (Data Loss Risk)
**Location**: `/home/user/cl-motorsport-countdown-app/worker/src/index.ts`
**Severity**: CRITICAL
**Lines Affected**: 270-295 (persistSnapshot), 297-315 (recordEvent)

**Problem**:
```typescript
async #persistSnapshot(state: CountdownGroupState): Promise<void> {
  try {
    await this.env.COUNTDOWN_D1.prepare(...)...run();
  } catch (error) {
    console.warn("D1 snapshot sync failed", error);  // ❌ Silent fail
    // State is lost if D1 is down
  }
}
```

**Solution**:
```typescript
async #persistSnapshot(state: CountdownGroupState, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await this.env.COUNTDOWN_D1.prepare(
        `INSERT INTO groups (...) VALUES (...)
         ON CONFLICT(group_id) DO UPDATE SET ...`
      )
      .bind(...)
      .run();
      return true;
    } catch (error) {
      console.error(`D1 snapshot attempt ${attempt}/${retries} failed:`, error);
      
      if (attempt === retries) {
        // Last attempt failed - return error to client
        throw new Error("Failed to persist state to database");
      }
      
      // Exponential backoff: 100ms, 200ms, 400ms
      await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt - 1)));
    }
  }
  return false;
}

// Update saveState to check result:
async #saveState(state: CountdownGroupState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  state.version += 1;
  await this.#storage.put("group", state);
  this.#stateCache = state;
  
  // Now it will throw if D1 fails after retries
  await this.#persistSnapshot(state);
}
```

**Impact**: Immediate - prevents data loss
**Effort**: 1-2 hours

---

### ISSUE #3: No Input Validation
**Location**: `/home/user/cl-motorsport-countdown-app/worker/src/index.ts`
**Severity**: CRITICAL
**Lines Affected**: 165-176 (create session), 188-218 (update session)

**Problem**:
```typescript
// No validation that status is valid
if (payload?.status) target.status = payload.status; // Could be "xyz"

// No validation of dates/durations
if (!payload?.label || !payload.startTimeUtc || !payload.durationMs) {
  return badRequest(...);
}
// But doesn't check if startTimeUtc is valid ISO, if durationMs > 0, etc.
```

**Solution - Add Zod Schema Validation**:
```typescript
import { z } from "zod";

const SessionStatusSchema = z.enum(["scheduled", "running", "complete", "canceled"]);
const CreateSessionSchema = z.object({
  label: z.string().min(1).max(255),
  startTimeUtc: z.string().datetime(),
  durationMs: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateSessionSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  startTimeUtc: z.string().datetime().optional(),
  durationMs: z.number().int().positive().optional(),
  status: SessionStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Use in route handlers:
if (request.method === "POST" && url.pathname === "/sessions") {
  const payload = (await request.json().catch(() => null)) as unknown;
  
  const result = CreateSessionSchema.safeParse(payload);
  if (!result.success) {
    return badRequest("Invalid session data", {
      errors: result.error.flatten(),
    });
  }
  
  const validated = result.data;
  // Now validated.label, .startTimeUtc, .durationMs are guaranteed correct
}
```

**Dependencies to add**: `zod`
**Effort**: 2-3 hours

---

### ISSUE #4: Broken Wrangler Configuration
**Location**: `/home/user/cl-motorsport-countdown-app/worker/wrangler.jsonc`
**Severity**: CRITICAL
**Lines Affected**: 10-16, 26-31

**Problem**:
```jsonc
{
  "migrations": [
    {
      "new_sqlite_classes": ["CountdownGroupDurableObject"],  // ❌ WRONG
      "tag": "v1"
    }
  ],
  "d1_databases": [
    {
      "binding": "COUNTDOWN_D1",
      "database_name": "countdown-db",
      "database_id": "countdown-db"  // ❌ PLACEHOLDER
    }
  ]
}
```

**Solution**:
```jsonc
{
  "migrations": [
    {
      "new_classes": ["CountdownGroupDurableObject"],  // ✅ CORRECT
      "tag": "v1"
    }
  ],
  "d1_databases": [
    {
      "binding": "COUNTDOWN_D1",
      "database_name": "countdown-db",
      "database_id": "ABC123DEF456GHI789"  // ✅ Use actual ID from `wrangler d1 create countdown-db`
    }
  ]
}
```

**Steps**:
1. Run: `wrangler d1 create countdown-db`
2. Copy the database_id from output
3. Replace "countdown-db" placeholder in wrangler.jsonc
4. Change migration syntax from `new_sqlite_classes` to `new_classes`

**Effort**: 30 minutes

---

### ISSUE #5: Zero Test Coverage
**Location**: No test files exist
**Severity**: CRITICAL
**Missing**: All tests

**Solution - Set up Vitest**:

```bash
# In worker directory
npm install --save-dev vitest @vitest/ui miniflare

# Create worker/src/__tests__/index.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { CountdownGroupDurableObject } from "../index";

describe("Countdown Group Durable Object", () => {
  let doState;
  let env;

  beforeEach(() => {
    env = {
      COUNTDOWN_D1: {
        prepare: () => ({ bind: () => ({ run: () => {} }) }),
      },
      COUNTDOWN_GROUP: {
        idFromName: (name) => name,
        get: () => ({}),
      },
    };
  });

  it("should initialize with default state", async () => {
    const ctx = {
      id: "test-group",
      storage: {
        get: () => null,
        put: () => {},
      },
    };
    const do = new CountdownGroupDurableObject(ctx, env);
    expect(do).toBeDefined();
  });

  it("should validate session creation payload", () => {
    // Test validation logic
  });

  it("should sort sessions by startTimeUtc", () => {
    // Test sorting
  });
});
```

```bash
# In web directory
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react

# Create web/src/__tests__/App.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App";

describe("App Component", () => {
  it("renders the main heading", () => {
    render(<App />);
    expect(screen.getByText(/Plan once/i)).toBeDefined();
  });

  it("displays active session", () => {
    render(<App />);
    expect(screen.getByText(/Warm-up Run/i)).toBeDefined();
  });
});
```

**Effort**: 4-6 hours

---

### ISSUE #6: TypeScript Build Errors
**Location**: All projects
**Severity**: CRITICAL
**Error**: "Cannot find type definition file for 'vite/client'"

**Solution**:
```bash
cd /home/user/cl-motorsport-countdown-app/web
npm install

cd /home/user/cl-motorsport-countdown-app/worker
npm install

# Test builds
npm run build  # web
npm run cf-typegen  # worker
```

**Effort**: 15 minutes

---

## HIGH PRIORITY ISSUES (🟠 SHOULD FIX)

### ISSUE #7: React Hook Dependency Arrays
**Location**: `/home/user/cl-motorsport-countdown-app/web/src/App.tsx`
**Severity**: MEDIUM
**Lines Affected**: 107-113, 111-114

**Problem**:
```typescript
// Line 107-113: Empty dependency array but depends on MOCK_GROUP
const activeSession = useMemo(
  () => MOCK_GROUP.sessions.find((session) => session.status === 'running') ?? MOCK_GROUP.sessions[0],
  [],  // ❌ Should include MOCK_GROUP.sessions
)

// Line 111-114: Incomplete dependencies
const upcomingSessions = useMemo(
  () => MOCK_GROUP.sessions.filter((session) => session.sessionId !== activeSession.sessionId),
  [activeSession.sessionId],  // ❌ Missing MOCK_GROUP.sessions
)
```

**Solution**:
```typescript
// When you receive group as prop:
function App({ group }: { group: CountdownGroup }) {
  const activeSession = useMemo(
    () => group.sessions.find((session) => session.status === 'running') ?? group.sessions[0],
    [group.sessions],  // ✅ CORRECT
  )
  
  const upcomingSessions = useMemo(
    () => group.sessions.filter((session) => session.sessionId !== activeSession.sessionId),
    [group.sessions, activeSession.sessionId],  // ✅ CORRECT
  )
}
```

**Note**: Currently uses MOCK_GROUP constant, so this will be fixed when connecting to API

**Effort**: 30 minutes

---

### ISSUE #8: Core Feature Not Implemented
**Location**: `/home/user/cl-motorsport-countdown-app/worker/src/index.ts`
**Severity**: HIGH
**Missing**: WebSocket handlers, Durable Object alarms, state broadcasts

**What's Missing**:
1. WebSocket/SSE subscription support
2. Durable Object alarms for session scheduling
3. Broadcasting state changes to all connected clients
4. Real-time tick updates

**Rough Implementation Plan**:
```typescript
// Add to CountdownGroupDurableObject class:

#listeners: Set<WebSocket> = new Set();

async fetch(request: Request): Promise<Response> {
  // ... existing code ...
  
  // Add WebSocket upgrade
  if (request.headers.get("upgrade") === "websocket") {
    const pair = new WebSocketPair();
    await this.handleWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
}

private async handleWebSocket(ws: WebSocket) {
  this.#listeners.add(ws);
  ws.accept();
  
  // Send current state
  const state = await this.#loadState();
  ws.send(JSON.stringify({
    type: "state",
    data: state,
  }));
  
  // Schedule tick broadcasts
  this.ctx.waitUntil(
    (async () => {
      while (this.#listeners.has(ws)) {
        await new Promise(r => setTimeout(r, 1000));
        const state = await this.#loadState();
        const msg = JSON.stringify({
          type: "tick",
          timestamp: Date.now(),
          sessions: state.sessions,
        });
        for (const listener of this.#listeners) {
          try {
            listener.send(msg);
          } catch {
            this.#listeners.delete(listener);
          }
        }
      }
    })()
  );
}

// Add alarm scheduling
async #scheduleNextAlarm(state: CountdownGroupState) {
  const now = Date.now();
  const nextSession = state.sessions.find(s => 
    Date.parse(s.startTimeUtc) > now && s.status === "scheduled"
  );
  
  if (nextSession) {
    const alarmTime = Date.parse(nextSession.startTimeUtc);
    await this.ctx.storage.setAlarm(alarmTime);
  }
}

// Add alarm handler
async alarm(): Promise<void> {
  const state = await this.#loadState();
  const now = Date.now();
  
  // Update session statuses
  for (const session of state.sessions) {
    const start = Date.parse(session.startTimeUtc);
    const end = start + session.durationMs;
    
    if (now >= start && now < end && session.status === "scheduled") {
      session.status = "running";
      state.activeSessionId = session.sessionId;
    } else if (now >= end && session.status === "running") {
      session.status = "complete";
    }
  }
  
  await this.#saveState(state);
  await this.#scheduleNextAlarm(state);
  
  // Broadcast to all listeners
  for (const listener of this.#listeners) {
    listener.send(JSON.stringify({
      type: "state",
      data: state,
    }));
  }
}
```

**Effort**: 6-8 hours

---

### ISSUE #9: Hardcoded Timezone
**Location**: `/home/user/cl-motorsport-countdown-app/web/src/App.tsx`
**Severity**: MEDIUM
**Lines Affected**: 49-52, should use group.timezone

**Fix**:
```typescript
// BEFORE:
const intlCache = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

// AFTER:
function formatTimeInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
}

// Use in component:
{formatTimeInTimezone(new Date(activeSession.startTimeUtc), group.timezone)}
```

**Effort**: 30 minutes

---

### ISSUE #10: No CORS Configuration
**Location**: `/home/user/cl-motorsport-countdown-app/worker/src/index.ts`
**Severity**: MEDIUM

**Fix**:
```typescript
const corsHeaders = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Access-Control-Max-Age": "86400",
});

export default {
  async fetch(request, env): Promise<Response> {
    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request.headers.get("origin") || undefined),
      });
    }

    // ... existing code ...
    
    // Add CORS headers to responses
    const response = await handleRoute(...);
    Object.entries(corsHeaders()).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
};
```

**Effort**: 1-2 hours

---

### ISSUE #11: Silent JSON Parsing Errors
**Location**: `/home/user/cl-motorsport-countdown-app/worker/src/index.ts`
**Severity**: MEDIUM
**Lines Affected**: 84, 142, 156, 190

**Current Code**:
```typescript
const payload = (await request.json().catch(() => null)) as ...
if (!payload?.label) {
  return badRequest("label is required");
}
```

**Problem**: If JSON.parse fails, null is returned, then error says "label is required" - confusing!

**Solution**:
```typescript
let payload: unknown;
try {
  payload = await request.json();
} catch (error) {
  console.error("Failed to parse JSON:", error);
  return badRequest("Invalid JSON in request body", {
    detail: error instanceof Error ? error.message : "Unknown parse error",
  });
}

const typedPayload = payload as Record<string, unknown> | null;
if (!typedPayload?.label) {
  return badRequest("label is required");
}
```

**Effort**: 1-2 hours

---

### ISSUE #12: Missing Database Migrations
**Location**: No migration files in git
**Severity**: MEDIUM

**Solution - Create Migration Files**:

Create `/home/user/cl-motorsport-countdown-app/worker/migrations/001_init_schema.sql`:
```sql
-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  timezone TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_groups_updated_at ON groups(updated_at DESC);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES groups(group_id)
);

-- Create indexes for event queries
CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at DESC);
```

Create a migration runner in `worker/scripts/migrate.ts`:
```typescript
import { execSync } from "child_process";
import * as fs from "fs";

async function migrate() {
  const migrationFiles = fs.readdirSync("./migrations")
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(`./migrations/${file}`, "utf-8");
    console.log(`Running migration: ${file}`);
    // Use wrangler d1 execute command
    execSync(`wrangler d1 execute countdown-db --file=./migrations/${file}`, {
      stdio: "inherit",
    });
  }

  console.log("Migrations complete");
}

migrate().catch(console.error);
```

Add to `worker/package.json`:
```json
"scripts": {
  "migrate": "ts-node scripts/migrate.ts"
}
```

**Effort**: 1-2 hours

---

## SUMMARY

| Issue | Severity | Effort | Status |
|-------|----------|--------|--------|
| No Authentication | CRITICAL | 2-4h | 🔴 |
| Silent DB Failures | CRITICAL | 1-2h | 🔴 |
| Missing Validation | CRITICAL | 2-3h | 🔴 |
| Broken Wrangler | CRITICAL | 0.5h | 🔴 |
| Zero Tests | CRITICAL | 4-6h | 🔴 |
| Build Errors | CRITICAL | 0.25h | 🔴 |
| Hook Dependencies | MEDIUM | 0.5h | 🟠 |
| Core Features | HIGH | 6-8h | 🟠 |
| Hardcoded Timezone | MEDIUM | 0.5h | 🟠 |
| No CORS | MEDIUM | 1-2h | 🟠 |
| Silent Errors | MEDIUM | 1-2h | 🟠 |
| No Migrations | MEDIUM | 1-2h | 🟠 |
| **TOTAL** | **-** | **~27-35h** | **-** |

**Total effort**: About 1 week of focused development (assuming ~8 hours/day)

---

## IMPLEMENTATION ORDER

1. **Day 1**: Fix build errors, install deps, fix wrangler config
2. **Day 1-2**: Implement authentication and input validation
3. **Day 2-3**: Fix database error handling, add proper error responses
4. **Day 3**: Set up testing framework and write critical tests
5. **Day 4-5**: Implement real-time features (WebSocket, alarms)
6. **Day 5**: Fix remaining issues (CORS, timezone, migrations)

This order ensures the system is secure and reliable before adding advanced features.

