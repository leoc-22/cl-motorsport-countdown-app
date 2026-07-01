import type { CountdownEnv } from "./types";
import { health, json, notFound } from "./utils";
import { handleSessionsRequest } from "./sessions";
import { requireAccessIdentity } from "./auth";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return health();
    }

    // Countdown data stays public, but public API routes are read-only.
    if (
      request.method === "GET" &&
      (url.pathname === "/api/sessions" ||
        url.pathname.startsWith("/api/sessions/"))
    ) {
      return handleSessionsRequest(request, env);
    }

    // One Access application protects both /configure and its mutation API.
    if (
      url.pathname === "/configure/api/me" ||
      url.pathname === "/configure/api/sessions" ||
      url.pathname.startsWith("/configure/api/sessions/")
    ) {
      const identity = await requireAccessIdentity(request, env);
      if (identity instanceof Response) return identity;

      if (url.pathname === "/configure/api/me") {
        return json(identity);
      }

      const sessionUrl = new URL(request.url);
      sessionUrl.pathname = url.pathname.replace(
        /^\/configure\/api/,
        "/api",
      );
      return handleSessionsRequest(new Request(sessionUrl, request), env);
    }

    if (url.pathname.startsWith("/api/")) {
      return notFound("API route");
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<CountdownEnv>;
