import { describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DatabaseMigrateCommand,
  hasSeedFlag,
} from "../../app/Console/Commands/DatabaseMigrateCommand";
import { DatabaseSeedCommand } from "../../app/Console/Commands/DatabaseSeedCommand";
import type { DrizzleKitRunner } from "../../app/Console/Commands/DrizzleKitCommand";
import { resolveDatabaseConfig } from "../../config/database";

describe("DatabaseMigrateCommand", () => {
  it("stages Drizzle meta for migrate and cleans it afterward", async () => {
    const cwd = await mkdtemp();
    const config = resolveDatabaseConfig({ connection: "mysql" });
    const configMetaPath = join(cwd, "config/drizzle/meta");
    const stagedMetaPath = join(cwd, "database/migrations/meta");
    const calls: unknown[] = [];
    const runner: DrizzleKitRunner = async (command, options) => {
      calls.push({ command, cwd: options?.cwd });
      expect(
        await Bun.file(join(stagedMetaPath, "_journal.json")).exists()
      ).toBe(true);

      return 0;
    };

    try {
      await mkdir(configMetaPath, { recursive: true });
      await Bun.write(join(configMetaPath, "_journal.json"), "{}");

      const command = new DatabaseMigrateCommand(runner, config);
      await command.handle(console.log, console.error, { cwd });

      expect(calls).toEqual([{ command: "migrate", cwd }]);
      expect(await Bun.file(stagedMetaPath).exists()).toBe(false);
      expect(
        await Bun.file(join(configMetaPath, "_journal.json")).exists()
      ).toBe(true);
    } finally {
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });

  it("refuses production migrations without force", async () => {
    const command = new DatabaseMigrateCommand(async () => 0, undefined, "production");

    await expect(
      command.handle(console.log, console.error, {})
    ).rejects.toThrow("without --force");
  });

  it("runs seeders after migrate when --seed is provided", async () => {
    const output: string[] = [];
    const calls: string[] = [];
    const command = new DatabaseMigrateCommand(
      async () => {
        calls.push("migrate");

        return 0;
      },
      resolveDatabaseConfig({ connection: "mysql" }),
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

    expect(calls).toEqual(["migrate", "seed"]);
    expect(output).toEqual(["seeded"]);
  });
});

describe("hasSeedFlag", () => {
  it("detects migrate seed flags", () => {
    expect(hasSeedFlag(["--seed"])).toBe(true);
    expect(hasSeedFlag(["--force"])).toBe(false);
  });
});

async function mkdtemp() {
  const directory = join(
    tmpdir(),
    `patshop-database-migrate-${crypto.randomUUID()}`
  );

  await mkdir(directory, { recursive: true });

  return directory;
}
