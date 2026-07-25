import { env } from "./env";

export type DatabaseConnection = "mysql" | "postgresql" | "sqlite";
export type DatabaseDialect = "mysql" | "postgresql" | "sqlite";

export type DatabaseEnvironment = {
  allowSchemaReset?: string;
  connection?: string;
  url?: string;
  host?: string;
  port?: string;
  database?: string;
  schemaResetAllowedDatabases?: string;
  username?: string;
  password?: string;
  ssl?: string;
};

export type DatabaseCredentials = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | string;
};

export type DatabaseConfig = {
  allowSchemaReset: boolean;
  connection: DatabaseConnection;
  dialect: DatabaseDialect;
  url: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | string;
  credentials: DatabaseCredentials | { url: string };
  drizzleKitCredentials: DatabaseCredentials | { url: string };
  schemaPath: string;
  migrationsPath: string;
  migrationsMetaPath: string;
  schemaResetAllowedDatabases: string[];
};

const defaultDatabasePorts = {
  mysql: 3306,
  postgresql: 5432,
  sqlite: 0,
} satisfies Record<DatabaseConnection, number>;

export const databaseMigrationsPath = "./database/migrations";
export const databaseMigrationsMetaPath = "./config/drizzle/meta";

export const databaseConfig = resolveDatabaseConfig();

export function databaseEnvironmentFromEnv(): DatabaseEnvironment {
  return {
    allowSchemaReset: env("DB_ALLOW_SCHEMA_RESET"),
    connection: env("DB_CONNECTION", "mysql"),
    url: env("DATABASE_URL") || env("DB_URL"),
    host: env("DB_HOST", "127.0.0.1"),
    port: env("DB_PORT"),
    database: env("DB_DATABASE"),
    schemaResetAllowedDatabases: env("DB_SCHEMA_RESET_ALLOWED_DATABASES"),
    username: env("DB_USERNAME", "root"),
    password: env("DB_PASSWORD"),
    ssl: env("DB_SSL"),
  };
}

export function resolveDatabaseConfig(
  environment: DatabaseEnvironment = databaseEnvironmentFromEnv()
): DatabaseConfig {
  const connection = normalizeDatabaseConnection(environment.connection);
  const dialect = connection;
  const host = environment.host?.trim() || "127.0.0.1";
  const port = resolveDatabasePort(environment.port, connection);
  const database = resolveDatabaseName(environment.database, connection);
  const username = environment.username?.trim() || defaultDatabaseUsername(connection);
  const password = environment.password ?? "";
  const ssl = parseDatabaseSsl(environment.ssl);
  const url =
    environment.url?.trim() ||
    buildDatabaseUrl({
      connection,
      host,
      port,
      database,
      username,
      password,
    });
  const schemaPath = `./config/drizzle/schemas/${connection}/schema.ts`;
  const migrationsPath = databaseMigrationsPath;
  const credentials =
    connection === "sqlite"
      ? { url: url || database }
      : {
          host,
          port,
          user: username,
          password,
          database,
          ...(ssl === undefined ? {} : { ssl }),
        };

  return {
    allowSchemaReset: parseDatabaseBoolean(environment.allowSchemaReset, false),
    connection,
    dialect,
    url,
    host,
    port,
    database,
    username,
    password,
    ...(ssl === undefined ? {} : { ssl }),
    credentials,
    drizzleKitCredentials: credentials,
    schemaPath,
    migrationsPath,
    migrationsMetaPath: databaseMigrationsMetaPath,
    schemaResetAllowedDatabases: parseCsv(
      environment.schemaResetAllowedDatabases
    ),
  };
}

export function normalizeDatabaseConnection(value = "mysql"): DatabaseConnection {
  const normalized = value.trim().toLowerCase();

  if (["mysql", "mariadb"].includes(normalized)) {
    return "mysql";
  }

  if (
    ["pgsql", "postgres", "postgresql", "cockroach", "cockroachdb"].includes(
      normalized
    )
  ) {
    return "postgresql";
  }

  if (["sqlite", "sqlite3"].includes(normalized)) {
    return "sqlite";
  }

  throw new Error(
    `Unsupported DB_CONNECTION "${value}". Supported values: mysql, mariadb, pgsql, postgres, postgresql, sqlite.`
  );
}

export function resolveDatabasePort(
  value: string | undefined,
  connection: DatabaseConnection
) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : defaultDatabasePorts[connection];
}

export function resolveDatabaseName(
  value: string | undefined,
  connection: DatabaseConnection
) {
  const normalized = value?.trim();

  if (normalized) {
    return normalized;
  }

  return connection === "sqlite" ? "database/database.sqlite" : "";
}

export function buildDatabaseUrl(input: {
  connection: DatabaseConnection;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}) {
  if (input.connection === "sqlite") {
    return input.database;
  }

  if (!input.database) {
    return "";
  }

  const protocol = input.connection === "mysql" ? "mysql" : "postgresql";
  const username = encodeURIComponent(input.username);
  const password = input.password ? `:${encodeURIComponent(input.password)}` : "";
  const auth = username ? `${username}${password}@` : "";

  return `${protocol}://${auth}${input.host}:${input.port}/${input.database}`;
}

export function requireDatabaseUrl(url = databaseConfig.url) {
  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    throw new Error("Database connection URL or database name is required.");
  }

  return normalizedUrl;
}

function defaultDatabaseUsername(connection: DatabaseConnection) {
  return connection === "postgresql" ? "postgres" : "root";
}

function parseDatabaseSsl(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return normalized;
}

function parseDatabaseBoolean(value: string | undefined, fallback: boolean) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(normalized);
}

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
