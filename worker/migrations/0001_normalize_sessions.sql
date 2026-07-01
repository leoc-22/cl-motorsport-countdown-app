-- Create a row-oriented source of truth for direct D1 CRUD.
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  start_time_utc TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
  metadata TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_start_time_idx
  ON sessions (start_time_utc);

-- The previous implementation provisioned this table manually. Creating it
-- conditionally makes the migration work for both existing and new databases.
CREATE TABLE IF NOT EXISTS countdown_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Preserve sessions from the legacy Durable Object snapshot.
INSERT OR IGNORE INTO sessions (
  session_id,
  label,
  start_time_utc,
  duration_ms,
  metadata,
  version,
  created_at,
  updated_at
)
SELECT
  json_extract(session.value, '$.sessionId'),
  json_extract(session.value, '$.label'),
  json_extract(session.value, '$.startTimeUtc'),
  json_extract(session.value, '$.durationMs'),
  json_extract(session.value, '$.metadata'),
  1,
  state.created_at,
  state.updated_at
FROM countdown_state AS state,
     json_each(state.snapshot, '$.sessions') AS session
WHERE state.id = 'default'
  AND json_valid(state.snapshot)
  AND json_extract(session.value, '$.sessionId') IS NOT NULL;
