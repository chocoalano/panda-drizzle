import { describe, expect, it } from "bun:test";

import {
  assertQueueConfiguration,
  normalizeQueueConnection,
  queueConfig,
} from "../../config/queue";

describe("queueConfig", () => {
  it("normalizes supported queue connections", () => {
    expect(normalizeQueueConnection("memory")).toBe("memory");
    expect(normalizeQueueConnection("sync")).toBe("sync");
    expect(normalizeQueueConnection("redis")).toBe("sync");
    expect(queueConfig.worker.maxJobs).toBeGreaterThan(0);
  });

  it("retries failed jobs by default instead of dropping them", () => {
    expect(queueConfig.worker.maxAttempts).toBeGreaterThan(1);
    expect(queueConfig.worker.sleepMs).toBeGreaterThan(0);
  });

  it("rejects in-memory queue drivers in production unless acknowledged", () => {
    expect(() =>
      assertQueueConfiguration(
        {
          ...queueConfig,
          allowInMemoryInProduction: false,
        },
        "production"
      )
    ).toThrow("not durable");
    expect(() =>
      assertQueueConfiguration(
        {
          ...queueConfig,
          allowInMemoryInProduction: true,
        },
        "production"
      )
    ).not.toThrow();
  });
});
