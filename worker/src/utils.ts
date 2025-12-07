const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });

export const preflight = () =>
  new Response(null, {
    status: 204,
    headers: corsHeaders,
  });

export const badRequest = (message: string, details?: Record<string, unknown>) =>
  json(
    {
      error: message,
      ...(details ?? {}),
    },
    { status: 400 },
  );

export const notFound = (resource = "Resource") =>
  json(
    {
      error: `${resource} not found`,
    },
    { status: 404 },
  );

export const health = () =>
  json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
