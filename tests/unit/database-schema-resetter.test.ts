import { describe, expect, it } from "bun:test";
import { Database as BunSqliteDatabase } from "bun:sqlite";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertDatabaseSchemaResetAllowed,
  isSafeSchemaResetTarget,
  mysqlTableNamesFromRows,
  quoteSqlIdentifier,
  resetDatabaseSchema,
  resolveSqliteDatabasePath,
} from "../../app/Console/Commands/DatabaseSchemaResetter";
import { resolveDatabaseConfig } from "../../config/database";

describe("resetDatabaseSchema", () => {
  it("drops application tables from sqlite databases", async () => {
    const cwd = await mkdtemp();
    const database = join(cwd, "database.sqlite");
    const sqlite = new BunSqliteDatabase(database, { create: true });

    try {
      sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY)");
      sqlite.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY)");
      sqlite.close();

      const result = await resetDatabaseSchema(
        resolveDatabaseConfig({
          connection: "sqlite",
          database,
        })
      );
      const verify = new BunSqliteDatabase(database);
      const tables = verify
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
        .all();

      verify.close();

      expect(result.droppedTables.sort()).toEqual(["posts", "users"]);
      expect(tables).toEqual([]);
    } finally {
      sqlite.close(false);
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });
});

describe("database reset helpers", () => {
  it("extracts MySQL table names from SHOW TABLES rows", () => {
    expect(
      mysqlTableNamesFromRows([
        {
          Tables_in_app: "users",
        },
      ])
    ).toEqual(["users"]);
  });

  it("quotes SQL identifiers", () => {
    expect(quoteSqlIdentifier("users", "`")).toBe("`users`");
    expect(quoteSqlIdentifier('user"logs', '"')).toBe('"user""logs"');
  });

  it("resolves relative SQLite database paths from command cwd", () => {
    expect(resolveSqliteDatabasePath("database/database.sqlite", "/app")).toBe(
      "/app/database/database.sqlite"
    );
    expect(resolveSqliteDatabasePath(":memory:", "/app")).toBe(":memory:");
  });

  it("guards destructive resets to explicitly safe targets", () => {
    expect(isSafeSchemaResetTarget("patshop_test", "mysql")).toBe(true);
    expect(isSafeSchemaResetTarget("patshop", "mysql")).toBe(false);
    expect(isSafeSchemaResetTarget("/tmp/app/database.sqlite", "sqlite")).toBe(true);
    expect(() =>
      assertDatabaseSchemaResetAllowed(
        resolveDatabaseConfig({
          connection: "mysql",
          database: "patshop",
        })
      )
    ).toThrow("Refusing to reset database schema");
    expect(() =>
      assertDatabaseSchemaResetAllowed(
        resolveDatabaseConfig({
          allowSchemaReset: "true",
          connection: "mysql",
          database: "patshop",
        })
      )
    ).not.toThrow();
    expect(() =>
      assertDatabaseSchemaResetAllowed(
        resolveDatabaseConfig({
          connection: "mysql",
          database: "patshop",
          schemaResetAllowedDatabases: "patshop",
        })
      )
    ).not.toThrow();
  });
});

async function mkdtemp() {
  const directory = join(
    tmpdir(),
    `patshop-database-resetter-${crypto.randomUUID()}`
  );

  await mkdir(directory, { recursive: true });

  return directory;
}
