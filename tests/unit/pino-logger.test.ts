import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildFrameworkErrorLog,
  createPinoErrorLogger,
  logFrameworkError,
  serializeError,
  serializeRequest,
} from "../../app/Support/Logging";

describe("Pino framework logger", () => {
  it("serializes framework error payloads", () => {
    const request = new Request("http://localhost/users?active=1", {
      method: "PATCH",
    });

    expect(
      buildFrameworkErrorLog({
        code: "UNKNOWN",
        error: new TypeError("broken"),
        request,
        status: 500,
      })
    ).toMatchObject({
      code: "UNKNOWN",
      err: {
        message: "broken",
        type: "TypeError",
      },
      event: "framework.error",
      request: {
        method: "PATCH",
        path: "/users",
        query: "?active=1",
        url: "/users?active=1",
      },
      status: 500,
    });
    expect(
      buildFrameworkErrorLog({
        code: "UNKNOWN",
        error: new TypeError("broken"),
        status: 500,
      }).err
    ).not.toHaveProperty("stack");
    expect(
      buildFrameworkErrorLog(
        {
          code: "UNKNOWN",
          error: new TypeError("broken"),
          status: 500,
        },
        {
          includeStack: true,
        }
      ).err
    ).toHaveProperty("stack");
  });

  it("normalizes non-error values and request metadata", () => {
    expect(serializeError("boom")).toEqual({
      message: "boom",
      type: "string",
    });
    expect(serializeRequest(new Request("http://localhost/health"))).toEqual({
      method: "GET",
      path: "/health",
      query: "",
      url: "/health",
    });
    expect(
      serializeRequest(
        new Request("http://localhost/reset?token=secret&page=1")
      )
    ).toEqual({
      method: "GET",
      path: "/reset",
      query: "?token=%5BRedacted%5D&page=1",
      url: "/reset?token=%5BRedacted%5D&page=1",
    });
  });

  it("writes framework errors as Pino JSON lines", async () => {
    const root = await mkdtemp(join(tmpdir(), "patshop-pino-"));
    const errorFile = join(root, "logs/framework-errors.log");
    const logger = createPinoErrorLogger({
      errorFile,
      includeStack: false,
      level: "error",
      name: "test-app",
      redactPaths: ["request.headers.authorization"],
      sync: true,
    });

    try {
      logFrameworkError(
        {
          code: "UNKNOWN",
          error: new Error("disk-write-check"),
          request: new Request("http://localhost/missing"),
          status: 500,
        },
        logger
      );

      const [line] = (await readFile(errorFile, "utf8")).trim().split("\n");
      const entry = JSON.parse(line ?? "{}");

      expect(entry).toMatchObject({
        code: "UNKNOWN",
        event: "framework.error",
        level: 50,
        msg: "Framework error detected.",
        name: "test-app",
        request: {
          method: "GET",
          path: "/missing",
        },
        status: 500,
      });
      expect(entry.err).toMatchObject({
        message: "disk-write-check",
        type: "Error",
      });
    } finally {
      await rm(root, {
        force: true,
        recursive: true,
      });
    }
  });
});
