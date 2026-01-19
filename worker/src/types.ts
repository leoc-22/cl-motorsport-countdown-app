export type CountdownSession = {
  sessionId: string;
  label: string;
  startTimeUtc: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
};

export type CountdownEnv = {
  COUNTDOWN_DB: D1Database;
};
