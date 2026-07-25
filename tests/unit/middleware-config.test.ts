import { describe, expect, it } from "bun:test";

import { BearerAuthMiddleware } from "../../app/Http/Middlewares/BearerAuthMiddleware";
import { BodySizeLimitMiddleware } from "../../app/Http/Middlewares/BodySizeLimitMiddleware";
import { CorsMiddleware } from "../../app/Http/Middlewares/CorsMiddleware";
import { CsrfMiddleware } from "../../app/Http/Middlewares/CsrfMiddleware";
import { PolicyMiddleware } from "../../app/Http/Middlewares/PolicyMiddleware";
import { RateLimitMiddleware } from "../../app/Http/Middlewares/RateLimitMiddleware";
import { RequestContextMiddleware } from "../../app/Http/Middlewares/RequestContextMiddleware";
import { SecurityHeadersMiddleware } from "../../app/Http/Middlewares/SecurityHeadersMiddleware";
import { middlewareConfig } from "../../config/middleware";

describe("middlewareConfig", () => {
  it("keeps the global middleware stack in config order", () => {
    expect(middlewareConfig.global).toEqual([
      CorsMiddleware,
      SecurityHeadersMiddleware,
      RequestContextMiddleware,
      RateLimitMiddleware,
      BodySizeLimitMiddleware,
      BearerAuthMiddleware,
      CsrfMiddleware,
      PolicyMiddleware,
    ]);
  });
});
