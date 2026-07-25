import type { Elysia } from "elysia";

import type { ServiceProvider } from "./ServiceProvider";

export class AppServiceProvider implements ServiceProvider {
  register(app: Elysia) {
    return app;
  }

  boot(app: Elysia) {
    return app;
  }
}
