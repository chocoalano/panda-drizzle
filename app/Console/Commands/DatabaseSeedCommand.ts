import {
  runSeeders,
  type DatabaseSeederResult,
  type SeederRunResult,
} from "../../Support/Seeders/runner";
import { appConfig } from "../../../config/app";
import {
  assertProductionCommandAllowed,
  type ForceableCommandOptions,
} from "./ProductionGuard";

export type DatabaseSeederRunner = typeof runSeeders;

export class DatabaseSeedCommand {
  readonly signature = "db:seed";
  readonly description = "Seed the configured database.";

  constructor(
    private readonly runner: DatabaseSeederRunner = runSeeders,
    private readonly environment = appConfig.env
  ) {}

  async handle(
    stdout: (message: string) => void = console.log,
    _stderr: (message: string) => void = console.error,
    options: ForceableCommandOptions & { cwd?: string } = {}
  ) {
    assertProductionCommandAllowed(this.signature, this.environment, options);

    const result = await this.runner({
      cwd: options.cwd,
      target: parseSeederTarget(options.args),
    });

    for (const line of formatDatabaseSeederResult(result)) {
      stdout(line);
    }

    return result;
  }
}

export function formatDatabaseSeederResult(result: SeederRunResult) {
  if (isTargetSeederResult(result)) {
    return [
      `Seeded ${result.seeder}.`,
      `Seeder result: ${String(result.result)}.`,
      `Faker seed ${result.faker.seed} (${result.faker.locale}, ${result.faker.refDate}).`,
    ];
  }

  return [
    `Seeded ${result.systemSettings} system setting record(s).`,
    `Faker seed ${result.faker.seed} (${result.faker.locale}, ${result.faker.refDate}).`,
  ];
}

export function parseSeederTarget(args: string[] = []) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    for (const option of ["--class", "--seeder", "--file"]) {
      if (arg === option) {
        return args[index + 1];
      }

      if (arg.startsWith(`${option}=`)) {
        return arg.slice(option.length + 1);
      }
    }

    if (!arg.startsWith("-")) {
      return arg;
    }
  }

  return undefined;
}

function isTargetSeederResult(
  result: SeederRunResult
): result is Exclude<SeederRunResult, DatabaseSeederResult> {
  return "seeder" in result;
}
