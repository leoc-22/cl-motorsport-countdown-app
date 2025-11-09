-- Migration: 0001_initial_schema
-- Description: Create initial tables for countdown groups and events
-- Date: 2025-11-09

-- Groups table: stores snapshots of countdown group state
CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  timezone TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,  -- JSON blob of Durable Object state
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Events table: append-only audit log of all mutations
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,  -- JSON blob with mutation details
  occurred_at TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at);
