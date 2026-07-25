import type { DatabaseConnection } from "../database";
import * as mysqlSchema from "../drizzle/schemas/mysql/schema";
import * as postgresqlSchema from "../drizzle/schemas/postgresql/schema";
import * as sqliteSchema from "../drizzle/schemas/sqlite/schema";

export type DatabaseSchema =
  | typeof mysqlSchema
  | typeof postgresqlSchema
  | typeof sqliteSchema;

export const databaseSchemas = {
  mysql: mysqlSchema,
  postgresql: postgresqlSchema,
  sqlite: sqliteSchema,
} satisfies Record<DatabaseConnection, DatabaseSchema>;

export function getDatabaseSchema(connection: DatabaseConnection): DatabaseSchema {
  return databaseSchemas[connection];
}

export function getSystemSettingsTable(connection: DatabaseConnection) {
  return getDatabaseSchema(connection).systemSettings;
}
