import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { BearerAuthMiddleware } from "../../app/Http/Middlewares/BearerAuthMiddleware";

describe("BearerAuthMiddleware", () => {
  it("allows requests when bearer auth is disabled", async () => {
    const app = new BearerAuthMiddleware({
      bearerToken: "",
      realm: "test",
      publicPaths: [],
    })
      .handle(new Elysia())
      .get("/private", () => ({ ok: true }));
    const response = await app.handle(new Request("http://localhost/private"));

    expect(response.status).toBe(200);
  });

  it("allows public paths without a bearer token", async () => {
    const app = new BearerAuthMiddleware({
      bearerToken: "secret",
      realm: "test",
      publicPaths: ["/health"],
    })
      .handle(new Elysia())
      .get("/health", () => ({ ok: true }));
    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
  });

  it("rejects protected paths without a valid bearer token", async () => {
    const app = new BearerAuthMiddleware({
      bearerToken: "secret",
      realm: "test",
      publicPaths: [],
    })
      .handle(new Elysia())
      .get("/private", () => ({ ok: true }));
    const response = await app.handle(new Request("http://localhost/private"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Bearer realm="test", error="invalid_token"'
    );
    expect(body).toEqual({
      message: "Unauthorized",
    });
  });

  it("allows protected paths with a valid bearer token", async () => {
    const app = new BearerAuthMiddleware({
      bearerToken: "secret",
      realm: "test",
      publicPaths: [],
    })
      .handle(new Elysia())
      .get("/private", () => ({ ok: true }));
    const response = await app.handle(
      new Request("http://localhost/private", {
        headers: {
          authorization: "Bearer secret",
        },
      })
    );

    expect(response.status).toBe(200);
  });
});
