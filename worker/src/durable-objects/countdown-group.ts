import { DurableObject } from "cloudflare:workers";
import type { CountdownEnv, CountdownGroupState, CountdownSession } from "../types";
import { json, badRequest, notFound } from "../utils";

export class CountdownGroupDurableObject extends DurableObject<CountdownEnv> {
  private stateCache: CountdownGroupState | null = null;
  private readonly storage: DurableObjectState["storage"];

  constructor(ctx: DurableObjectState, env: CountdownEnv) {
    super(ctx, env);
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const state = await this.loadState();

    if (request.method === "GET" && url.pathname === "/") {
      return json(state);
    }

    if (request.method === "GET" && url.pathname === "/sessions") {
      return json(state.sessions);
    }

    if (request.method === "POST" && url.pathname === "/bootstrap") {
      const payload = (await request.json().catch(() => null)) as Partial<CountdownGroupState> | null;
      if (!payload?.label) {
        return badRequest("label is required");
      }

      state.groupId = payload.groupId ?? state.groupId;
      state.label = payload.label;
      state.timezone = payload.timezone ?? state.timezone;

      await this.saveState(state);
      return json(state, { status: 201 });
    }

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
        status: "scheduled",
        metadata: payload.metadata,
      };

      state.sessions = [...state.sessions, session].sort(
        (a, b) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc),
      );

      await this.saveState(state);
      await this.recordEvent(state.groupId, session.sessionId, "session.created", session);

      return json({ session, state }, { status: 201 });
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/sessions/")) {
      const [, , sessionId] = url.pathname.split("/");
      const payload = (await request.json().catch(() => null)) as Partial<CountdownSession> | null;

      if (!sessionId) {
        return badRequest("sessionId missing in path");
      }

      const target = state.sessions.find((session) => session.sessionId === sessionId);
      if (!target) {
        return notFound("Session");
      }

      if (payload?.label) target.label = payload.label;
      if (payload?.startTimeUtc) target.startTimeUtc = payload.startTimeUtc;
      if (payload?.durationMs) target.durationMs = payload.durationMs;
      if (payload?.status) target.status = payload.status;
      if (payload?.metadata) {
        target.metadata = {
          ...(target.metadata ?? {}),
          ...payload.metadata,
        };
      }

      state.sessions = [...state.sessions].sort((a, b) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc));

      await this.saveState(state);
      await this.recordEvent(state.groupId, sessionId, "session.updated", payload ?? {});

      return json({ session: target, state });
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/sessions/")) {
      const [, , sessionId] = url.pathname.split("/");
      const existing = state.sessions.find((session) => session.sessionId === sessionId);
      if (!existing) {
        return notFound("Session");
      }

      state.sessions = state.sessions.filter((session) => session.sessionId !== sessionId);

      await this.saveState(state);
      await this.recordEvent(state.groupId, sessionId, "session.deleted", existing);

      return json({ deleted: sessionId });
    }

    return notFound("Route");
  }

  private async loadState(): Promise<CountdownGroupState> {
    if (this.stateCache) return this.stateCache;

    const stored = await this.storage.get<CountdownGroupState>("group");
    if (stored) {
      this.stateCache = stored;
      return stored;
    }

    const fallback: CountdownGroupState = {
      groupId: this.ctx.id.toString(),
      label: "Untitled Group",
      timezone: "UTC",
      sessions: [],
      activeSessionId: null,
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.stateCache = fallback;
    return fallback;
  }

  private async saveState(state: CountdownGroupState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    state.version += 1;
    await this.storage.put("group", state);
    this.stateCache = state;
    await this.persistSnapshot(state);
  }

  private async persistSnapshot(state: CountdownGroupState): Promise<void> {
    try {
      await this.env.COUNTDOWN_D1.prepare(
        `INSERT INTO groups (group_id, label, timezone, version, snapshot, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(group_id) DO UPDATE SET
          label=excluded.label,
          timezone=excluded.timezone,
          version=excluded.version,
          snapshot=excluded.snapshot,
          updated_at=excluded.updated_at`,
      )
        .bind(
          state.groupId,
          state.label,
          state.timezone,
          state.version,
          JSON.stringify({ ...state, sessions: state.sessions }),
          state.createdAt,
          state.updatedAt,
        )
        .run();
    } catch (error) {
      console.warn("D1 snapshot sync failed", error);
    }
  }

  private async recordEvent(groupId: string, sessionId: string, action: string, payload: unknown): Promise<void> {
    try {
      await this.env.COUNTDOWN_D1.prepare(
        `INSERT INTO events (event_id, group_id, session_id, action, payload, occurred_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
        .bind(
          crypto.randomUUID(),
          groupId,
          sessionId,
          action,
          JSON.stringify(payload ?? {}),
          new Date().toISOString(),
        )
        .run();
    } catch (error) {
      console.warn("Event persistence skipped", error);
    }
  }
}
