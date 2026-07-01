import { createRemoteJWKSet, jwtVerify } from "jose";
import type { CountdownEnv } from "./types";
import { json } from "./utils";

export type AccessIdentity = {
  email: string;
  subject: string;
};

const jwksByTeamDomain = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

const getJwks = (teamDomain: string) => {
  const existing = jwksByTeamDomain.get(teamDomain);
  if (existing) return existing;

  const jwks = createRemoteJWKSet(
    new URL(`${teamDomain}/cdn-cgi/access/certs`),
  );
  jwksByTeamDomain.set(teamDomain, jwks);
  return jwks;
};

const isLocalRequest = (request: Request) => {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
};

export const requireAccessIdentity = async (
  request: Request,
  env: CountdownEnv,
): Promise<AccessIdentity | Response> => {
  if (env.AUTH_DISABLED === "true" && isLocalRequest(request)) {
    return {
      email: "local-dev@localhost",
      subject: "local-development",
    };
  }

  const teamDomain = env.TEAM_DOMAIN?.replace(/\/+$/, "");
  if (!teamDomain || !env.POLICY_AUD) {
    console.error("Cloudflare Access configuration is missing");
    return json(
      { error: "Authentication is not configured" },
      { status: 500 },
    );
  }

  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) {
    return json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience: env.POLICY_AUD,
    });

    if (typeof payload.email !== "string" || typeof payload.sub !== "string") {
      return json({ error: "Invalid authentication identity" }, { status: 403 });
    }

    return {
      email: payload.email,
      subject: payload.sub,
    };
  } catch (error) {
    console.warn("Cloudflare Access JWT validation failed", error);
    return json({ error: "Invalid or expired authentication" }, { status: 403 });
  }
};
