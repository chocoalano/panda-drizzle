import {
  databaseConfig,
  type DatabaseConfig,
} from "../database";
import { createDatabaseConnection } from "./connections";

export function createDatabaseClient(config: DatabaseConfig = databaseConfig) {
  return createDatabaseConnection(config);
}

export type Database = ReturnType<typeof createDatabaseClient>;
