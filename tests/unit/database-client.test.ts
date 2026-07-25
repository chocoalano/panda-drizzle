import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import { resolveDatabaseConfig } from "../../config/database";
import { createDatabaseClient } from "../../config/Database/client";

describe("createDatabaseClient", () => {
  it("creates a SQLite client without an external database server", () => {
    const db = createDatabaseClient(
      resolveDatabaseConfig({
        connection: "sqlite",
        database: ":memory:",
      })
    );

    expect(typeof db.insert).toBe("function");
    expect(db.$client).toBeInstanceOf(SqliteDatabase);
    (db.$client as SqliteDatabase).close();
  });
});
