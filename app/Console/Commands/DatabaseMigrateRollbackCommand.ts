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
import { assertProductionCommandAllowed, hasForceFlag } from "./ProductionGuard";

export class DatabaseMigrateRollbackCommand {
  readonly signature = "db:migrate:rollback";
  readonly description =
    "Reset the configured schema as a destructive rollback fallback.";

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
    if (!hasForceFlag(options)) {
      throw new Error(
        "db:migrate:rollback uses a destructive schema reset fallback because SQL migrations do not include down migrations. Re-run with --force to continue."
      );
    }

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
