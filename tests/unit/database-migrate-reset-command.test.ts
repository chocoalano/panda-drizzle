import { describe, expect, it } from "bun:test";

import { DatabaseMigrateResetCommand } from "../../app/Console/Commands/DatabaseMigrateResetCommand";
import { resolveDatabaseConfig } from "../../config/database";

describe("DatabaseMigrateResetCommand", () => {
  it("resets the configured schema", async () => {
    const output: string[] = [];
    const calls: unknown[] = [];
    const command = new DatabaseMigrateResetCommand(
      async (_config, options) => {
        calls.push(options);

        return {
          droppedSchemas: [],
          droppedTables: ["system_settings"],
        };
      },
      resolveDatabaseConfig({ connection: "sqlite", database: ":memory:" })
    );

    const result = await command.handle((message) => output.push(message), console.error, {
      cwd: "/tmp/project",
    });

    expect(result.droppedTables).toEqual(["system_settings"]);
    expect(calls).toEqual([{ cwd: "/tmp/project" }]);
    expect(output).toEqual(["Dropped 1 table(s)."]);
  });

  it("refuses production reset without force", async () => {
    const command = new DatabaseMigrateResetCommand(
      async () => ({ droppedSchemas: [], droppedTables: [] }),
      resolveDatabaseConfig({ connection: "mysql" }),
      "production"
    );

    await expect(command.handle(console.log)).rejects.toThrow("without --force");
  });
});
