import { opentelemetry } from "@elysia/opentelemetry";
import type { Elysia } from "elysia";

import {
  buildOpenTelemetryOptions,
  telemetryConfig,
  type TelemetryConfig,
} from "../../config/telemetry";
import type { ServiceProvider } from "./ServiceProvider";

export class TelemetryServiceProvider implements ServiceProvider {
  constructor(private readonly config: TelemetryConfig = telemetryConfig) {}

  register(app: Elysia) {
    if (!this.config.enabled) {
      return app;
    }

    return app.use(
      opentelemetry(buildOpenTelemetryOptions(this.config))
    ) as unknown as Elysia;
  }

  boot(app: Elysia) {
    return app;
  }
}
