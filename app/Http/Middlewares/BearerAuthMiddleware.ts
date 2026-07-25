import { bearer } from "@elysia/bearer";
import type { Elysia } from "elysia";

import {
  assertBearerAuthConfiguration,
  authConfig,
  isBearerAuthEnabled,
  isPublicPath,
  type AuthConfig,
} from "../../../config/auth";

export class BearerAuthMiddleware {
  constructor(private readonly config: AuthConfig = authConfig) {
    assertBearerAuthConfiguration(this.config.bearerToken);
  }

  handle(app: Elysia) {
    return app.use(bearer()).onBeforeHandle(({ bearer, request, set }) => {
      if (request.method === "OPTIONS") {
        return;
      }

      const pathname = new URL(request.url).pathname;

      if (
        !isBearerAuthEnabled(this.config.bearerToken) ||
        isPublicPath(pathname, this.config.publicPaths)
      ) {
        return;
      }

      if (bearer === this.config.bearerToken) {
        return;
      }

      set.status = 401;
      set.headers["WWW-Authenticate"] =
        `Bearer realm="${this.config.realm}", error="invalid_token"`;

      return {
        message: "Unauthorized",
      };
    }) as unknown as Elysia;
  }
}
