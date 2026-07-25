import { appConfig } from "../../../config/app";
import {
  databaseConfig,
  type DatabaseConfig,
} from "../../../config/database";
import { DatabaseSeedCommand } from "./DatabaseSeedCommand";
import {
  hasSeedFlag,
  runDatabaseMigrations,
  type DatabaseMigrateOptions,
} from "./DatabaseMigrateCommand";
import {
  resetDatabaseSchema,
  type DatabaseResetResult,
  type DatabaseSchemaResetter,
} from "./DatabaseSchemaResetter";
import {
  runDrizzleKitCommand,
  type DrizzleKitRunner,
} from "./DrizzleKitCommand";
import { assertProductionCommandAllowed } from "./ProductionGuard";

export class DatabaseMigrateFreshCommand {
  readonly signature = "db:migrate:fresh";
  readonly description = "Drop all tables and re-run configured SQL migrations.";

  constructor(
    private readonly resetter: DatabaseSchemaResetter = resetDatabaseSchema,
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

    const reset = await this.resetter(this.config, {
      cwd: options.cwd,
    });

    for (const line of formatDatabaseResetResult(reset, "Dropped")) {
      stdout(line);
    }

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

export function formatDatabaseResetResult(
  result: DatabaseResetResult,
  action = "Dropped"
) {
  return [
    `${action} ${result.droppedTables.length} table(s).`,
    ...(result.droppedSchemas.length > 0
      ? [`${action} ${result.droppedSchemas.length} schema(s).`]
      : []),
  ];
}
