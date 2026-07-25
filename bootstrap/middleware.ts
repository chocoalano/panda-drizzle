import type { Elysia } from "elysia";

import {
  middlewareConfig,
  type Middleware,
} from "../config/middleware";

export type { Middleware } from "../config/middleware";

export const middleware = middlewareConfig.global.map(
  (MiddlewareClass) => new MiddlewareClass()
) satisfies Middleware[];

export function registerMiddleware(
  app: Elysia,
  middlewareStack: Middleware[] = middleware
) {
  return middlewareStack.reduce(
    (registeredApp, currentMiddleware) =>
      currentMiddleware.handle(registeredApp),
    app
  );
}
