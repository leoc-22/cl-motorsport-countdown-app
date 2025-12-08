import type { CountdownEnv, CountdownSession } from "./types";
import { health, notFound, preflight, json, badRequest } from "./utils";

export default {
  async fetch(request, env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return preflight();
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return health();
    }

    // GET /api/sessions - list all sessions
    if (request.method === "GET" && url.pathname === "/api/sessions") {
      try {
        const result = await env.COUNTDOWN_DB.prepare(
          `SELECT session_id, label, start_time_utc, duration_ms, metadata
           FROM sessions
           ORDER BY start_time_utc ASC`
        ).all();

        const sessions: CountdownSession[] = (result.results || []).map((row: any) => ({
          sessionId: row.session_id,
          label: row.label,
          startTimeUtc: row.start_time_utc,
          durationMs: row.duration_ms,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));

        return json(sessions);
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
        return json({ error: "Failed to fetch sessions" }, { status: 500 });
      }
    }

    // POST /api/sessions - create a new session
    if (request.method === "POST" && url.pathname === "/api/sessions") {
      try {
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

        const sessionId = crypto.randomUUID();
        const now = new Date().toISOString();

        await env.COUNTDOWN_DB.prepare(
          `INSERT INTO sessions (session_id, label, start_time_utc, duration_ms, metadata, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
          .bind(
            sessionId,
            payload.label,
            payload.startTimeUtc,
            payload.durationMs,
            payload.metadata ? JSON.stringify(payload.metadata) : null,
            now,
            now
          )
          .run();

        // Record event for audit log
        await env.COUNTDOWN_DB.prepare(
          `INSERT INTO events (event_id, session_id, action, payload, occurred_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`
        )
          .bind(
            crypto.randomUUID(),
            sessionId,
            "session.created",
            JSON.stringify(payload),
            now
          )
          .run();

        const session: CountdownSession = {
          sessionId,
          label: payload.label,
          startTimeUtc: payload.startTimeUtc,
          durationMs: payload.durationMs,
          metadata: payload.metadata,
        };

        return json(session, { status: 201 });
      } catch (error) {
        console.error("Failed to create session:", error);
        return json({ error: "Failed to create session" }, { status: 500 });
      }
    }

    // GET /api/sessions/:sessionId - get a specific session
    if (request.method === "GET" && url.pathname.startsWith("/api/sessions/")) {
      const sessionId = url.pathname.split("/")[3];

      if (!sessionId) {
        return badRequest("sessionId is required");
      }

      try {
        const result = await env.COUNTDOWN_DB.prepare(
          `SELECT session_id, label, start_time_utc, duration_ms, metadata
           FROM sessions
           WHERE session_id = ?1`
        )
          .bind(sessionId)
          .first();

        if (!result) {
          return notFound("Session");
        }

        const session: CountdownSession = {
          sessionId: result.session_id as string,
          label: result.label as string,
          startTimeUtc: result.start_time_utc as string,
          durationMs: result.duration_ms as number,
          metadata: result.metadata ? JSON.parse(result.metadata as string) : undefined,
        };

        return json(session);
      } catch (error) {
        console.error("Failed to fetch session:", error);
        return json({ error: "Failed to fetch session" }, { status: 500 });
      }
    }

    // PATCH /api/sessions/:sessionId - update a session
    if (request.method === "PATCH" && url.pathname.startsWith("/api/sessions/")) {
      const sessionId = url.pathname.split("/")[3];

      if (!sessionId) {
        return badRequest("sessionId is required");
      }

      try {
        const payload = (await request.json().catch(() => null)) as Partial<CountdownSession> | null;

        // Check if session exists
        const existing = await env.COUNTDOWN_DB.prepare(
          `SELECT session_id, label, start_time_utc, duration_ms, metadata
           FROM sessions
           WHERE session_id = ?1`
        )
          .bind(sessionId)
          .first();

        if (!existing) {
          return notFound("Session");
        }

        // Build update query dynamically based on provided fields
        const updates: string[] = [];
        const bindings: any[] = [];
        let bindIndex = 1;

        if (payload?.label) {
          updates.push(`label = ?${bindIndex++}`);
          bindings.push(payload.label);
        }
        if (payload?.startTimeUtc) {
          updates.push(`start_time_utc = ?${bindIndex++}`);
          bindings.push(payload.startTimeUtc);
        }
        if (payload?.durationMs !== undefined) {
          updates.push(`duration_ms = ?${bindIndex++}`);
          bindings.push(payload.durationMs);
        }
        if (payload?.metadata) {
          const currentMetadata = existing.metadata ? JSON.parse(existing.metadata as string) : {};
          const mergedMetadata = { ...currentMetadata, ...payload.metadata };
          updates.push(`metadata = ?${bindIndex++}`);
          bindings.push(JSON.stringify(mergedMetadata));
        }

        if (updates.length === 0) {
          return badRequest("No valid fields to update");
        }

        const now = new Date().toISOString();
        updates.push(`updated_at = ?${bindIndex++}`);
        bindings.push(now);
        bindings.push(sessionId);

        await env.COUNTDOWN_DB.prepare(
          `UPDATE sessions SET ${updates.join(", ")} WHERE session_id = ?${bindIndex}`
        )
          .bind(...bindings)
          .run();

        // Record event for audit log
        await env.COUNTDOWN_DB.prepare(
          `INSERT INTO events (event_id, session_id, action, payload, occurred_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`
        )
          .bind(
            crypto.randomUUID(),
            sessionId,
            "session.updated",
            JSON.stringify(payload ?? {}),
            now
          )
          .run();

        // Fetch updated session
        const updated = await env.COUNTDOWN_DB.prepare(
          `SELECT session_id, label, start_time_utc, duration_ms, metadata
           FROM sessions
           WHERE session_id = ?1`
        )
          .bind(sessionId)
          .first();

        const session: CountdownSession = {
          sessionId: updated!.session_id as string,
          label: updated!.label as string,
          startTimeUtc: updated!.start_time_utc as string,
          durationMs: updated!.duration_ms as number,
          metadata: updated!.metadata ? JSON.parse(updated!.metadata as string) : undefined,
        };

        return json(session);
      } catch (error) {
        console.error("Failed to update session:", error);
        return json({ error: "Failed to update session" }, { status: 500 });
      }
    }

    // DELETE /api/sessions/:sessionId - delete a session
    if (request.method === "DELETE" && url.pathname.startsWith("/api/sessions/")) {
      const sessionId = url.pathname.split("/")[3];

      if (!sessionId) {
        return badRequest("sessionId is required");
      }

      try {
        // Check if session exists
        const existing = await env.COUNTDOWN_DB.prepare(
          `SELECT session_id, label, start_time_utc, duration_ms, metadata
           FROM sessions
           WHERE session_id = ?1`
        )
          .bind(sessionId)
          .first();

        if (!existing) {
          return notFound("Session");
        }

        // Delete the session
        await env.COUNTDOWN_DB.prepare(
          `DELETE FROM sessions WHERE session_id = ?1`
        )
          .bind(sessionId)
          .run();

        // Record event for audit log
        const now = new Date().toISOString();
        await env.COUNTDOWN_DB.prepare(
          `INSERT INTO events (event_id, session_id, action, payload, occurred_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`
        )
          .bind(
            crypto.randomUUID(),
            sessionId,
            "session.deleted",
            JSON.stringify(existing),
            now
          )
          .run();

        return json({ deleted: sessionId });
      } catch (error) {
        console.error("Failed to delete session:", error);
        return json({ error: "Failed to delete session" }, { status: 500 });
      }
    }

    return notFound("Route");
  },
} satisfies ExportedHandler<CountdownEnv>;
