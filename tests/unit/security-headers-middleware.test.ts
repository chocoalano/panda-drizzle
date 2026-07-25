import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { SecurityHeadersMiddleware } from "../../app/Http/Middlewares/SecurityHeadersMiddleware";
import { securityConfig } from "../../config/security";

describe("SecurityHeadersMiddleware", () => {
  it("adds hardening headers to responses", async () => {
    const app = new SecurityHeadersMiddleware({
      enabled: true,
      headers: {
        ...securityConfig.headers,
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      },
    })
      .handle(new Elysia())
      .get("/headers", () => ({ ok: true }));

    const response = await app.handle(new Request("http://localhost/headers"));

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("can be disabled", () => {
    const app = new Elysia();

    expect(
      new SecurityHeadersMiddleware({
        enabled: false,
        headers: { ...securityConfig.headers },
      }).handle(app)
    ).toBe(app);
  });
});
