import type { Elysia } from "elysia";

import { rateLimitConfig, type RateLimitConfig } from "../../../config/rateLimit";

export type RateLimitKeyResolver = (
  request: Request,
  config: RateLimitConfig
) => string;

export type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export function defaultRateLimitKey(
  request: Request,
  config: Pick<RateLimitConfig, "trustProxy"> = rateLimitConfig
) {
  const url = new URL(request.url);

  return `${request.method}:${url.pathname}:${resolveRateLimitClient(request, config)}`;
}

export function consumeRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  now: number,
  config: Pick<RateLimitConfig, "maxAttempts" | "maxKeys" | "windowMs">
) {
  pruneExpiredRateLimitEntries(store, now);

  if (!store.has(key)) {
    enforceRateLimitStoreLimit(store, config.maxKeys);
  }

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const next = {
      count: 1,
      resetAt: now + config.windowMs,
    };

    store.set(key, next);

    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetAt: next.resetAt,
    };
  }

  existing.count += 1;

  return {
    allowed: existing.count <= config.maxAttempts,
    remaining: Math.max(config.maxAttempts - existing.count, 0),
    resetAt: existing.resetAt,
  };
}

export function resolveRateLimitClient(
  request: Request,
  config: Pick<RateLimitConfig, "trustProxy"> = rateLimitConfig
) {
  if (!config.trustProxy) {
    return "global";
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client =
    forwardedFor ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim();

  return client && isSafeRateLimitClient(client) ? client : "global";
}

export function pruneExpiredRateLimitEntries(
  store: Map<string, RateLimitEntry>,
  now: number
) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function enforceRateLimitStoreLimit(
  store: Map<string, RateLimitEntry>,
  maxKeys: number
) {
  while (store.size >= maxKeys) {
    const oldestKey = store.keys().next().value;

    if (!oldestKey) {
      return;
    }

    store.delete(oldestKey);
  }
}

export class RateLimitMiddleware {
  constructor(
    private readonly config: RateLimitConfig = rateLimitConfig,
    private readonly store = new Map<string, RateLimitEntry>(),
    private readonly keyResolver: RateLimitKeyResolver = defaultRateLimitKey,
    private readonly now: () => number = () => Date.now()
  ) {}

  handle(app: Elysia) {
    if (!this.config.enabled) {
      return app;
    }

    return app.onBeforeHandle(({ request, set }) => {
      if (request.method === "OPTIONS") {
        return;
      }

      const result = consumeRateLimit(
        this.store,
        this.keyResolver(request, this.config),
        this.now(),
        this.config
      );

      set.headers["x-ratelimit-limit"] = String(this.config.maxAttempts);
      set.headers["x-ratelimit-remaining"] = String(result.remaining);
      set.headers["x-ratelimit-reset"] = String(Math.ceil(result.resetAt / 1000));

      if (result.allowed) {
        return;
      }

      set.status = 429;

      return {
        message: "Too many requests.",
      };
    }) as unknown as Elysia;
  }
}

function isSafeRateLimitClient(value: string) {
  return value.length <= 128 && !/[\r\n]/.test(value);
}
