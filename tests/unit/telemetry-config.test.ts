import { describe, expect, it } from "bun:test";

import {
  buildOpenTelemetryOptions,
  shouldTraceRequest,
} from "../../config/telemetry";

describe("shouldTraceRequest", () => {
  it("skips health checks unless explicitly enabled", () => {
    expect(shouldTraceRequest(new Request("http://localhost/health"))).toBe(
      false
    );
    expect(shouldTraceRequest(new Request("http://localhost/api/health"))).toBe(
      false
    );
    expect(
      shouldTraceRequest(new Request("http://localhost/health"), true)
    ).toBe(true);
  });

  it("traces application routes", () => {
    expect(shouldTraceRequest(new Request("http://localhost/users"))).toBe(
      true
    );
  });
});

describe("buildOpenTelemetryOptions", () => {
  it("builds Elysia OpenTelemetry options", () => {
    const options = buildOpenTelemetryOptions({
      enabled: true,
      serviceName: "test-service",
      traceHealthChecks: false,
      requestHeaders: ["x-request-id"],
      responseHeaders: ["x-app-name"],
    });

    expect(options.serviceName).toBe("test-service");
    expect(options.headersToSpanAttributes).toEqual({
      request: ["x-request-id"],
      response: ["x-app-name"],
    });
    expect(options.checkIfShouldTrace?.(new Request("http://localhost/users"))).toBe(
      true
    );
    const spanUrlRedaction = options.spanUrlRedaction;

    if (spanUrlRedaction === false || spanUrlRedaction === undefined) {
      throw new Error("Expected span URL redaction to be configured.");
    }

    expect(spanUrlRedaction.sensitiveQueryParams).toContain("x-amz-signature");
  });
});
