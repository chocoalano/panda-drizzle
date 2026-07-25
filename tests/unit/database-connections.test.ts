import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import { resolveDatabaseConfig } from "../../config/database";
import {
  createDatabaseConnection,
  mysqlPoolOptionsFromConfig,
} from "../../config/Database/connections";

describe("createDatabaseConnection", () => {
  it("creates a SQLite Drizzle connection through the configured driver", () => {
    const db = createDatabaseConnection(
      resolveDatabaseConfig({
        connection: "sqlite",
        database: ":memory:",
      })
    );

    expect(typeof db.insert).toBe("function");
    expect(db.$client).toBeInstanceOf(SqliteDatabase);
    (db.$client as SqliteDatabase).close();
  });

  it("builds MySQL pool options from SQL credentials", () => {
    const poolOptions = mysqlPoolOptionsFromConfig(
      resolveDatabaseConfig({
        connection: "mysql",
        host: "db.local",
        port: "3307",
        database: "patshop",
        username: "root",
        password: "secret",
        ssl: "Amazon RDS",
      })
    );

    expect(poolOptions).toMatchObject({
      host: "db.local",
      port: 3307,
      user: "root",
      password: "secret",
      database: "patshop",
      ssl: "amazon rds",
    });
  });

  it("rejects URL-only credentials for MySQL connections", () => {
    expect(() =>
      mysqlPoolOptionsFromConfig(
        resolveDatabaseConfig({
          connection: "sqlite",
          database: ":memory:",
        })
      )
    ).toThrow("MySQL database credentials are required.");
  });
});
