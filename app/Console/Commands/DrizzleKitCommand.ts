import { join } from "node:path";

export type DrizzleKitCommandName = "generate" | "migrate";

export type DrizzleKitRunnerOptions = {
  cwd?: string;
  stderr?: (message: string) => void;
  stdout?: (message: string) => void;
};

export type DrizzleKitRunner = (
  command: DrizzleKitCommandName,
  options?: DrizzleKitRunnerOptions
) => Promise<number>;

export async function runDrizzleKitCommand(
  command: DrizzleKitCommandName,
  options: DrizzleKitRunnerOptions = {}
) {
  const cwd = options.cwd ?? process.cwd();
  const executable = join(cwd, "node_modules/.bin/drizzle-kit");
  const childProcess = Bun.spawn(
    [executable, command, "--config=drizzle.config.ts"],
    {
      cwd,
      stderr: "pipe",
      stdout: "pipe",
    }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(childProcess.stdout).text(),
    new Response(childProcess.stderr).text(),
    childProcess.exited,
  ]);

  writeOutput(stdout, options.stdout);
  writeOutput(stderr, options.stderr);

  return exitCode;
}

function writeOutput(output: string, writer?: (message: string) => void) {
  const normalized = output.trimEnd();

  if (!normalized) {
    return;
  }

  (writer ?? console.log)(normalized);
}
