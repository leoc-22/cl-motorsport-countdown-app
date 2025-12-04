export type SessionStatus = "scheduled" | "running" | "complete" | "canceled";

export type CountdownSession = {
  sessionId: string;
  label: string;
  startTimeUtc: string;
  durationMs: number;
  status: SessionStatus;
  metadata?: Record<string, unknown>;
};

export type CountdownGroupState = {
  groupId: string;
  label: string;
  timezone: string;
  sessions: CountdownSession[];
  activeSessionId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CountdownEnv = {
  COUNTDOWN_GROUP: DurableObjectNamespace;
  COUNTDOWN_D1: D1Database;
};
