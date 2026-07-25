import {
  generateArtifact,
  generatorCommands,
  generatorDefinitions,
  generatorKindFromCommand,
  parseGeneratorArgs,
  type GeneratorKind,
} from "./generator";
import { registerConsoleCommands } from "../../bootstrap/console";

export type ConsoleCommand = {
  readonly signature: string;
  readonly description?: string;
  handle(
    stdout: (message: string) => void,
    stderr: (message: string) => void,
    options: { args?: string[]; cwd?: string; force?: boolean }
  ): Promise<unknown> | unknown;
};

export type ConsoleCommandConstructor = new () => ConsoleCommand;

export type ConsoleIO = {
  commands?: ConsoleCommand[];
  cwd?: string;
  doctorCommand?: ConsoleCommand;
  generateCommand?: ConsoleCommand;
  migrateFreshCommand?: ConsoleCommand;
  migrateCommand?: ConsoleCommand;
  migrateResetCommand?: ConsoleCommand;
  migrateRollbackCommand?: ConsoleCommand;
  queueWorkCommand?: ConsoleCommand;
  seedCommand?: ConsoleCommand;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

export type ConsoleResult = {
  exitCode: number;
};

export async function handleConsole(
  args: string[],
  io: ConsoleIO = {}
): Promise<ConsoleResult> {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;
  const command = args[0] ?? "list";
  const runtimeCommands = resolveConsoleCommands(io);

  if (command === "list" || command === "--help" || command === "-h") {
    stdout(renderCommandList(runtimeCommands));

    return {
      exitCode: 0,
    };
  }

  const runtimeCommand = runtimeCommands.find(
    (candidate) => candidate.signature === command
  );

  if (runtimeCommand) {
    return handleRuntimeCommand(runtimeCommand, stdout, stderr, {
      args: args.slice(1),
      cwd: io.cwd,
      force: args.includes("--force") || args.includes("--yes"),
    });
  }

  const kind = generatorKindFromCommand(command);

  if (!kind) {
    stderr(`Unknown command: ${command}`);
    stdout(renderCommandList(runtimeCommands));

    return {
      exitCode: 1,
    };
  }

  return handleGeneratorCommand(kind, args.slice(1), io);
}

/**
 * Signatures registered in `bootstrap/console.ts` but not documented above are
 * appended, so a `make:command` artifact shows up in `bun panda list` as soon
 * as it is registered.
 */
export function renderCommandList(commands: ConsoleCommand[] = []) {
  const documented = [
    "  doctor",
    "  db:generate",
    "  db:migrate",
    "  db:migrate --seed",
    "  db:migrate:fresh [--seed]",
    "  db:migrate:rollback",
    "  db:migrate:reset",
    "  db:seed",
    "  db:seed [--class=SeederName|--file=SeederName]",
    "  queue:work [--max-jobs=100] [--max-attempts=3]",
  ];
  const registered = commands
    .filter(
      (command) =>
        !documented.some((line) => line.trim().split(" ")[0] === command.signature)
    )
    .map((command) =>
      command.description
        ? `  ${command.signature} - ${command.description}`
        : `  ${command.signature}`
    );

  return [
    "Available commands:",
    ...documented,
    ...registered,
    ...generatorCommands.map((command) => `  ${command} <Name> [--force]`),
    "",
    "Test options:",
    "  make:test <Name> [--unit|--feature|--integration] [--force]",
  ].join("\n");
}

/**
 * Explicit `io` overrides win over the registry so tests can inject fakes.
 */
export function resolveConsoleCommands(io: ConsoleIO = {}): ConsoleCommand[] {
  const overrides = [
    io.doctorCommand,
    io.generateCommand,
    io.migrateFreshCommand,
    io.migrateCommand,
    io.migrateResetCommand,
    io.migrateRollbackCommand,
    io.queueWorkCommand,
    io.seedCommand,
  ].filter((command): command is ConsoleCommand => Boolean(command));

  return [...overrides, ...(io.commands ?? registerConsoleCommands())];
}

async function handleRuntimeCommand(
  runtimeCommand: ConsoleCommand,
  stdout: (message: string) => void,
  stderr: (message: string) => void,
  options: { args?: string[]; cwd?: string; force?: boolean }
) {
  try {
    await runtimeCommand.handle(stdout, stderr, options);

    return {
      exitCode: 0,
    };
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unable to run command.");

    return {
      exitCode: 1,
    };
  }
}

async function handleGeneratorCommand(
  kind: GeneratorKind,
  args: string[],
  io: ConsoleIO
) {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;
  const parsed = parseGeneratorArgs(args);

  if (!parsed.name) {
    stderr(`Missing name for ${generatorDefinitions[kind].command}.`);

    return {
      exitCode: 1,
    };
  }

  try {
    const artifact = await generateArtifact(kind, parsed.name, {
      cwd: io.cwd,
      force: parsed.force,
      testSuite: parsed.testSuite,
    });

    stdout(`Created ${artifact.filePath}`);

    return {
      exitCode: 0,
    };
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unable to generate file.");

    return {
      exitCode: 1,
    };
  }
}
