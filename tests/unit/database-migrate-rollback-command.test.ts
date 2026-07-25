import { describe, expect, it } from "bun:test";

import { DatabaseMigrateRollbackCommand } from "../../app/Console/Commands/DatabaseMigrateRollbackCommand";
import { resolveDatabaseConfig } from "../../config/database";

describe("DatabaseMigrateRollbackCommand", () => {
  it("requires force because rollback is a destructive reset fallback", async () => {
    const command = new DatabaseMigrateRollbackCommand(
      async () => ({ droppedSchemas: [], droppedTables: [] }),
      resolveDatabaseConfig({ connection: "sqlite", database: ":memory:" })
    );

    await expect(command.handle(console.log)).rejects.toThrow("destructive");
  });

  it("resets the configured schema when forced", async () => {
    const output: string[] = [];
    const command = new DatabaseMigrateRollbackCommand(
      async () => ({
        droppedSchemas: [],
        droppedTables: ["system_settings"],
      }),
      resolveDatabaseConfig({ connection: "sqlite", database: ":memory:" })
    );

    const result = await command.handle((message) => output.push(message), console.error, {
      force: true,
    });

    expect(result.droppedTables).toEqual(["system_settings"]);
    expect(output).toEqual(["Dropped 1 table(s)."]);
  });

  it("refuses production rollback without explicit force", async () => {
    const command = new DatabaseMigrateRollbackCommand(
      async () => ({ droppedSchemas: [], droppedTables: [] }),
      resolveDatabaseConfig({ connection: "mysql" }),
      "production"
    );

    await expect(command.handle(console.log)).rejects.toThrow("destructive");
  });
});
