export const HTTP_STATUS = {
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  payloadTooLarge: 413,
  serviceUnavailable: 503,
  created: 201,
} as const;

export const jsonError = (message: string, status: number) =>
  Response.json({ error: message }, { status });

export const notFound = () => jsonError("Not found", HTTP_STATUS.notFound);

export const unauthorized = () =>
  jsonError("Unauthorized", HTTP_STATUS.unauthorized);

export const forbidden = () => jsonError("Forbidden", HTTP_STATUS.forbidden);
