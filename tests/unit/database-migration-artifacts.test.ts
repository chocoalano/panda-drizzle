import { describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  cleanupStagedDrizzleMigrationMeta,
  resolveMigrationArtifactPaths,
  stageDrizzleMigrationMeta,
  storeDrizzleMigrationMeta,
} from "../../app/Console/Commands/DatabaseMigrationArtifacts";

describe("database migration artifacts", () => {
  it("resolves migration SQL and Drizzle meta paths separately", async () => {
    const cwd = "/tmp/patshop";
    const paths = resolveMigrationArtifactPaths(
      {
        migrationsPath: "./database/migrations",
        migrationsMetaPath: "./config/drizzle/meta",
      },
      cwd
    );

    expect(paths.migrationsDirectory).toBe("/tmp/patshop/database/migrations");
    expect(paths.migrationsMetaDirectory).toBe(
      "/tmp/patshop/database/migrations/meta"
    );
    expect(paths.configMetaDirectory).toBe("/tmp/patshop/config/drizzle/meta");
  });

  it("stages Drizzle meta for the tool and stores it back in config", async () => {
    const cwd = await mkdtemp();
    const paths = resolveMigrationArtifactPaths(
      {
        migrationsPath: "./database/migrations",
        migrationsMetaPath: "./config/drizzle/meta",
      },
      cwd
    );

    try {
      await mkdir(paths.configMetaDirectory, { recursive: true });
      await Bun.write(join(paths.configMetaDirectory, "_journal.json"), "{}");

      await stageDrizzleMigrationMeta(paths);

      expect(
        await Bun.file(join(paths.migrationsMetaDirectory, "_journal.json")).exists()
      ).toBe(true);

      await Bun.write(join(paths.migrationsMetaDirectory, "snapshot.json"), "{}");
      await storeDrizzleMigrationMeta(paths);

      expect(await Bun.file(paths.migrationsMetaDirectory).exists()).toBe(false);
      expect(
        await Bun.file(join(paths.configMetaDirectory, "snapshot.json")).exists()
      ).toBe(true);
    } finally {
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });

  it("cleans staged Drizzle meta without deleting config meta", async () => {
    const cwd = await mkdtemp();
    const paths = resolveMigrationArtifactPaths(
      {
        migrationsPath: "./database/migrations",
        migrationsMetaPath: "./config/drizzle/meta",
      },
      cwd
    );

    try {
      await mkdir(paths.configMetaDirectory, { recursive: true });
      await Bun.write(join(paths.configMetaDirectory, "_journal.json"), "{}");

      await stageDrizzleMigrationMeta(paths);
      await cleanupStagedDrizzleMigrationMeta(paths);

      expect(await Bun.file(paths.migrationsMetaDirectory).exists()).toBe(false);
      expect(
        await Bun.file(join(paths.configMetaDirectory, "_journal.json")).exists()
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
    `patshop-migration-artifacts-${crypto.randomUUID()}`
  );

  await mkdir(directory, { recursive: true });

  return directory;
}
