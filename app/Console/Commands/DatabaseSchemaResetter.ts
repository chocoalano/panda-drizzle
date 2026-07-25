import { Database as BunSqliteDatabase } from "bun:sqlite";
import { createConnection } from "mysql2/promise";
import { basename, isAbsolute, resolve } from "node:path";
import postgres from "postgres";

import {
  databaseConfig,
  requireDatabaseUrl,
  type DatabaseConfig,
} from "../../../config/database";
import { mysqlPoolOptionsFromConfig } from "../../../config/Database/connections";

export type DatabaseResetResult = {
  droppedSchemas: string[];
  droppedTables: string[];
};

export type DatabaseSchemaResetOptions = {
  cwd?: string;
};

export type DatabaseSchemaResetter = (
  config?: DatabaseConfig,
  options?: DatabaseSchemaResetOptions
) => Promise<DatabaseResetResult>;

export async function resetDatabaseSchema(
  config: DatabaseConfig = databaseConfig,
  options: DatabaseSchemaResetOptions = {}
): Promise<DatabaseResetResult> {
  assertDatabaseSchemaResetAllowed(config, options);

  switch (config.connection) {
    case "mysql":
      return resetMysqlDatabaseSchema(config);
    case "postgresql":
      return resetPostgresqlDatabaseSchema(config);
    case "sqlite":
      return resetSqliteDatabaseSchema(config, options);
  }
}

export async function resetMysqlDatabaseSchema(config: DatabaseConfig) {
  const connection = await createConnection(mysqlPoolOptionsFromConfig(config));
  const droppedTables: string[] = [];

  try {
    const [rows] = await connection.query("SHOW TABLES");
    const tables = mysqlTableNamesFromRows(rows as Record<string, unknown>[]);

    await connection.query("SET FOREIGN_KEY_CHECKS=0");

    for (const table of tables) {
      await connection.query(`DROP TABLE IF EXISTS ${quoteSqlIdentifier(table, "`")}`);
      droppedTables.push(table);
    }

    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    await connection.end();
  }

  return {
    droppedSchemas: [],
    droppedTables,
  };
}

export async function resetPostgresqlDatabaseSchema(config: DatabaseConfig) {
  const sql = postgres(requireDatabaseUrl(config.url), {
    max: 1,
  });
  const droppedTables: string[] = [];
  const droppedSchemas: string[] = [];

  try {
    const tables = await sql<{ schemaname: string; tablename: string }[]>`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY(current_schemas(false))
    `;

    for (const table of tables) {
      const name = `${table.schemaname}.${table.tablename}`;

      await sql.unsafe(
        `DROP TABLE IF EXISTS ${quoteSqlIdentifier(
          table.schemaname,
          '"'
        )}.${quoteSqlIdentifier(table.tablename, '"')} CASCADE`
      );
      droppedTables.push(name);
    }

    const drizzleSchemas = await sql<{ schema_name: string }[]>`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'drizzle'
    `;

    if (drizzleSchemas.length > 0) {
      await sql.unsafe('DROP SCHEMA IF EXISTS "drizzle" CASCADE');
      droppedSchemas.push("drizzle");
    }
  } finally {
    await sql.end();
  }

  return {
    droppedSchemas,
    droppedTables,
  };
}

export async function resetSqliteDatabaseSchema(
  config: DatabaseConfig,
  options: DatabaseSchemaResetOptions = {}
) {
  const database = new BunSqliteDatabase(
    resolveSqliteDatabasePath(requireDatabaseUrl(config.url), options.cwd),
    {
      create: true,
    }
  );
  const droppedTables: string[] = [];

  try {
    const tables = database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .all();

    database.exec("PRAGMA foreign_keys=OFF");

    for (const table of tables) {
      database.exec(`DROP TABLE IF EXISTS ${quoteSqlIdentifier(table.name, '"')}`);
      droppedTables.push(table.name);
    }

    database.exec("PRAGMA foreign_keys=ON");
  } finally {
    database.close();
  }

  return {
    droppedSchemas: [],
    droppedTables,
  };
}

export function mysqlTableNamesFromRows(rows: Record<string, unknown>[]) {
  return rows
    .map((row) => Object.values(row)[0])
    .filter((value): value is string => typeof value === "string");
}

export function quoteSqlIdentifier(value: string, quote: '"' | "`") {
  assertSafeSqlIdentifier(value);

  return `${quote}${value.replaceAll(quote, `${quote}${quote}`)}${quote}`;
}

export function resolveSqliteDatabasePath(
  value: string,
  cwd = process.cwd()
) {
  if (value === ":memory:" || value.startsWith("file:") || isAbsolute(value)) {
    return value;
  }

  return resolve(cwd, value);
}

export function assertDatabaseSchemaResetAllowed(
  config: DatabaseConfig,
  options: DatabaseSchemaResetOptions = {}
) {
  if (config.allowSchemaReset) {
    return;
  }

  const target = schemaResetTarget(config, options);

  if (
    config.schemaResetAllowedDatabases.includes(target) ||
    isSafeSchemaResetTarget(target, config.connection)
  ) {
    return;
  }

  throw new Error(
    `Refusing to reset database schema for "${target}". Set DB_ALLOW_SCHEMA_RESET=true or add the database to DB_SCHEMA_RESET_ALLOWED_DATABASES.`
  );
}

export function isSafeSchemaResetTarget(
  target: string,
  connection: DatabaseConfig["connection"]
) {
  if (connection === "sqlite") {
    return target === ":memory:" || basename(target) === "database.sqlite";
  }

  return /(?:^|[_-])(test|testing|dev|local)$/i.test(target);
}

function assertSafeSqlIdentifier(value: string) {
  if (!value || value.includes("\0")) {
    throw new Error("Unsafe SQL identifier.");
  }
}

function schemaResetTarget(
  config: DatabaseConfig,
  options: DatabaseSchemaResetOptions
) {
  if (config.connection === "sqlite") {
    return resolveSqliteDatabasePath(requireDatabaseUrl(config.url), options.cwd);
  }

  return config.database || requireDatabaseUrl(config.url);
}
