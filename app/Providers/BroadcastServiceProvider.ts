import type { Elysia } from "elysia";

import { assertBroadcastConfiguration } from "../../config/broadcasting";
import type { ServiceProvider } from "./ServiceProvider";

export class BroadcastServiceProvider implements ServiceProvider {
  register(app: Elysia) {
    assertBroadcastConfiguration();

    return app;
  }

  boot(app: Elysia) {
    return app;
  }
}
