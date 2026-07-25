import {
  databaseConfig,
  type DatabaseConfig,
} from "../../../config/database";
import {
  resolveMigrationArtifactPaths,
  stageDrizzleMigrationMeta,
  storeDrizzleMigrationMeta,
} from "./DatabaseMigrationArtifacts";
import {
  runDrizzleKitCommand,
  type DrizzleKitRunner,
} from "./DrizzleKitCommand";

export class DatabaseGenerateCommand {
  readonly signature = "db:generate";
  readonly description = "Generate SQL migrations from configured models.";

  constructor(
    private readonly runner: DrizzleKitRunner = runDrizzleKitCommand,
    private readonly config: DatabaseConfig = databaseConfig
  ) {}

  async handle(
    stdout: (message: string) => void = console.log,
    stderr: (message: string) => void = console.error,
    options: { cwd?: string } = {}
  ) {
    const paths = resolveMigrationArtifactPaths(this.config, options.cwd);

    await stageDrizzleMigrationMeta(paths);

    try {
      const exitCode = await this.runner("generate", {
        cwd: options.cwd,
        stderr,
        stdout,
      });

      if (exitCode !== 0) {
        throw new Error(`drizzle-kit generate failed with exit code ${exitCode}.`);
      }
    } finally {
      await storeDrizzleMigrationMeta(paths);
    }
  }
}
