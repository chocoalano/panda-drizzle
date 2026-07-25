import { describe, expect, it } from "bun:test";

import {
  loggerConfig,
  normalizeLoggerLevel,
  parseLogRedactions,
  resolveLogFile,
} from "../../config/logger";

describe("loggerConfig", () => {
  it("points framework errors at a Pino JSON log file", () => {
    expect(loggerConfig.errorFile).toContain("storage/logs/framework-errors.log");
    expect(loggerConfig.level).toBe("error");
    expect(loggerConfig.redactPaths).toContain("request.headers.authorization");
    expect(loggerConfig.sync).toBe(true);
    expect(typeof loggerConfig.includeStack).toBe("boolean");
  });

  it("normalizes supported logger levels", () => {
    expect(normalizeLoggerLevel("DEBUG")).toBe("debug");
    expect(normalizeLoggerLevel("fatal")).toBe("error");
    expect(normalizeLoggerLevel("silent")).toBe("error");
  });

  it("normalizes log files and redaction paths", () => {
    expect(resolveLogFile("storage/logs/app.log")).toContain(
      "storage/logs/app.log"
    );
    expect(parseLogRedactions("a.b, c.d")).toEqual(["a.b", "c.d"]);
    expect(parseLogRedactions("")).toContain("request.headers.cookie");
  });
});
