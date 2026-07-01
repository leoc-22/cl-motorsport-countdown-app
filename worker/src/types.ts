export type CountdownSession = {
  sessionId: string;
  label: string;
  startTimeUtc: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CountdownSessionRow = {
  session_id: string;
  label: string;
  start_time_utc: string;
  duration_ms: number;
  metadata: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type CountdownEnv = {
  COUNTDOWN_DB: D1Database;
};
