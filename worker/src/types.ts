export type SessionStatus = "scheduled" | "running" | "complete" | "canceled";

export type CountdownSession = {
  sessionId: string;
  label: string;
  startTimeUtc: string;
  durationMs: number;
  status: SessionStatus;
  metadata?: Record<string, unknown>;
};

export type CountdownState = {
  sessions: CountdownSession[];
  activeSessionId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CountdownEnv = {
  COUNTDOWN_DO: DurableObjectNamespace;
  COUNTDOWN_DB: D1Database;
};
