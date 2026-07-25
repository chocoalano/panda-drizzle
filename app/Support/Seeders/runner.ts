import {
  databaseConfig,
  type DatabaseConfig,
} from "../../../config/database";
import { seederConfig } from "../../../config/seeder";
import { createDatabaseClient, type Database } from "../../../config/Database/client";
import type { SeederContext } from "./faker";
import {
  createSeederContext,
  summarizeSeederContext,
} from "./faker";
import type { Seeder } from "./Seeder";
import {
  DatabaseSeeder,
  type DatabaseSeederResult,
} from "../../../database/seeders/DatabaseSeeder";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export type RunSeedersOptions = {
  config?: DatabaseConfig;
  context?: SeederContext;
  cwd?: string;
  db?: Database;
  seeder?: DatabaseSeeder;
  target?: string;
};

export type TargetSeederResult = {
  faker: ReturnType<typeof summarizeSeederContext>;
  result: unknown;
  seeder: string;
};

export type { DatabaseSeederResult };

export type SeederRunResult = DatabaseSeederResult | TargetSeederResult;

export async function runSeeders(
  options: RunSeedersOptions = {}
): Promise<SeederRunResult> {
  const config = options.config ?? databaseConfig;
  const db = options.db ?? createDatabaseClient(config);

  if (options.target) {
    if (!seederConfig.allowTargetSeeders) {
      throw new Error(
        "Targeted seeders are disabled. Set SEEDER_ALLOW_TARGETS=true to allow dynamic seeder imports."
      );
    }

    const target = normalizeSeederTarget(options.target);
    const context = options.context ?? createSeederContext();
    const seeder = await loadSeederTarget(target, options.cwd);
    const result = await seeder.run(db, {
      connection: config.connection,
      context,
    });

    return {
      faker: summarizeSeederContext(context),
      result,
      seeder: target.className,
    };
  }

  const seeder = options.seeder ?? new DatabaseSeeder();

  return seeder.run(db, {
    connection: config.connection,
    context: options.context,
  });
}

export type NormalizedSeederTarget = {
  className: string;
  filePath: string;
};

export function normalizeSeederTarget(value: string): NormalizedSeederTarget {
  const target = value
    .trim()
    .replace(/^database\/seeders\//, "")
    .replace(/\.ts$/, "");

  if (!target) {
    throw new Error("Seeder target is required.");
  }

  const segments = target.split("/");

  for (const segment of segments) {
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      !/^[A-Za-z0-9_-]+$/.test(segment)
    ) {
      throw new Error("Seeder target must stay inside database/seeders.");
    }
  }

  const fileName = segments.at(-1) as string;

  return {
    className: pascalCase(fileName),
    filePath: `${segments.join("/")}.ts`,
  };
}

async function loadSeederTarget(
  target: NormalizedSeederTarget,
  cwd = process.cwd()
): Promise<Seeder> {
  const moduleUrl = pathToFileURL(
    resolve(cwd, "database/seeders", target.filePath)
  ).href;
  const module = (await import(moduleUrl)) as Record<string, unknown>;
  const Candidate = module[target.className] ?? module.default;

  if (typeof Candidate !== "function") {
    throw new Error(`Seeder class ${target.className} was not found.`);
  }

  const seeder = new (Candidate as new () => Seeder)();

  if (typeof seeder.run !== "function") {
    throw new Error(`Seeder ${target.className} must expose run().`);
  }

  return seeder;
}

function pascalCase(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join("");
}
