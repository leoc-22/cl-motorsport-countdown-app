import { DurableObject } from "cloudflare:workers";
import type { CountdownEnv, CountdownState, CountdownSession } from "../types";
import { json, badRequest, notFound } from "../utils";

export class CountdownDurableObject extends DurableObject<CountdownEnv> {
  private stateCache: CountdownState | null = null;
  private readonly storage: DurableObjectState["storage"];

  constructor(ctx: DurableObjectState, env: CountdownEnv) {
    super(ctx, env);
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const state = await this.loadState();

    // GET /sessions - list all sessions
    if (request.method === "GET" && url.pathname === "/sessions") {
      return json(state.sessions);
    }

    // POST /sessions - create a new session
    if (request.method === "POST" && url.pathname === "/sessions") {
      const payload = (await request.json().catch(() => null)) as
        | {
            label?: string;
            startTimeUtc?: string;
            durationMs?: number;
            metadata?: Record<string, unknown>;
          }
        | null;

      if (!payload?.label || !payload.startTimeUtc || !payload.durationMs) {
        return badRequest("label, startTimeUtc and durationMs are required");
      }

      const session: CountdownSession = {
        sessionId: crypto.randomUUID(),
        label: payload.label,
        startTimeUtc: payload.startTimeUtc,
        durationMs: payload.durationMs,
        metadata: payload.metadata,
      };

      state.sessions = [...state.sessions, session].sort(
        (a, b) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc),
      );

      await this.saveState(state);
      await this.recordEvent(session.sessionId, "session.created", session);

      return json(session, { status: 201 });
    }

    // GET /sessions/:sessionId - get a specific session
    if (request.method === "GET" && url.pathname.startsWith("/sessions/")) {
      const sessionId = url.pathname.split("/")[2];
      const session = state.sessions.find((s) => s.sessionId === sessionId);
      if (!session) {
        return notFound("Session");
      }
      return json(session);
    }

    // PATCH /sessions/:sessionId - update a session
    if (request.method === "PATCH" && url.pathname.startsWith("/sessions/")) {
      const sessionId = url.pathname.split("/")[2];
      const payload = (await request.json().catch(() => null)) as Partial<CountdownSession> | null;

      if (!sessionId) {
        return badRequest("sessionId missing in path");
      }

      const target = state.sessions.find((s) => s.sessionId === sessionId);
      if (!target) {
        return notFound("Session");
      }

      if (payload?.label) target.label = payload.label;
      if (payload?.startTimeUtc) target.startTimeUtc = payload.startTimeUtc;
      if (payload?.durationMs) target.durationMs = payload.durationMs;
      if (payload?.metadata) {
        target.metadata = {
          ...(target.metadata ?? {}),
          ...payload.metadata,
        };
      }

      state.sessions = [...state.sessions].sort((a, b) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc));

      await this.saveState(state);
      await this.recordEvent(sessionId, "session.updated", payload ?? {});

      return json(target);
    }

    // DELETE /sessions/:sessionId - delete a session
    if (request.method === "DELETE" && url.pathname.startsWith("/sessions/")) {
      const sessionId = url.pathname.split("/")[2];
      const existing = state.sessions.find((s) => s.sessionId === sessionId);
      if (!existing) {
        return notFound("Session");
      }

      state.sessions = state.sessions.filter((s) => s.sessionId !== sessionId);

      await this.saveState(state);
      await this.recordEvent(sessionId, "session.deleted", existing);

      return json({ deleted: sessionId });
    }

    return notFound("Route");
  }

  private async loadState(): Promise<CountdownState> {
    if (this.stateCache) return this.stateCache;

    const stored = await this.storage.get<CountdownState>("state");
    if (stored) {
      this.stateCache = stored;
      return stored;
    }

    const fallback: CountdownState = {
      sessions: [],
      activeSessionId: null,
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.stateCache = fallback;
    return fallback;
  }

  private async saveState(state: CountdownState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    state.version += 1;
    await this.storage.put("state", state);
    this.stateCache = state;
    await this.persistSnapshot(state);
  }

  private async persistSnapshot(state: CountdownState): Promise<void> {
    try {
      await this.env.COUNTDOWN_DB.prepare(
        `INSERT INTO countdown_state (id, version, snapshot, created_at, updated_at)
        VALUES ('default', ?1, ?2, ?3, ?4)
        ON CONFLICT(id) DO UPDATE SET
          version=excluded.version,
          snapshot=excluded.snapshot,
          updated_at=excluded.updated_at`,
      )
        .bind(state.version, JSON.stringify(state), state.createdAt, state.updatedAt)
        .run();
    } catch (error) {
      console.warn("D1 snapshot sync failed", error);
    }
  }

  private async recordEvent(sessionId: string, action: string, payload: unknown): Promise<void> {
    try {
      await this.env.COUNTDOWN_DB.prepare(
        `INSERT INTO events (event_id, session_id, action, payload, occurred_at)
        VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
        .bind(crypto.randomUUID(), sessionId, action, JSON.stringify(payload ?? {}), new Date().toISOString())
        .run();
    } catch (error) {
      console.warn("Event persistence skipped", error);
    }
  }
}
