import { DatabaseGenerateCommand } from "../app/Console/Commands/DatabaseGenerateCommand";
import { DatabaseMigrateCommand } from "../app/Console/Commands/DatabaseMigrateCommand";
import { DatabaseMigrateFreshCommand } from "../app/Console/Commands/DatabaseMigrateFreshCommand";
import { DatabaseMigrateResetCommand } from "../app/Console/Commands/DatabaseMigrateResetCommand";
import { DatabaseMigrateRollbackCommand } from "../app/Console/Commands/DatabaseMigrateRollbackCommand";
import { DatabaseSeedCommand } from "../app/Console/Commands/DatabaseSeedCommand";
import { DoctorCommand } from "../app/Console/Commands/DoctorCommand";
import { QueueWorkCommand } from "../app/Console/Commands/QueueWorkCommand";
import type { ConsoleCommand, ConsoleCommandConstructor } from "../app/Console/Kernel";

/**
 * Registry of console commands. `make:command` scaffolds a class into
 * `app/Console/Commands`; add it here to make `bun panda <signature>` find it.
 */
export const consoleCommands: ConsoleCommandConstructor[] = [
  DatabaseGenerateCommand,
  DatabaseMigrateCommand,
  DatabaseMigrateFreshCommand,
  DatabaseMigrateResetCommand,
  DatabaseMigrateRollbackCommand,
  DatabaseSeedCommand,
  DoctorCommand,
  QueueWorkCommand,
];

export function registerConsoleCommands(
  commandConstructors: ConsoleCommandConstructor[] = consoleCommands
): ConsoleCommand[] {
  const commands = commandConstructors.map((Command) => new Command());

  assertUniqueSignatures(commands);

  return commands;
}

export function assertUniqueSignatures(commands: ConsoleCommand[]) {
  const seen = new Set<string>();

  for (const command of commands) {
    if (seen.has(command.signature)) {
      throw new Error(
        `Duplicate console command signature: ${command.signature}`
      );
    }

    seen.add(command.signature);
  }

  return commands;
}
