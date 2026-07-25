import { drizzle as drizzleSqlite } from "drizzle-orm/bun-sqlite";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle as drizzlePostgresql } from "drizzle-orm/postgres-js";
import type { PoolOptions } from "mysql2";

import {
  databaseConfig,
  requireDatabaseUrl,
  type DatabaseConfig,
  type DatabaseCredentials,
} from "../database";
import { getDatabaseSchema } from "./schema";

export function createDatabaseConnection(config: DatabaseConfig = databaseConfig) {
  switch (config.connection) {
    case "mysql":
      return createMysqlConnection(config);
    case "postgresql":
      return createPostgresqlConnection(config);
    case "sqlite":
      return createSqliteConnection(config);
  }
}

function createMysqlConnection(config: DatabaseConfig) {
  return drizzleMysql({
    connection: mysqlPoolOptionsFromConfig(config),
    schema: getDatabaseSchema("mysql"),
    mode: "default",
  });
}

export function mysqlPoolOptionsFromConfig(
  config: Pick<DatabaseConfig, "credentials">
): PoolOptions {
  const credentials = config.credentials;

  if (isUrlCredentials(credentials)) {
    throw new Error("MySQL database credentials are required.");
  }

  const poolOptions: PoolOptions = {
    host: credentials.host,
    port: credentials.port,
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
  };
  const ssl = mysqlSslOptions(credentials.ssl);

  if (ssl !== undefined) {
    poolOptions.ssl = ssl;
  }

  return poolOptions;
}

function isUrlCredentials(
  credentials: DatabaseConfig["credentials"]
): credentials is { url: string } {
  return "url" in credentials;
}

function mysqlSslOptions(
  ssl: DatabaseCredentials["ssl"]
): PoolOptions["ssl"] | undefined {
  if (ssl === undefined || ssl === false) {
    return undefined;
  }

  if (ssl === true) {
    return {};
  }

  return ssl;
}

function createPostgresqlConnection(config: DatabaseConfig) {
  return drizzlePostgresql({
    connection: {
      url: requireDatabaseUrl(config.url),
    },
    schema: getDatabaseSchema("postgresql"),
  });
}

function createSqliteConnection(config: DatabaseConfig) {
  return drizzleSqlite({
    connection: {
      source: requireDatabaseUrl(config.url),
      create: true,
    },
    schema: getDatabaseSchema("sqlite"),
  });
}
