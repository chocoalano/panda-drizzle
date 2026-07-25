import type { Elysia } from "elysia";

import { appConfig } from "../../../config/app";

export function resolveRequestId(
  incomingRequestId: string | null,
  makeRequestId: () => string
) {
  const requestId = incomingRequestId?.trim();

  return requestId && isValidRequestId(requestId) ? requestId : makeRequestId();
}

export function isValidRequestId(value: string) {
  return value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value);
}

export class RequestContextMiddleware {
  constructor(private readonly makeRequestId = () => crypto.randomUUID()) {}

  handle(app: Elysia) {
    return app.onRequest(({ request, set }) => {
      set.headers[appConfig.headers.appName] = appConfig.name;
      set.headers[appConfig.headers.requestId] = resolveRequestId(
        request.headers.get(appConfig.headers.requestId),
        this.makeRequestId
      );
    });
  }
}
