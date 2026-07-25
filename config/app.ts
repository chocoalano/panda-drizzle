import { env } from "./env";

const rawAppEnvironment = env("APP_ENV") || undefined;

export const appConfig = {
  name: env("APP_NAME", "patshop-ondemand-webapp"),
  env: normalizeAppEnvironment(rawAppEnvironment),
  debug: resolveAppDebug(env("APP_DEBUG") || undefined, rawAppEnvironment),
  locale: normalizeAppLocale(env("APP_LOCALE", "id_ID")),
  intlLocale: toIntlLocale(normalizeAppLocale(env("APP_LOCALE", "id_ID"))),
  timeZone: normalizeTimeZone(env("TIMEZONE", "UTC")),
  port: resolvePort(env("PORT")),
  headers: {
    appName: "x-app-name",
    requestId: "x-request-id",
  },
};

export type AppConfig = typeof appConfig;

export function normalizeAppEnvironment(value: string | undefined) {
  return value?.trim().toLowerCase() || "local";
}

export function isProductionEnvironment(value: string | undefined) {
  return normalizeAppEnvironment(value) === "production";
}

export function resolveAppDebug(
  debugValue: string | undefined,
  environmentValue: string | undefined
) {
  const normalizedEnvironment = environmentValue?.trim().toLowerCase();

  return envBooleanValue(
    debugValue,
    normalizedEnvironment === "local" || normalizedEnvironment === "development"
  );
}

export function envBooleanValue(value: string | undefined, fallback = false) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(normalized);
}

export function normalizeAppLocale(value: string | undefined, fallback = "id_ID") {
  const rawLocale = value?.trim() || fallback;
  const intlLocale = rawLocale.replace(/_/g, "-");

  try {
    const [canonicalLocale] = Intl.getCanonicalLocales(intlLocale);

    return (canonicalLocale ?? fallback).replace(/-/g, "_");
  } catch {
    return fallback;
  }
}

export function toIntlLocale(locale: string) {
  return normalizeAppLocale(locale).replace(/_/g, "-");
}

export function normalizeTimeZone(value: string | undefined, fallback = "UTC") {
  const rawTimeZone = value?.trim() || fallback;
  const alias = rawTimeZone.toUpperCase();
  const normalizedTimeZone =
    alias === "UCT" || alias === "GMT" || alias === "Z" ? "UTC" : rawTimeZone;

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: normalizedTimeZone,
    }).format(new Date("2026-01-01T00:00:00.000Z"));

    return normalizedTimeZone;
  } catch {
    return fallback;
  }
}

export function resolvePort(value: string | undefined, fallback = 3000) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
