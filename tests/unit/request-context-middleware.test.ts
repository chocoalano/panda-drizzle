import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import {
  isValidRequestId,
  RequestContextMiddleware,
  resolveRequestId,
} from "../../app/Http/Middlewares/RequestContextMiddleware";
import { appConfig } from "../../config/app";

describe("resolveRequestId", () => {
  it("uses a non-empty incoming request id", () => {
    expect(resolveRequestId(" incoming-id ", () => "generated-id")).toBe(
      "incoming-id"
    );
  });

  it("rejects unsafe incoming request ids", () => {
    expect(resolveRequestId("bad header", () => "generated-id")).toBe(
      "generated-id"
    );
    expect(resolveRequestId("x".repeat(129), () => "generated-id")).toBe(
      "generated-id"
    );
  });

  it("generates a request id when none was provided", () => {
    expect(resolveRequestId(null, () => "generated-id")).toBe("generated-id");
    expect(resolveRequestId(" ", () => "generated-id")).toBe("generated-id");
  });
});

describe("isValidRequestId", () => {
  it("allows compact request ids only", () => {
    expect(isValidRequestId("trace-1:abc_2")).toBe(true);
    expect(isValidRequestId("trace id")).toBe(false);
  });
});

// The middleware's id generator defaults to `crypto.randomUUID`, so the fake
// has to produce a uuid-shaped id to match that contract.
const generatedRequestId = "11111111-2222-3333-4444-555555555555";

describe("RequestContextMiddleware", () => {
  it("adds application and request context headers", async () => {
    const app = new RequestContextMiddleware(() => generatedRequestId)
      .handle(new Elysia())
      .get("/middleware-check", () => ({ ok: true }));
    const response = await app.handle(
      new Request("http://localhost/middleware-check")
    );

    expect(response.headers.get(appConfig.headers.appName)).toBe(appConfig.name);
    expect(response.headers.get(appConfig.headers.requestId)).toBe(
      generatedRequestId
    );
  });
});
