export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
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
