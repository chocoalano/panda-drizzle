import { cp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  databaseConfig,
  type DatabaseConfig,
} from "../../../config/database";

export type MigrationArtifactPaths = {
  migrationsDirectory: string;
  migrationsMetaDirectory: string;
  configMetaDirectory: string;
};

export function resolveMigrationArtifactPaths(
  config: Pick<DatabaseConfig, "migrationsPath" | "migrationsMetaPath"> =
    databaseConfig,
  cwd = process.cwd()
): MigrationArtifactPaths {
  const migrationsDirectory = resolve(cwd, config.migrationsPath);

  return {
    migrationsDirectory,
    migrationsMetaDirectory: join(migrationsDirectory, "meta"),
    configMetaDirectory: resolve(cwd, config.migrationsMetaPath),
  };
}

export async function stageDrizzleMigrationMeta(
  paths: MigrationArtifactPaths
) {
  await removeDirectory(paths.migrationsMetaDirectory);

  if (!(await Bun.file(join(paths.configMetaDirectory, "_journal.json")).exists())) {
    return;
  }

  await mkdir(paths.migrationsDirectory, { recursive: true });
  await cp(paths.configMetaDirectory, paths.migrationsMetaDirectory, {
    recursive: true,
    force: true,
  });
}

export async function storeDrizzleMigrationMeta(paths: MigrationArtifactPaths) {
  if (!(await Bun.file(join(paths.migrationsMetaDirectory, "_journal.json")).exists())) {
    await removeDirectory(paths.migrationsMetaDirectory);

    return;
  }

  await removeDirectory(paths.configMetaDirectory);
  await mkdir(resolve(paths.configMetaDirectory, ".."), { recursive: true });
  await cp(paths.migrationsMetaDirectory, paths.configMetaDirectory, {
    recursive: true,
    force: true,
  });
  await removeDirectory(paths.migrationsMetaDirectory);
}

export async function cleanupStagedDrizzleMigrationMeta(
  paths: MigrationArtifactPaths
) {
  await removeDirectory(paths.migrationsMetaDirectory);
}

async function removeDirectory(path: string) {
  await rm(path, {
    recursive: true,
    force: true,
  });
}
