import type { CountdownEnv } from "./types";
import { health, badRequest, notFound } from "./utils";
import { CountdownGroupDurableObject } from "./durable-objects/countdown-group";

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

    if (url.pathname === "/health") {
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

// Re-export the Durable Object so Wrangler can find it
export { CountdownGroupDurableObject };
