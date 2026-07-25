import { appConfig } from "./app";
import { env, envBoolean } from "./env";

const defaultCorsOrigins = ["http://localhost:3000"];

export const corsConfig = buildCorsConfig({
  credentials: envBoolean("CORS_CREDENTIALS", false),
  origin: env("CORS_ORIGIN", defaultCorsOrigins.join(",")),
});

export type CorsConfig = ReturnType<typeof buildCorsConfig>;

export function buildCorsConfig(input: {
  credentials?: boolean;
  origin?: string;
} = {}) {
  const origin = parseCorsOrigins(input.origin ?? defaultCorsOrigins.join(","));
  const credentials = input.credentials ?? false;

  assertCorsConfiguration(origin, credentials);

  return {
    origin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", appConfig.headers.requestId],
    exposeHeaders: [appConfig.headers.appName, appConfig.headers.requestId],
    credentials,
    maxAge: 600,
    preflight: true,
  };
}

export function parseCorsOrigins(
  value: string,
  fallback: string[] = defaultCorsOrigins
) {
  const normalized = value.trim();

  if (!normalized) {
    return [...fallback];
  }

  if (normalized === "*") {
    return true;
  }

  return normalized
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function assertCorsConfiguration(
  origin: true | string[],
  credentials: boolean
) {
  if (origin === true && credentials) {
    throw new Error("CORS_CREDENTIALS=true cannot be combined with CORS_ORIGIN=*.");
  }
}
