import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import type { Middleware } from "../../bootstrap/middleware";
import { middleware, registerMiddleware } from "../../bootstrap/middleware";
import { middlewareConfig } from "../../config/middleware";

describe("registerMiddleware", () => {
  it("builds the default stack from configured middleware", () => {
    expect(middleware).toHaveLength(middlewareConfig.global.length);
    expect(middleware.map((item) => item.constructor)).toEqual(
      middlewareConfig.global
    );
  });

  it("registers middleware in order", async () => {
    const calls: string[] = [];
    const stack: Middleware[] = [
      {
        handle(app) {
          calls.push("first");

          return app;
        },
      },
      {
        handle(app) {
          calls.push("second");

          return app;
        },
      },
    ];

    registerMiddleware(new Elysia(), stack);

    expect(calls).toEqual(["first", "second"]);
  });
});
