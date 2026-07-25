import { describe, expect, it } from "bun:test";

import {
  DatabaseMigrateFreshCommand,
  formatDatabaseResetResult,
} from "../../app/Console/Commands/DatabaseMigrateFreshCommand";
import { DatabaseSeedCommand } from "../../app/Console/Commands/DatabaseSeedCommand";
import { resolveDatabaseConfig } from "../../config/database";

describe("DatabaseMigrateFreshCommand", () => {
  it("resets the schema, migrates, and optionally seeds", async () => {
    const calls: string[] = [];
    const output: string[] = [];
    const command = new DatabaseMigrateFreshCommand(
      async () => {
        calls.push("reset");

        return {
          droppedSchemas: [],
          droppedTables: ["system_settings"],
        };
      },
      async () => {
        calls.push("migrate");

        return 0;
      },
      resolveDatabaseConfig({ connection: "sqlite", database: ":memory:" }),
      "local",
      {
        async handle(stdout: (message: string) => void) {
          calls.push("seed");
          stdout("seeded");
        },
      } as unknown as DatabaseSeedCommand
    );

    await command.handle((message) => output.push(message), console.error, {
      args: ["--seed"],
    });

    expect(calls).toEqual(["reset", "migrate", "seed"]);
    expect(output).toEqual(["Dropped 1 table(s).", "seeded"]);
  });

  it("refuses production fresh migrations without force", async () => {
    const command = new DatabaseMigrateFreshCommand(
      async () => ({ droppedSchemas: [], droppedTables: [] }),
      async () => 0,
      resolveDatabaseConfig({ connection: "mysql" }),
      "production"
    );

    await expect(command.handle(console.log, console.error)).rejects.toThrow(
      "without --force"
    );
  });
});

describe("formatDatabaseResetResult", () => {
  it("formats dropped table and schema counts", () => {
    expect(
      formatDatabaseResetResult({
        droppedSchemas: ["drizzle"],
        droppedTables: ["public.users"],
      })
    ).toEqual(["Dropped 1 table(s).", "Dropped 1 schema(s)."]);
  });
});
