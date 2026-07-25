import {
  queueConfig,
  type QueueConfig,
  type QueueConnectionName,
} from "../../../config/queue";
import {
  jobErrorMessage,
  jobName,
  normalizeJob,
  sleepFor,
  type DispatchableJob,
  type FailedJob,
  type QueueJob,
  type QueuedJob,
  type QueueWorkOptions,
  type QueueWorkResult,
} from "./Job";

export interface QueueConnection {
  dispatch(job: DispatchableJob): Promise<unknown>;
  push(job: DispatchableJob): Promise<QueuedJob>;
  size(): number;
  work(options?: QueueWorkOptions): Promise<QueueWorkResult>;
}

export class SyncQueue implements QueueConnection {
  async dispatch(job: DispatchableJob) {
    return normalizeJob(job).handle();
  }

  async push(job: DispatchableJob) {
    const normalizedJob = normalizeJob(job);

    await normalizedJob.handle();

    return makeQueuedJob(normalizedJob);
  }

  size() {
    return 0;
  }

  // Sync jobs already ran at dispatch time, so there is never pending work.
  async work(): Promise<QueueWorkResult> {
    return {
      failed: 0,
      failedJobs: [],
      processed: 0,
    };
  }
}

export class MemoryQueue implements QueueConnection {
  private readonly pending: QueuedJob[] = [];

  /** Dead letter queue: jobs that exhausted every attempt, with their error. */
  readonly failedJobs: QueuedJob[] = [];

  async dispatch(job: DispatchableJob) {
    return this.push(job);
  }

  async push(job: DispatchableJob) {
    const queued = makeQueuedJob(normalizeJob(job));

    this.pending.push(queued);

    return queued;
  }

  size() {
    return this.pending.length;
  }

  async work(options: QueueWorkOptions = {}): Promise<QueueWorkResult> {
    const maxJobs = options.maxJobs ?? this.pending.length;
    const maxAttempts = Math.max(1, options.maxAttempts ?? 1);
    const sleepMs = options.sleepMs ?? 0;
    const sleep = options.sleep ?? sleepFor;
    const stopWhenEmpty = options.stopWhenEmpty ?? true;
    const failedJobs: FailedJob[] = [];
    let processed = 0;
    let failed = 0;

    while (processed < maxJobs) {
      const queued = this.pending.shift();

      if (!queued) {
        if (stopWhenEmpty) {
          break;
        }

        // Idle wait, so a long-lived worker does not spin the CPU.
        await sleep(sleepMs);
        continue;
      }

      queued.attempts += 1;

      try {
        await queued.job.handle();
        processed += 1;
      } catch (error) {
        queued.lastError = jobErrorMessage(error);

        if (queued.attempts < maxAttempts) {
          // Retry: requeue behind the other work and back off first.
          this.pending.push(queued);
          await sleep(sleepMs);
          continue;
        }

        this.failedJobs.push(queued);
        failedJobs.push({
          attempts: queued.attempts,
          error: queued.lastError,
          name: queued.name,
        });
        failed += 1;
        processed += 1;
      }
    }

    return {
      failed,
      failedJobs,
      processed,
    };
  }
}

export class QueueManager {
  private readonly connections = new Map<QueueConnectionName, QueueConnection>();

  constructor(private readonly config: QueueConfig = queueConfig) {}

  connection(name: QueueConnectionName = this.config.defaultConnection) {
    if (!this.connections.has(name)) {
      this.connections.set(name, this.makeConnection(name));
    }

    return this.connections.get(name) as QueueConnection;
  }

  dispatch(job: DispatchableJob, connection?: QueueConnectionName) {
    return this.connection(connection).dispatch(job);
  }

  push(job: DispatchableJob, connection?: QueueConnectionName) {
    return this.connection(connection).push(job);
  }

  work(options: QueueWorkOptions = {}, connection?: QueueConnectionName) {
    return this.connection(connection).work({
      ...options,
      maxAttempts: options.maxAttempts ?? this.config.worker.maxAttempts,
      maxJobs: options.maxJobs ?? this.config.worker.maxJobs,
      sleepMs: options.sleepMs ?? this.config.worker.sleepMs,
    });
  }

  size(connection?: QueueConnectionName) {
    return this.connection(connection).size();
  }

  private makeConnection(name: QueueConnectionName) {
    return name === "memory" ? new MemoryQueue() : new SyncQueue();
  }
}

export const queue = new QueueManager();

export function dispatch(job: DispatchableJob, connection?: QueueConnectionName) {
  return queue.dispatch(job, connection);
}

export function makeQueuedJob(job: QueueJob): QueuedJob {
  return {
    attempts: 0,
    job,
    name: jobName(job),
  };
}
