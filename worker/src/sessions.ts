import type {
  CountdownEnv,
  CountdownSession,
  CountdownSessionRow,
} from "./types";
import { badRequest, conflict, json, notFound } from "./utils";

type CreateSessionPayload = {
  label?: unknown;
  startTimeUtc?: unknown;
  durationMs?: unknown;
  metadata?: unknown;
};

type UpdateSessionPayload = CreateSessionPayload & {
  expectedVersion?: unknown;
};

const parseMetadata = (value: string | null): Record<string, unknown> | undefined => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const toSession = (row: CountdownSessionRow): CountdownSession => ({
  sessionId: row.session_id,
  label: row.label,
  startTimeUtc: row.start_time_utc,
  durationMs: row.duration_ms,
  metadata: parseMetadata(row.metadata),
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const isMetadata = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidDate = (value: string) => !Number.isNaN(Date.parse(value));

const getSession = async (db: D1Database, sessionId: string) => {
  const row = await db
    .prepare("SELECT * FROM sessions WHERE session_id = ?1")
    .bind(sessionId)
    .first<CountdownSessionRow>();

  return row ? toSession(row) : null;
};

export const handleSessionsRequest = async (
  request: Request,
  env: CountdownEnv,
): Promise<Response> => {
  const url = new URL(request.url);
  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  const sessionId = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;

  if (request.method === "GET" && url.pathname === "/api/sessions") {
    const result = await env.COUNTDOWN_DB.prepare(
      "SELECT * FROM sessions ORDER BY start_time_utc ASC",
    ).all<CountdownSessionRow>();

    return json(result.results.map(toSession));
  }

  if (request.method === "POST" && url.pathname === "/api/sessions") {
    const payload = (await request.json().catch(() => null)) as CreateSessionPayload | null;

    if (
      typeof payload?.label !== "string" ||
      payload.label.trim() === "" ||
      typeof payload.startTimeUtc !== "string" ||
      !isValidDate(payload.startTimeUtc) ||
      typeof payload.durationMs !== "number" ||
      !Number.isFinite(payload.durationMs) ||
      payload.durationMs <= 0 ||
      (payload.metadata !== undefined && !isMetadata(payload.metadata))
    ) {
      return badRequest(
        "label, a valid startTimeUtc, and a positive durationMs are required; metadata must be an object",
      );
    }

    const now = new Date().toISOString();
    const session: CountdownSession = {
      sessionId: crypto.randomUUID(),
      label: payload.label.trim(),
      startTimeUtc: new Date(payload.startTimeUtc).toISOString(),
      durationMs: payload.durationMs,
      metadata: payload.metadata,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await env.COUNTDOWN_DB.prepare(
      `INSERT INTO sessions (
        session_id, label, start_time_utc, duration_ms, metadata,
        version, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
      .bind(
        session.sessionId,
        session.label,
        session.startTimeUtc,
        session.durationMs,
        session.metadata ? JSON.stringify(session.metadata) : null,
        session.version,
        session.createdAt,
        session.updatedAt,
      )
      .run();

    return json(session, { status: 201 });
  }

  if (request.method === "GET" && sessionId) {
    const session = await getSession(env.COUNTDOWN_DB, sessionId);
    return session ? json(session) : notFound("Session");
  }

  if (request.method === "PATCH" && sessionId) {
    const payload = (await request.json().catch(() => null)) as UpdateSessionPayload | null;
    const expectedVersion = payload?.expectedVersion;

    if (!Number.isInteger(expectedVersion) || (expectedVersion as number) < 1) {
      return badRequest("expectedVersion must be a positive integer");
    }

    const current = await getSession(env.COUNTDOWN_DB, sessionId);
    if (!current) return notFound("Session");

    const label = payload?.label === undefined ? current.label : payload.label;
    const startTimeUtc =
      payload?.startTimeUtc === undefined ? current.startTimeUtc : payload.startTimeUtc;
    const durationMs =
      payload?.durationMs === undefined ? current.durationMs : payload.durationMs;
    const metadata =
      payload?.metadata === undefined
        ? current.metadata
        : isMetadata(payload.metadata)
          ? { ...(current.metadata ?? {}), ...payload.metadata }
          : payload.metadata;

    if (
      typeof label !== "string" ||
      label.trim() === "" ||
      typeof startTimeUtc !== "string" ||
      !isValidDate(startTimeUtc) ||
      typeof durationMs !== "number" ||
      !Number.isFinite(durationMs) ||
      durationMs <= 0 ||
      (metadata !== undefined && !isMetadata(metadata))
    ) {
      return badRequest(
        "label must be non-empty, startTimeUtc must be valid, durationMs must be positive, and metadata must be an object",
      );
    }

    const updatedAt = new Date().toISOString();
    const result = await env.COUNTDOWN_DB.prepare(
      `UPDATE sessions
       SET label = ?1,
           start_time_utc = ?2,
           duration_ms = ?3,
           metadata = ?4,
           version = version + 1,
           updated_at = ?5
       WHERE session_id = ?6 AND version = ?7`,
    )
      .bind(
        label.trim(),
        new Date(startTimeUtc).toISOString(),
        durationMs,
        metadata ? JSON.stringify(metadata) : null,
        updatedAt,
        sessionId,
        expectedVersion,
      )
      .run();

    if (result.meta.changes === 0) {
      return conflict("Session changed since it was loaded; refresh and try again");
    }

    const updated = await getSession(env.COUNTDOWN_DB, sessionId);
    return updated ? json(updated) : notFound("Session");
  }

  if (request.method === "DELETE" && sessionId) {
    const payload = (await request.json().catch(() => null)) as
      | { expectedVersion?: unknown }
      | null;
    const expectedVersion = payload?.expectedVersion;

    if (!Number.isInteger(expectedVersion) || (expectedVersion as number) < 1) {
      return badRequest("expectedVersion must be a positive integer");
    }

    const result = await env.COUNTDOWN_DB.prepare(
      "DELETE FROM sessions WHERE session_id = ?1 AND version = ?2",
    )
      .bind(sessionId, expectedVersion)
      .run();

    if (result.meta.changes === 0) {
      const exists = await getSession(env.COUNTDOWN_DB, sessionId);
      return exists
        ? conflict("Session changed since it was loaded; refresh and try again")
        : notFound("Session");
    }

    return json({ deleted: sessionId });
  }

  return notFound("Route");
};
