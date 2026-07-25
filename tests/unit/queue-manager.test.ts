import { describe, expect, it } from "bun:test";

import { MemoryQueue, QueueManager, SyncQueue, normalizeJob } from "../../app/Support/Queue";

describe("normalizeJob", () => {
  it("wraps function jobs", async () => {
    const job = normalizeJob(() => "done");

    expect(job.name).toBe("ClosureJob");
    await expect(Promise.resolve(job.handle())).resolves.toBe("done");
  });
});

describe("SyncQueue", () => {
  it("executes jobs immediately", async () => {
    const queue = new SyncQueue();
    let ran = false;

    await queue.dispatch(() => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(queue.size()).toBe(0);
  });
});

describe("MemoryQueue", () => {
  it("queues jobs until a worker processes them", async () => {
    const queue = new MemoryQueue();
    const calls: string[] = [];

    await queue.push(() => calls.push("first"));
    await queue.push(() => calls.push("second"));

    expect(queue.size()).toBe(2);
    await expect(queue.work({ maxJobs: 1 })).resolves.toEqual({
      failed: 0,
      failedJobs: [],
      processed: 1,
    });
    expect(calls).toEqual(["first"]);
    expect(queue.size()).toBe(1);
  });

  it("retries a failing job until it succeeds", async () => {
    const queue = new MemoryQueue();
    let attempts = 0;

    await queue.push(() => {
      attempts += 1;

      if (attempts < 3) {
        throw new Error("transient");
      }

      return "ok";
    });

    await expect(
      queue.work({ maxAttempts: 3, sleep: async () => {} })
    ).resolves.toEqual({
      failed: 0,
      failedJobs: [],
      processed: 1,
    });
    expect(attempts).toBe(3);
    expect(queue.failedJobs).toEqual([]);
  });

  it("dead-letters a job that exhausts its attempts, keeping the error", async () => {
    const queue = new MemoryQueue();
    let attempts = 0;

    await queue.push(function ImportOrders() {
      attempts += 1;

      throw new Error("upstream unavailable");
    });

    const result = await queue.work({
      maxAttempts: 2,
      sleep: async () => {},
    });

    expect(attempts).toBe(2);
    expect(result).toEqual({
      failed: 1,
      failedJobs: [
        {
          attempts: 2,
          error: "upstream unavailable",
          name: "ImportOrders",
        },
      ],
      processed: 1,
    });
    expect(queue.size()).toBe(0);
    expect(queue.failedJobs).toHaveLength(1);
    expect(queue.failedJobs[0]?.lastError).toBe("upstream unavailable");
  });

  it("does not retry when only one attempt is allowed", async () => {
    const queue = new MemoryQueue();
    let attempts = 0;

    await queue.push(() => {
      attempts += 1;
      throw new Error("boom");
    });

    const result = await queue.work({ maxAttempts: 1, sleep: async () => {} });

    expect(attempts).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("backs off using sleepMs between retries", async () => {
    const queue = new MemoryQueue();
    const waits: number[] = [];
    let attempts = 0;

    await queue.push(() => {
      attempts += 1;

      if (attempts < 2) {
        throw new Error("transient");
      }
    });

    await queue.work({
      maxAttempts: 2,
      sleep: async (ms) => {
        waits.push(ms);
      },
      sleepMs: 250,
    });

    expect(waits).toEqual([250]);
  });

  it("waits instead of spinning when told to keep polling an empty queue", async () => {
    const queue = new MemoryQueue();
    const waits: number[] = [];

    // maxJobs: 1 so the worker exits once the late job arrives; otherwise it
    // would keep polling the drained queue forever.
    const result = await queue.work({
      maxJobs: 1,
      sleep: async (ms) => {
        waits.push(ms);

        if (waits.length === 3) {
          await queue.push(() => "late");
        }
      },
      sleepMs: 5,
      stopWhenEmpty: false,
    });

    expect(waits.length).toBeGreaterThanOrEqual(3);
    expect(waits.every((wait) => wait === 5)).toBe(true);
    expect(result.processed).toBe(1);
  });
});

describe("QueueManager", () => {
  it("resolves configured queue connections", async () => {
    const manager = new QueueManager({
      allowInMemoryInProduction: false,
      defaultConnection: "memory",
      worker: {
        maxAttempts: 3,
        maxJobs: 10,
        sleepMs: 1,
      },
    });

    await manager.push(() => "queued");

    expect(manager.size()).toBe(1);
  });

  it("applies the configured retry policy when working a connection", async () => {
    const manager = new QueueManager({
      allowInMemoryInProduction: false,
      defaultConnection: "memory",
      worker: {
        maxAttempts: 4,
        maxJobs: 10,
        sleepMs: 0,
      },
    });
    let attempts = 0;

    await manager.push(() => {
      attempts += 1;

      if (attempts < 4) {
        throw new Error("transient");
      }
    });

    const result = await manager.work({ sleep: async () => {} });

    expect(attempts).toBe(4);
    expect(result.failed).toBe(0);
    expect(result.processed).toBe(1);
  });
});
