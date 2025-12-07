import type { CountdownEnv } from "./types";
import { health, notFound, preflight } from "./utils";
import { CountdownDurableObject } from "./durable-objects/countdown";

// Single Durable Object instance for all sessions
const COUNTDOWN_ID = "countdown";

const getCountdownStub = (env: CountdownEnv) => {
  const id = env.COUNTDOWN_DO.idFromName(COUNTDOWN_ID);
  return env.COUNTDOWN_DO.get(id);
};

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

    // Forward all /api/sessions requests to the Durable Object
    if (url.pathname.startsWith("/api/sessions")) {
      const stub = getCountdownStub(env);
      // Strip /api prefix, keep /sessions...
      const doPath = url.pathname.replace(/^\/api/, "");
      const doUrl = new URL(doPath, request.url);
      const forwarded = new Request(doUrl.toString(), request);
      return stub.fetch(forwarded);
    }

    return notFound("Route");
  },
} satisfies ExportedHandler<CountdownEnv>;

// Re-export the Durable Object so Wrangler can find it
export { CountdownDurableObject };
