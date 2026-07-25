import { cors } from "@elysia/cors";
import type { Elysia } from "elysia";

import { corsConfig, type CorsConfig } from "../../../config/cors";

export class CorsMiddleware {
  constructor(private readonly options: CorsConfig = corsConfig) {}

  handle(app: Elysia) {
    return app.use(cors(this.options)) as unknown as Elysia;
  }
}
