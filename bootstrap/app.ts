import { Elysia } from "elysia";

import { appConfig } from "../config/app";
import { apiRoutes } from "../routes/api";
import { renderException } from "./exceptions";
import { middleware, registerMiddleware, type Middleware } from "./middleware";
import { registerProviders } from "./providers";
import type { FrameworkLogger } from "../app/Support/Logging";

export type CreateAppOptions = {
  logger?: FrameworkLogger;
  middleware?: Middleware[];
};

export function createApp(options: CreateAppOptions = {}) {
  const app = registerMiddleware(
    registerProviders(new Elysia({ name: appConfig.name })),
    options.middleware ?? middleware
  );

  return app.use(apiRoutes).onError(({ code, error, request, set }) => {
    const response = renderException(code, error, {
      logger: options.logger,
      request,
    });

    set.status = response.status;

    return response.body;
  });
}

export type App = ReturnType<typeof createApp>;
