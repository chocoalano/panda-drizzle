import { env, envBoolean } from "./env";
import { positiveInteger } from "./request";

export const rateLimitConfig = {
  enabled: envBoolean("RATE_LIMIT_ENABLED", true),
  maxAttempts: positiveInteger(env("RATE_LIMIT_MAX_ATTEMPTS"), 120),
  maxKeys: positiveInteger(env("RATE_LIMIT_MAX_KEYS"), 10_000),
  trustProxy: envBoolean("RATE_LIMIT_TRUST_PROXY", false),
  windowMs: positiveInteger(env("RATE_LIMIT_WINDOW_MS"), 60_000),
};

export type RateLimitConfig = typeof rateLimitConfig;
