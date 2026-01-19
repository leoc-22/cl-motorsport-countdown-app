-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  start_time_utc TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for ordering by start time
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time_utc);

-- Events table for audit log (optional, keeping for history tracking)
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for querying events by session
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
