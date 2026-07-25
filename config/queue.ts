import { appConfig, isProductionEnvironment } from "./app";
import { env, envBoolean } from "./env";
import { positiveInteger } from "./request";

export type QueueConnectionName = "memory" | "sync";

export const queueConfig = {
  allowInMemoryInProduction: envBoolean(
    "QUEUE_ALLOW_IN_MEMORY_PRODUCTION",
    false
  ),
  defaultConnection: normalizeQueueConnection(env("QUEUE_CONNECTION", "sync")),
  worker: {
    maxAttempts: positiveInteger(env("QUEUE_WORKER_MAX_ATTEMPTS"), 3),
    maxJobs: positiveInteger(env("QUEUE_WORKER_MAX_JOBS"), 100),
    sleepMs: positiveInteger(env("QUEUE_WORKER_SLEEP_MS"), 250),
  },
};

export type QueueConfig = typeof queueConfig;

export function normalizeQueueConnection(
  value: string | undefined,
  fallback: QueueConnectionName = "sync"
): QueueConnectionName {
  const normalized = value?.trim().toLowerCase();

  return normalized === "sync" || normalized === "memory" ? normalized : fallback;
}

export function assertQueueConfiguration(
  config: QueueConfig = queueConfig,
  environment = appConfig.env
) {
  if (
    isProductionEnvironment(environment) &&
    !config.allowInMemoryInProduction
  ) {
    throw new Error(
      "QUEUE_CONNECTION=sync/memory is not durable for production. Configure a durable queue driver or set QUEUE_ALLOW_IN_MEMORY_PRODUCTION=true to acknowledge single-process behavior."
    );
  }
}
