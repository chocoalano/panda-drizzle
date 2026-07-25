export type QueueJobResult = unknown;

export type QueueJob = {
  name?: string;
  handle(): QueueJobResult | Promise<QueueJobResult>;
};

export type QueueJobHandler = () => QueueJobResult | Promise<QueueJobResult>;

export type DispatchableJob = QueueJob | QueueJobHandler;

export type QueuedJob = {
  attempts: number;
  job: QueueJob;
  lastError?: string;
  name: string;
};

export type FailedJob = {
  attempts: number;
  error: string;
  name: string;
};

export type QueueWorkOptions = {
  /** Total attempts allowed per job before it is dead-lettered. */
  maxAttempts?: number;
  maxJobs?: number;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Idle wait between polls, and the backoff applied before a retry. */
  sleepMs?: number;
  /** When false the worker keeps polling an empty queue until maxJobs is hit. */
  stopWhenEmpty?: boolean;
};

export type QueueWorkResult = {
  failed: number;
  failedJobs: FailedJob[];
  processed: number;
};

export function jobErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function sleepFor(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function normalizeJob(job: DispatchableJob): QueueJob {
  if (typeof job === "function") {
    return {
      name: job.name || "ClosureJob",
      handle: job,
    };
  }

  return job;
}

export function jobName(job: QueueJob) {
  return job.name || job.constructor.name || "AnonymousJob";
}
