import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import {
  RateLimitMiddleware,
  consumeRateLimit,
  defaultRateLimitKey,
  pruneExpiredRateLimitEntries,
  resolveRateLimitClient,
} from "../../app/Http/Middlewares/RateLimitMiddleware";

describe("consumeRateLimit", () => {
  it("tracks attempts inside a window", () => {
    const store = new Map();
    const config = {
      maxAttempts: 1,
      maxKeys: 100,
      windowMs: 1000,
    };

    expect(consumeRateLimit(store, "key", 1000, config)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(consumeRateLimit(store, "key", 1001, config)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    expect(consumeRateLimit(store, "key", 2000, config)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it("prunes expired entries and caps store growth", () => {
    const store = new Map([
      ["expired", { count: 1, resetAt: 999 }],
      ["active", { count: 1, resetAt: 2000 }],
    ]);

    pruneExpiredRateLimitEntries(store, 1000);
    expect([...store.keys()]).toEqual(["active"]);

    consumeRateLimit(store, "next", 1000, {
      maxAttempts: 1,
      maxKeys: 1,
      windowMs: 1000,
    });

    expect([...store.keys()]).toEqual(["next"]);
  });
});

describe("defaultRateLimitKey", () => {
  it("keys by method and path without trusting proxy headers", () => {
    expect(defaultRateLimitKey(new Request("http://localhost/users?id=1"))).toBe(
      "GET:/users:global"
    );
    expect(
      defaultRateLimitKey(
        new Request("http://localhost/users", {
          headers: {
            "x-forwarded-for": "203.0.113.10, 10.0.0.1",
          },
        }),
        {
          trustProxy: true,
        }
      )
    ).toBe("GET:/users:203.0.113.10");
    expect(
      resolveRateLimitClient(
        new Request("http://localhost/users", {
          headers: {
            "x-forwarded-for": "203.0.113.10",
          },
        }),
        {
          trustProxy: false,
        }
      )
    ).toBe("global");
  });
});

describe("RateLimitMiddleware", () => {
  it("returns 429 after the configured attempt limit", async () => {
    const app = new RateLimitMiddleware(
      {
        enabled: true,
        maxAttempts: 1,
        maxKeys: 100,
        trustProxy: false,
        windowMs: 1000,
      },
      new Map(),
      () => "client",
      () => 1000
    )
      .handle(new Elysia())
      .get("/limited", () => ({ ok: true }));

    expect((await app.handle(new Request("http://localhost/limited"))).status).toBe(
      200
    );

    const response = await app.handle(new Request("http://localhost/limited"));

    expect(response.status).toBe(429);
    expect(response.headers.get("x-ratelimit-limit")).toBe("1");
  });
});
