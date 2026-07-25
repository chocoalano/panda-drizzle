import { defineConfig } from "drizzle-kit";

import { databaseConfig } from "./config/database";

export default defineConfig({
  out: databaseConfig.migrationsPath,
  schema: databaseConfig.schemaPath,
  dialect: databaseConfig.dialect,
  dbCredentials: databaseConfig.drizzleKitCredentials,
  verbose: true,
  strict: true,
} as Parameters<typeof defineConfig>[0]);
