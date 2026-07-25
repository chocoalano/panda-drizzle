import type { Elysia } from "elysia";

import { securityConfig, type SecurityConfig } from "../../../config/security";

export class SecurityHeadersMiddleware {
  constructor(private readonly config: SecurityConfig = securityConfig) {}

  handle(app: Elysia) {
    if (!this.config.enabled) {
      return app;
    }

    return app.onRequest(({ set }) => {
      for (const [name, value] of Object.entries(this.config.headers)) {
        set.headers[name] = value;
      }
    });
  }
}
