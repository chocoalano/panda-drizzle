import type { Elysia } from "elysia";

import { csrfConfig, type CsrfConfig } from "../../../config/csrf";

export function parseCookieHeader(value: string | null) {
  if (!value) {
    return new Map<string, string>();
  }

  const cookies = new Map<string, string>();

  for (const part of value.split(";").map((item) => item.trim()).filter(Boolean)) {
    const separator = part.indexOf("=");

    if (separator === -1) {
      cookies.set(safeDecodeURIComponent(part), "");

      continue;
    }

    cookies.set(
      safeDecodeURIComponent(part.slice(0, separator).trim()),
      safeDecodeURIComponent(part.slice(separator + 1).trim())
    );
  }

  return cookies;
}

export function hasBearerAuthorization(request: Request) {
  return request.headers.get("authorization")?.toLowerCase().startsWith("bearer ") ?? false;
}

export function csrfTokensMatch(
  request: Request,
  config: Pick<CsrfConfig, "cookieName" | "headerName">
) {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const cookieToken = cookies.get(config.cookieName);
  const headerToken = request.headers.get(config.headerName)?.trim();

  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}

export class CsrfMiddleware {
  constructor(private readonly config: CsrfConfig = csrfConfig) {}

  handle(app: Elysia) {
    if (!this.config.enabled) {
      return app;
    }

    return app.onBeforeHandle(({ request, set }) => {
      if (
        !this.config.methods.includes(request.method) ||
        !request.headers.has("cookie") ||
        hasBearerAuthorization(request)
      ) {
        return;
      }

      if (csrfTokensMatch(request, this.config)) {
        return;
      }

      set.status = 419;

      return {
        message: "CSRF token mismatch.",
      };
    }) as unknown as Elysia;
  }
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
