import { queue, type QueueManager } from "../../Support/Queue";
import { queueConfig } from "../../../config/queue";

export class QueueWorkCommand {
  readonly signature = "queue:work";
  readonly description = "Process queued jobs for the configured queue connection.";

  constructor(private readonly queueManager: QueueManager = queue) {}

  async handle(
    stdout: (message: string) => void = console.log,
    stderr: (message: string) => void = console.error,
    options: { args?: string[] } = {}
  ) {
    const maxJobs = parseMaxJobs(options.args) ?? queueConfig.worker.maxJobs;
    const result = await this.queueManager.work({
      maxAttempts: parseMaxAttempts(options.args) ?? queueConfig.worker.maxAttempts,
      maxJobs,
    });

    stdout(
      `Processed ${result.processed} queued job(s), ${result.failed} failed.`
    );

    // Without this the cause of a failed job is lost: it was only ever counted.
    for (const failedJob of result.failedJobs ?? []) {
      stderr(
        `Failed job ${failedJob.name} after ${failedJob.attempts} attempt(s): ${failedJob.error}`
      );
    }

    return result;
  }
}

export function parseMaxAttempts(args: string[] = []) {
  return parseIntegerFlag(args, "--max-attempts=");
}

export function parseMaxJobs(args: string[] = []) {
  return parseIntegerFlag(args, "--max-jobs=");
}

function parseIntegerFlag(args: string[], prefix: string) {
  const flag = args.find((arg) => arg.startsWith(prefix));

  if (!flag) {
    return undefined;
  }

  const parsed = Number(flag.split("=").at(1));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
