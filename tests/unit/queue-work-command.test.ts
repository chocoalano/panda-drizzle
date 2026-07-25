import { describe, expect, it } from "bun:test";

import {
  QueueWorkCommand,
  parseMaxAttempts,
  parseMaxJobs,
} from "../../app/Console/Commands/QueueWorkCommand";
import type { QueueManager } from "../../app/Support/Queue";

function fakeQueueManager(
  work: QueueManager["work"]
): QueueManager {
  return { work } as unknown as QueueManager;
}

describe("parseMaxJobs", () => {
  it("parses max job flags", () => {
    expect(parseMaxJobs(["--max-jobs=5"])).toBe(5);
    expect(parseMaxJobs(["--max-jobs=bad"])).toBeUndefined();
  });
});

describe("parseMaxAttempts", () => {
  it("parses max attempt flags", () => {
    expect(parseMaxAttempts(["--max-attempts=5"])).toBe(5);
    expect(parseMaxAttempts(["--max-attempts=bad"])).toBeUndefined();
    expect(parseMaxAttempts(["--max-jobs=5"])).toBeUndefined();
  });
});

describe("QueueWorkCommand", () => {
  it("processes queued jobs through the queue manager", async () => {
    const output: string[] = [];
    const command = new QueueWorkCommand(
      fakeQueueManager(async () => ({
        failed: 0,
        failedJobs: [],
        processed: 3,
      }))
    );

    await command.handle((message) => output.push(message), console.error, {
      args: ["--max-jobs=3"],
    });

    expect(output).toEqual(["Processed 3 queued job(s), 0 failed."]);
  });

  it("reports why each failed job failed instead of only counting it", async () => {
    const output: string[] = [];
    const errors: string[] = [];
    const command = new QueueWorkCommand(
      fakeQueueManager(async () => ({
        failed: 1,
        failedJobs: [
          {
            attempts: 3,
            error: "upstream unavailable",
            name: "ImportOrders",
          },
        ],
        processed: 3,
      }))
    );

    await command.handle(
      (message) => output.push(message),
      (message) => errors.push(message),
      { args: ["--max-jobs=3"] }
    );

    expect(output).toEqual(["Processed 3 queued job(s), 1 failed."]);
    expect(errors).toEqual([
      "Failed job ImportOrders after 3 attempt(s): upstream unavailable",
    ]);
  });

  it("passes the retry policy through to the queue manager", async () => {
    const received: unknown[] = [];
    const command = new QueueWorkCommand(
      fakeQueueManager(async (options) => {
        received.push(options);

        return { failed: 0, failedJobs: [], processed: 0 };
      })
    );

    await command.handle(() => {}, console.error, {
      args: ["--max-jobs=7", "--max-attempts=5"],
    });

    expect(received[0]).toMatchObject({
      maxAttempts: 5,
      maxJobs: 7,
    });
  });
});
