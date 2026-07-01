import type { CountdownEnv } from "./types";
import { health, notFound, preflight } from "./utils";
import { handleSessionsRequest } from "./sessions";

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

    if (url.pathname.startsWith("/api/sessions")) {
      return handleSessionsRequest(request, env);
    }

    return notFound("Route");
  },
} satisfies ExportedHandler<CountdownEnv>;
