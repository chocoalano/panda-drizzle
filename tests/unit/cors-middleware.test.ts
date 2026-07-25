import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { CorsMiddleware } from "../../app/Http/Middlewares/CorsMiddleware";

describe("CorsMiddleware", () => {
  it("adds CORS headers to responses", async () => {
    const app = new CorsMiddleware({
      origin: true,
      methods: ["GET", "OPTIONS"],
      allowedHeaders: ["Authorization"],
      exposeHeaders: ["x-request-id"],
      credentials: false,
      maxAge: 60,
      preflight: true,
    })
      .handle(new Elysia())
      .get("/cors-check", () => ({ ok: true }));
    const response = await app.handle(
      new Request("http://localhost/cors-check", {
        headers: {
          origin: "https://example.test",
        },
      })
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://example.test"
    );
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "x-request-id"
    );
  });
});
