import type { Elysia } from "elysia";

import { requestConfig, type RequestConfig } from "../../../config/request";

export function parseContentLength(value: string | null) {
  if (!value) {
    return undefined;
  }

  if (!/^\d+$/.test(value.trim())) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function hasRequestBodySemantics(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function hasRequestBody(request: Request) {
  return (
    request.body !== null ||
    request.headers.has("content-type") ||
    request.headers.has("transfer-encoding")
  );
}

export function isChunkedTransferEncoding(value: string | null) {
  return value
    ?.split(",")
    .map((part) => part.trim().toLowerCase())
    .includes("chunked") ?? false;
}

export class BodySizeLimitMiddleware {
  constructor(private readonly config: RequestConfig = requestConfig) {}

  handle(app: Elysia) {
    return app.onBeforeHandle(({ request, set }) => {
      const rawContentLength = request.headers.get("content-length");
      const contentLength = parseContentLength(rawContentLength);

      if (this.config.rejectInvalidContentLength && rawContentLength && contentLength === undefined) {
        set.status = 400;

        return {
          message: "Invalid Content-Length header.",
        };
      }

      if (
        this.config.rejectChunkedBodies &&
        hasRequestBodySemantics(request.method) &&
        isChunkedTransferEncoding(request.headers.get("transfer-encoding"))
      ) {
        set.status = 413;

        return {
          message: "Chunked request bodies are not allowed.",
        };
      }

      // An undeclared length leaves the body unbounded, so reject it whenever a
      // body is actually present. Keyed on the body itself rather than on
      // content-type, which an unbounded body can simply omit.
      if (
        this.config.requireContentLength &&
        hasRequestBodySemantics(request.method) &&
        hasRequestBody(request) &&
        contentLength === undefined
      ) {
        set.status = 411;

        return {
          message: "Content-Length is required.",
        };
      }

      if (contentLength === undefined || contentLength <= this.config.maxBodyBytes) {
        return;
      }

      set.status = 413;

      return {
        message: "Request body is too large.",
      };
    }) as unknown as Elysia;
  }
}
