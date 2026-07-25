import type { Elysia } from "elysia";

import { assertQueueConfiguration } from "../../config/queue";
import type { ServiceProvider } from "./ServiceProvider";

export class QueueServiceProvider implements ServiceProvider {
  register(app: Elysia) {
    assertQueueConfiguration();

    return app;
  }

  boot(app: Elysia) {
    return app;
  }
}
