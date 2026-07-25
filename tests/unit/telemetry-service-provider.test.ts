import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { TelemetryServiceProvider } from "../../app/Providers/TelemetryServiceProvider";

describe("TelemetryServiceProvider", () => {
  it("does not register OpenTelemetry when disabled", () => {
    const app = new Elysia();
    const provider = new TelemetryServiceProvider({
      enabled: false,
      serviceName: "test-service",
      traceHealthChecks: false,
      requestHeaders: [],
      responseHeaders: [],
    });

    expect(provider.register(app)).toBe(app);
    expect(provider.boot(app)).toBe(app);
  });
});
