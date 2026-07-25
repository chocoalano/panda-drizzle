import type { Elysia } from "elysia";

import { BearerAuthMiddleware } from "../app/Http/Middlewares/BearerAuthMiddleware";
import { BodySizeLimitMiddleware } from "../app/Http/Middlewares/BodySizeLimitMiddleware";
import { CorsMiddleware } from "../app/Http/Middlewares/CorsMiddleware";
import { CsrfMiddleware } from "../app/Http/Middlewares/CsrfMiddleware";
import { PolicyMiddleware } from "../app/Http/Middlewares/PolicyMiddleware";
import { RateLimitMiddleware } from "../app/Http/Middlewares/RateLimitMiddleware";
import { RequestContextMiddleware } from "../app/Http/Middlewares/RequestContextMiddleware";
import { SecurityHeadersMiddleware } from "../app/Http/Middlewares/SecurityHeadersMiddleware";

export type Middleware = {
  handle(app: Elysia): Elysia;
};

export type MiddlewareConstructor = new () => Middleware;

export const middlewareConfig = {
  global: [
    CorsMiddleware,
    SecurityHeadersMiddleware,
    RequestContextMiddleware,
    RateLimitMiddleware,
    BodySizeLimitMiddleware,
    BearerAuthMiddleware,
    CsrfMiddleware,
    PolicyMiddleware,
  ],
} satisfies {
  global: MiddlewareConstructor[];
};

export type MiddlewareConfig = typeof middlewareConfig;
