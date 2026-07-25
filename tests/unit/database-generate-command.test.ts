import { describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DatabaseGenerateCommand } from "../../app/Console/Commands/DatabaseGenerateCommand";
import type { DrizzleKitRunner } from "../../app/Console/Commands/DrizzleKitCommand";
import { resolveDatabaseConfig } from "../../config/database";

describe("DatabaseGenerateCommand", () => {
  it("runs drizzle generation while keeping Drizzle meta in config", async () => {
    const cwd = await mkdtemp();
    const config = resolveDatabaseConfig({ connection: "mysql" });
    const configMetaPath = join(cwd, "config/drizzle/meta");
    const stagedMetaPath = join(cwd, "database/migrations/meta");
    const output: string[] = [];
    const calls: unknown[] = [];
    const runner: DrizzleKitRunner = async (command, options) => {
      calls.push({ command, cwd: options?.cwd });
      expect(
        await Bun.file(join(stagedMetaPath, "_journal.json")).exists()
      ).toBe(true);
      await Bun.write(join(stagedMetaPath, "0001_snapshot.json"), "{}");

      return 0;
    };

    try {
      await mkdir(configMetaPath, { recursive: true });
      await Bun.write(join(configMetaPath, "_journal.json"), "{}");

      const command = new DatabaseGenerateCommand(runner, config);
      await command.handle(
        (message) => output.push(message),
        (message) => output.push(message),
        { cwd }
      );

      expect(calls).toEqual([{ command: "generate", cwd }]);
      expect(await Bun.file(stagedMetaPath).exists()).toBe(false);
      expect(
        await Bun.file(join(configMetaPath, "0001_snapshot.json")).exists()
      ).toBe(true);
    } finally {
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });
});

async function mkdtemp() {
  const directory = join(
    tmpdir(),
    `patshop-database-generate-${crypto.randomUUID()}`
  );

  await mkdir(directory, { recursive: true });

  return directory;
}
