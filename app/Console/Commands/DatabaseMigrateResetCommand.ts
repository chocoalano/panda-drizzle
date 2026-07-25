import { appConfig } from "../../../config/app";
import {
  databaseConfig,
  type DatabaseConfig,
} from "../../../config/database";
import { formatDatabaseResetResult } from "./DatabaseMigrateFreshCommand";
import type { DatabaseMigrateOptions } from "./DatabaseMigrateCommand";
import {
  resetDatabaseSchema,
  type DatabaseSchemaResetter,
} from "./DatabaseSchemaResetter";
import { assertProductionCommandAllowed } from "./ProductionGuard";

export class DatabaseMigrateResetCommand {
  readonly signature = "db:migrate:reset";
  readonly description = "Reset the configured database schema.";

  constructor(
    private readonly resetter: DatabaseSchemaResetter = resetDatabaseSchema,
    private readonly config: DatabaseConfig = databaseConfig,
    private readonly environment = appConfig.env
  ) {}

  async handle(
    stdout: (message: string) => void = console.log,
    _stderr: (message: string) => void = console.error,
    options: DatabaseMigrateOptions = {}
  ) {
    assertProductionCommandAllowed(this.signature, this.environment, options);

    const result = await this.resetter(this.config, {
      cwd: options.cwd,
    });

    for (const line of formatDatabaseResetResult(result, "Dropped")) {
      stdout(line);
    }

    return result;
  }
}
