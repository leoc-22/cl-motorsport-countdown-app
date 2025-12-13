import type { CountdownEnv, CountdownSession } from "./types";
import { health, notFound, preflight, json, badRequest } from "./utils";
import { drizzle } from "drizzle-orm/d1";
import { sessions, events } from "./schema";
import { eq } from "drizzle-orm";

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

    // Initialize Drizzle ORM
    const db = drizzle(env.COUNTDOWN_DB);

    // GET /api/sessions - list all sessions
    if (request.method === "GET" && url.pathname === "/api/sessions") {
      try {
        const allSessions = await db
          .select({
            sessionId: sessions.sessionId,
            label: sessions.label,
            startTimeUtc: sessions.startTimeUtc,
            durationMs: sessions.durationMs,
            metadata: sessions.metadata,
          })
          .from(sessions)
          .orderBy(sessions.startTimeUtc);

        // Map to CountdownSession type with parsed metadata
        const mappedSessions: CountdownSession[] = allSessions.map((row) => ({
          sessionId: row.sessionId,
          label: row.label,
          startTimeUtc: row.startTimeUtc,
          durationMs: row.durationMs,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));

        return json(mappedSessions);
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

        // Insert session using Drizzle
        await db.insert(sessions).values({
          sessionId,
          label: payload.label,
          startTimeUtc: payload.startTimeUtc,
          durationMs: payload.durationMs,
          metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
          createdAt: now,
          updatedAt: now,
        });

        // Record event for audit log
        await db.insert(events).values({
          eventId: crypto.randomUUID(),
          sessionId,
          action: "session.created",
          payload: JSON.stringify(payload),
          occurredAt: now,
        });

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
        const result = await db
          .select({
            sessionId: sessions.sessionId,
            label: sessions.label,
            startTimeUtc: sessions.startTimeUtc,
            durationMs: sessions.durationMs,
            metadata: sessions.metadata,
          })
          .from(sessions)
          .where(eq(sessions.sessionId, sessionId))
          .get();

        if (!result) {
          return notFound("Session");
        }

        const session: CountdownSession = {
          sessionId: result.sessionId,
          label: result.label,
          startTimeUtc: result.startTimeUtc,
          durationMs: result.durationMs,
          metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
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
        const existing = await db
          .select()
          .from(sessions)
          .where(eq(sessions.sessionId, sessionId))
          .get();

        if (!existing) {
          return notFound("Session");
        }

        // Build update object
        const updateData: Partial<typeof sessions.$inferInsert> = {
          updatedAt: new Date().toISOString(),
        };

        if (payload?.label) {
          updateData.label = payload.label;
        }
        if (payload?.startTimeUtc) {
          updateData.startTimeUtc = payload.startTimeUtc;
        }
        if (payload?.durationMs !== undefined) {
          updateData.durationMs = payload.durationMs;
        }
        if (payload?.metadata) {
          const currentMetadata = existing.metadata ? JSON.parse(existing.metadata) : {};
          const mergedMetadata = { ...currentMetadata, ...payload.metadata };
          updateData.metadata = JSON.stringify(mergedMetadata);
        }

        if (Object.keys(updateData).length === 1) {
          // Only updatedAt, no actual fields to update
          return badRequest("No valid fields to update");
        }

        // Update session using Drizzle
        await db
          .update(sessions)
          .set(updateData)
          .where(eq(sessions.sessionId, sessionId));

        // Record event for audit log
        await db.insert(events).values({
          eventId: crypto.randomUUID(),
          sessionId,
          action: "session.updated",
          payload: JSON.stringify(payload ?? {}),
          occurredAt: new Date().toISOString(),
        });

        // Fetch updated session
        const updated = await db
          .select()
          .from(sessions)
          .where(eq(sessions.sessionId, sessionId))
          .get();

        const session: CountdownSession = {
          sessionId: updated!.sessionId,
          label: updated!.label,
          startTimeUtc: updated!.startTimeUtc,
          durationMs: updated!.durationMs,
          metadata: updated!.metadata ? JSON.parse(updated!.metadata) : undefined,
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
        // Check if session exists and get it for audit log
        const existing = await db
          .select()
          .from(sessions)
          .where(eq(sessions.sessionId, sessionId))
          .get();

        if (!existing) {
          return notFound("Session");
        }

        // Delete the session using Drizzle
        await db
          .delete(sessions)
          .where(eq(sessions.sessionId, sessionId));

        // Record event for audit log
        await db.insert(events).values({
          eventId: crypto.randomUUID(),
          sessionId,
          action: "session.deleted",
          payload: JSON.stringify(existing),
          occurredAt: new Date().toISOString(),
        });

        return json({ deleted: sessionId });
      } catch (error) {
        console.error("Failed to delete session:", error);
        return json({ error: "Failed to delete session" }, { status: 500 });
      }
    }

    return notFound("Route");
  },
} satisfies ExportedHandler<CountdownEnv>;
