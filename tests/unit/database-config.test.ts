import { describe, expect, it } from "bun:test";

import {
  buildDatabaseUrl,
  databaseConfig,
  normalizeDatabaseConnection,
  requireDatabaseUrl,
  resolveDatabaseConfig,
} from "../../config/database";

describe("databaseConfig", () => {
  it("points Drizzle at the Laravel-style schema and migration folders", () => {
    expect(databaseConfig.connection).toBe("mysql");
    expect(databaseConfig.dialect).toBe("mysql");
    expect(databaseConfig.schemaPath).toBe(
      "./config/drizzle/schemas/mysql/schema.ts"
    );
    expect(databaseConfig.migrationsPath).toBe("./database/migrations");
    expect(databaseConfig.migrationsMetaPath).toBe("./config/drizzle/meta");
    expect(databaseConfig.allowSchemaReset).toBe(false);
    expect(databaseConfig.schemaResetAllowedDatabases).toEqual([]);
  });

  it("uses one shared migration and journal directory for every connection", () => {
    for (const connection of ["mysql", "postgresql", "sqlite"] as const) {
      const config = resolveDatabaseConfig({
        connection,
        database: "patshop",
      });

      expect(config.migrationsPath).toBe("./database/migrations");
      expect(config.migrationsMetaPath).toBe("./config/drizzle/meta");
      expect(config.schemaPath).toBe(
        `./config/drizzle/schemas/${connection}/schema.ts`
      );
      expect(config.dialect).toBe(connection);
    }
  });

  it("normalizes supported connection aliases", () => {
    expect(normalizeDatabaseConnection("mariadb")).toBe("mysql");
    expect(normalizeDatabaseConnection("pgsql")).toBe("postgresql");
    expect(normalizeDatabaseConnection("postgres")).toBe("postgresql");
    expect(normalizeDatabaseConnection("sqlite3")).toBe("sqlite");
  });

  it("resolves MySQL credentials from Laravel-style environment values", () => {
    const config = resolveDatabaseConfig({
      connection: "mysql",
      host: "db.local",
      port: "3307",
      database: "patshop",
      username: "root",
      password: "secret",
    });

    expect(config.dialect).toBe("mysql");
    expect(config.url).toBe("mysql://root:secret@db.local:3307/patshop");
    expect(config.drizzleKitCredentials).toMatchObject({
      host: "db.local",
      port: 3307,
      user: "root",
      password: "secret",
      database: "patshop",
    });
  });

  it("resolves PostgreSQL and SQLite schema paths", () => {
    expect(
      resolveDatabaseConfig({
        connection: "pgsql",
        database: "patshop",
      }).schemaPath
    ).toBe("./config/drizzle/schemas/postgresql/schema.ts");
    expect(
      resolveDatabaseConfig({
        connection: "sqlite",
      }).schemaPath
    ).toBe("./config/drizzle/schemas/sqlite/schema.ts");
  });

  it("builds database URLs for SQL drivers", () => {
    expect(
      buildDatabaseUrl({
        connection: "postgresql",
        host: "127.0.0.1",
        port: 5432,
        database: "patshop",
        username: "postgres",
        password: "secret",
      })
    ).toBe("postgresql://postgres:secret@127.0.0.1:5432/patshop");
  });

  it("parses schema reset safety configuration", () => {
    const config = resolveDatabaseConfig({
      allowSchemaReset: "true",
      connection: "mysql",
      database: "patshop",
      schemaResetAllowedDatabases: "patshop_test, patshop_local",
    });

    expect(config.allowSchemaReset).toBe(true);
    expect(config.schemaResetAllowedDatabases).toEqual([
      "patshop_test",
      "patshop_local",
    ]);
  });
});

describe("requireDatabaseUrl", () => {
  it("returns a normalized database URL", () => {
    expect(requireDatabaseUrl(" postgres://user:pass@localhost/db ")).toBe(
      "postgres://user:pass@localhost/db"
    );
  });

  it("throws when the database URL is missing", () => {
    expect(() => requireDatabaseUrl("")).toThrow(
      "Database connection URL or database name is required."
    );
  });
});
