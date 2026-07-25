import { isAbsolute, resolve } from "node:path";

import { appConfig } from "./app";
import { env, envBoolean } from "./env";

export type LoggerLevel = "debug" | "error" | "info" | "trace" | "warn";

const defaultRedactions = [
  "request.headers.authorization",
  "request.headers.cookie",
  "request.headers.set-cookie",
] as const;

export const loggerConfig = {
  errorFile: resolveLogFile(
    env("LOG_ERROR_FILE", "storage/logs/framework-errors.log")
  ),
  includeStack: envBoolean("LOG_INCLUDE_STACK", appConfig.debug),
  level: normalizeLoggerLevel(env("LOG_LEVEL", "error")),
  name: appConfig.name,
  redactPaths: parseLogRedactions(env("LOG_REDACT_PATHS")),
  sync: envBoolean("LOG_SYNC", true),
};

export type LoggerConfig = typeof loggerConfig;

export function normalizeLoggerLevel(
  value: string | undefined,
  fallback: LoggerLevel = "error"
): LoggerLevel {
  const level = value?.trim().toLowerCase();

  return level === "trace" ||
    level === "debug" ||
    level === "info" ||
    level === "warn" ||
    level === "error"
    ? level
    : fallback;
}

export function resolveLogFile(value: string) {
  const path = value.trim() || "storage/logs/framework-errors.log";

  return isAbsolute(path) ? resolve(path) : resolve(process.cwd(), path);
}

export function parseLogRedactions(value: string) {
  const paths = value
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);

  return paths.length > 0 ? paths : [...defaultRedactions];
}
