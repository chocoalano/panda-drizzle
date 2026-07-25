import {
  databaseConfig,
  type DatabaseConfig,
} from "../../../config/database";
import { appConfig } from "../../../config/app";
import {
  cleanupStagedDrizzleMigrationMeta,
  resolveMigrationArtifactPaths,
  stageDrizzleMigrationMeta,
} from "./DatabaseMigrationArtifacts";
import {
  runDrizzleKitCommand,
  type DrizzleKitRunner,
} from "./DrizzleKitCommand";
import {
  assertProductionCommandAllowed,
  type ForceableCommandOptions,
} from "./ProductionGuard";
import { DatabaseSeedCommand } from "./DatabaseSeedCommand";

export type DatabaseMigrateOptions = {
  cwd?: string;
} & ForceableCommandOptions;

export class DatabaseMigrateCommand {
  readonly signature = "db:migrate";
  readonly description = "Run configured SQL migrations.";

  constructor(
    private readonly runner: DrizzleKitRunner = runDrizzleKitCommand,
    private readonly config: DatabaseConfig = databaseConfig,
    private readonly environment = appConfig.env,
    private readonly seedCommand = new DatabaseSeedCommand()
  ) {}

  async handle(
    stdout: (message: string) => void = console.log,
    stderr: (message: string) => void = console.error,
    options: DatabaseMigrateOptions = {}
  ) {
    assertProductionCommandAllowed(this.signature, this.environment, options);

    await runDatabaseMigrations({
      config: this.config,
      cwd: options.cwd,
      runner: this.runner,
      stderr,
      stdout,
    });

    if (hasSeedFlag(options.args)) {
      await this.seedCommand.handle(stdout, stderr, options);
    }
  }
}

export async function runDatabaseMigrations(options: {
  config?: DatabaseConfig;
  cwd?: string;
  runner?: DrizzleKitRunner;
  stderr?: (message: string) => void;
  stdout?: (message: string) => void;
}) {
  const config = options.config ?? databaseConfig;
  const runner = options.runner ?? runDrizzleKitCommand;
  const paths = resolveMigrationArtifactPaths(config, options.cwd);

  await stageDrizzleMigrationMeta(paths);

  try {
    const exitCode = await runner("migrate", {
      cwd: options.cwd,
      stderr: options.stderr,
      stdout: options.stdout,
    });

    if (exitCode !== 0) {
      throw new Error(`drizzle-kit migrate failed with exit code ${exitCode}.`);
    }
  } finally {
    await cleanupStagedDrizzleMigrationMeta(paths);
  }
}

export function hasSeedFlag(args: string[] = []) {
  return args.includes("--seed");
}
