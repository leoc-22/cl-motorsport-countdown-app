import { DurableObject } from "cloudflare:workers";

type SessionStatus = "scheduled" | "running" | "complete" | "canceled";

type CountdownSession = {
	sessionId: string;
	label: string;
	startTimeUtc: string;
	durationMs: number;
	status: SessionStatus;
	metadata?: Record<string, unknown>;
};

type CountdownGroupState = {
	groupId: string;
	label: string;
	timezone: string;
	sessions: CountdownSession[];
	activeSessionId: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
};

type CountdownEnv = {
	COUNTDOWN_GROUP: DurableObjectNamespace<CountdownGroupDurableObject>;
	COUNTDOWN_D1: D1Database;
};

const json = (data: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(data), {
		...init,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...(init.headers ?? {}),
		},
	});

const badRequest = (message: string, details?: Record<string, unknown>) =>
	json(
		{
			error: message,
			...(details ?? {}),
		},
		{ status: 400 },
	);

const notFound = (resource = "Resource") =>
	json(
		{
			error: `${resource} not found`,
		},
		{ status: 404 },
	);

const health = () =>
	json({
		status: "ok",
		timestamp: new Date().toISOString(),
	});

const toGroupStub = (env: CountdownEnv, groupId: string) => {
	const id = env.COUNTDOWN_GROUP.idFromName(groupId);
	return env.COUNTDOWN_GROUP.get(id);
};

const forwardToGroup = async (request: Request, env: CountdownEnv, groupId: string, pathSuffix: string) => {
	const stub = toGroupStub(env, groupId);
	const url = new URL(request.url);
	url.pathname = pathSuffix || "/";
	const forwarded = new Request(url.toString(), request);
	return stub.fetch(forwarded);
};

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/healthz") {
			return health();
		}

		if (url.pathname === "/api/groups" && request.method === "POST") {
			const payload = (await request.json().catch(() => null)) as
				| { groupId?: string; label?: string; timezone?: string }
				| null;

			if (!payload?.label) {
				return badRequest("label is required");
			}

			const groupId = payload.groupId?.trim() || crypto.randomUUID();
			const stub = toGroupStub(env, groupId);
			const bootstrapUrl = new URL("/bootstrap", request.url);
			const bootstrapRequest = new Request(bootstrapUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					groupId,
					label: payload.label,
					timezone: payload.timezone ?? "UTC",
				}),
			});

			const bootstrapResponse = await stub.fetch(bootstrapRequest);
			return bootstrapResponse;
		}

		const groupMatch = url.pathname.match(/^\/api\/groups\/([^/]+)(\/.*)?$/);
		if (groupMatch) {
			const [, rawId, remainder = "/"] = groupMatch;
			const groupId = decodeURIComponent(rawId);
			return forwardToGroup(request, env, groupId, remainder);
		}

		return notFound("Route");
	},
} satisfies ExportedHandler<CountdownEnv>;

export class CountdownGroupDurableObject extends DurableObject<CountdownEnv> {
	#stateCache: CountdownGroupState | null = null;
	readonly #storage: DurableObjectState["storage"];

	constructor(ctx: DurableObjectState, env: CountdownEnv) {
		super(ctx, env);
		this.#storage = ctx.storage;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const state = await this.#loadState();

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

			await this.#saveState(state);
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

			await this.#saveState(state);
			await this.#recordEvent(state.groupId, session.sessionId, "session.created", session);

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

			await this.#saveState(state);
			await this.#recordEvent(state.groupId, sessionId, "session.updated", payload ?? {});

			return json({ session: target, state });
		}

		if (request.method === "DELETE" && url.pathname.startsWith("/sessions/")) {
			const [, , sessionId] = url.pathname.split("/");
			const existing = state.sessions.find((session) => session.sessionId === sessionId);
			if (!existing) {
				return notFound("Session");
			}

			state.sessions = state.sessions.filter((session) => session.sessionId !== sessionId);

			await this.#saveState(state);
			await this.#recordEvent(state.groupId, sessionId, "session.deleted", existing);

			return json({ deleted: sessionId });
		}

		return notFound("Route");
	}

	async #loadState(): Promise<CountdownGroupState> {
		if (this.#stateCache) return this.#stateCache;

		const stored = await this.#storage.get<CountdownGroupState>("group");
		if (stored) {
			this.#stateCache = stored;
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

		this.#stateCache = fallback;
		return fallback;
	}

	async #saveState(state: CountdownGroupState): Promise<void> {
		state.updatedAt = new Date().toISOString();
		state.version += 1;
		await this.#storage.put("group", state);
		this.#stateCache = state;
		await this.#persistSnapshot(state);
	}

	async #persistSnapshot(state: CountdownGroupState): Promise<void> {
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

	async #recordEvent(groupId: string, sessionId: string, action: string, payload: unknown): Promise<void> {
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
