import type { ElysiaOpenTelemetryOptions } from "@elysia/opentelemetry";

import { appConfig } from "./app";
import { env, envBoolean } from "./env";
import { sensitiveQueryParamNames } from "./sanitization";

export const telemetryConfig = {
  enabled: envBoolean("OTEL_ENABLED", false),
  serviceName: env("OTEL_SERVICE_NAME", appConfig.name),
  traceHealthChecks: envBoolean("OTEL_TRACE_HEALTH", false),
  requestHeaders: ["x-request-id", "user-agent"],
  responseHeaders: [appConfig.headers.requestId, appConfig.headers.appName],
};

export type TelemetryConfig = typeof telemetryConfig;

export function shouldTraceRequest(
  request: Request,
  traceHealthChecks = telemetryConfig.traceHealthChecks
) {
  if (traceHealthChecks) {
    return true;
  }

  const pathname = new URL(request.url).pathname;

  return pathname !== "/health" && pathname !== "/api/health";
}

export function buildOpenTelemetryOptions(
  config: TelemetryConfig = telemetryConfig
): ElysiaOpenTelemetryOptions {
  return {
    serviceName: config.serviceName,
    checkIfShouldTrace: (request) =>
      shouldTraceRequest(request, config.traceHealthChecks),
    headersToSpanAttributes: {
      request: config.requestHeaders,
      response: config.responseHeaders,
    },
    spanUrlRedaction: {
      stripCredentials: true,
      sensitiveQueryParams: [...sensitiveQueryParamNames],
    },
  };
}
