import { appConfig, envBooleanValue, isProductionEnvironment } from "./app";
import { env, envBoolean } from "./env";
import { positiveInteger } from "./request";

export type BroadcastConnectionName = "log" | "realtime";

export const broadcastingConfig = {
  defaultConnection: normalizeBroadcastConnection(
    env("BROADCAST_CONNECTION", "realtime")
  ),
  auth: {
    queryParameter: normalizeBroadcastAuthQuery(env("BROADCAST_AUTH_QUERY", "token")),
    required: resolveBroadcastAuthRequired(
      env("BROADCAST_AUTH_REQUIRED") || undefined,
      env("BROADCAST_AUTH_TOKEN") || env("API_BEARER_TOKEN"),
      appConfig.env
    ),
    token: env("BROADCAST_AUTH_TOKEN") || env("API_BEARER_TOKEN"),
  },
  channels: {
    maxLength: positiveInteger(env("BROADCAST_CHANNEL_MAX_LENGTH"), 128),
    maxSubscriptionsPerConnection: positiveInteger(
      env("BROADCAST_MAX_SUBSCRIPTIONS"),
      256
    ),
    pattern: normalizeBroadcastChannelPattern(
      env("BROADCAST_CHANNEL_PATTERN", "^[A-Za-z0-9_.:-]+$")
    ),
  },
  singleInstanceAcknowledged: envBoolean("BROADCAST_SINGLE_INSTANCE", false),
  websocket: {
    backpressureLimit: positiveInteger(
      env("BROADCAST_WS_BACKPRESSURE_LIMIT"),
      1_048_576
    ),
    idleTimeout: positiveInteger(env("BROADCAST_WS_IDLE_TIMEOUT"), 120),
    maxPayloadLength: positiveInteger(env("BROADCAST_WS_MAX_PAYLOAD"), 65_536),
    path: normalizeBroadcastPath(env("BROADCAST_WS_PATH", "/broadcasting")),
  },
};

export type BroadcastingConfig = typeof broadcastingConfig;

export function normalizeBroadcastConnection(
  value: string | undefined,
  fallback: BroadcastConnectionName = "realtime"
): BroadcastConnectionName {
  const normalized = value?.trim().toLowerCase();

  return normalized === "realtime" || normalized === "log" ? normalized : fallback;
}

export function normalizeBroadcastPath(value: string | undefined) {
  const path = value?.trim() || "/broadcasting";

  return path.startsWith("/") ? path : `/${path}`;
}

export function normalizeBroadcastAuthQuery(value: string | undefined) {
  const normalized = value?.trim() || "token";

  return /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(normalized) ? normalized : "token";
}

export function normalizeBroadcastChannelPattern(value: string | undefined) {
  const normalized = value?.trim() || "^[A-Za-z0-9_.:-]+$";

  try {
    new RegExp(normalized);

    return normalized;
  } catch {
    return "^[A-Za-z0-9_.:-]+$";
  }
}

export function resolveBroadcastAuthRequired(
  value: string | undefined,
  token: string | undefined,
  environment = appConfig.env
) {
  if (value !== undefined) {
    return envBooleanValue(value, false);
  }

  return Boolean(token?.trim()) || isProductionEnvironment(environment);
}

export function assertBroadcastConfiguration(
  config: BroadcastingConfig = broadcastingConfig,
  environment = appConfig.env
) {
  if (config.auth.required && !config.auth.token.trim()) {
    throw new Error(
      "BROADCAST_AUTH_TOKEN or API_BEARER_TOKEN is required when broadcast WebSocket auth is enabled."
    );
  }

  if (
    isProductionEnvironment(environment) &&
    config.defaultConnection === "realtime" &&
    !config.singleInstanceAcknowledged
  ) {
    throw new Error(
      "BROADCAST_CONNECTION=realtime uses an in-process WebSocket broadcaster. Set BROADCAST_SINGLE_INSTANCE=true to acknowledge single-instance production deployment."
    );
  }
}
