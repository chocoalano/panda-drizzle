import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import {
  BodySizeLimitMiddleware,
  hasRequestBody,
  hasRequestBodySemantics,
  isChunkedTransferEncoding,
  parseContentLength,
} from "../../app/Http/Middlewares/BodySizeLimitMiddleware";
import { requestConfig } from "../../config/request";

describe("parseContentLength", () => {
  it("parses valid content length values", () => {
    expect(parseContentLength("10")).toBe(10);
    expect(parseContentLength("invalid")).toBeUndefined();
    expect(parseContentLength("10.5")).toBeUndefined();
    expect(parseContentLength(null)).toBeUndefined();
    expect(hasRequestBodySemantics("POST")).toBe(true);
    expect(hasRequestBodySemantics("GET")).toBe(false);
    expect(isChunkedTransferEncoding("gzip, chunked")).toBe(true);
  });
});

describe("hasRequestBody", () => {
  it("detects a streamed body with no declared length", () => {
    expect(
      hasRequestBody(
        new Request("http://localhost/upload", {
          body: "payload",
          method: "POST",
        })
      )
    ).toBe(true);
  });

  it("reports no body for a bare request", () => {
    expect(
      hasRequestBody(new Request("http://localhost/upload", { method: "POST" }))
    ).toBe(false);
  });
});

describe("requestConfig", () => {
  it("requires Content-Length by default so bodies cannot go unbounded", () => {
    expect(requestConfig.requireContentLength).toBe(true);
    expect(requestConfig.rejectChunkedBodies).toBe(true);
  });
});

describe("BodySizeLimitMiddleware", () => {
  it("rejects a body that declares no length by default", async () => {
    const app = new BodySizeLimitMiddleware(requestConfig)
      .handle(new Elysia())
      .post("/upload", () => ({ ok: true }));

    const request = new Request("http://localhost/upload", {
      body: "payload",
      method: "POST",
    });

    request.headers.delete("content-length");
    request.headers.delete("content-type");

    const response = await app.handle(request);

    expect(response.status).toBe(411);
    await expect(response.json()).resolves.toEqual({
      message: "Content-Length is required.",
    });
  });

  it("allows a declared body within the limit", async () => {
    const app = new BodySizeLimitMiddleware(requestConfig)
      .handle(new Elysia())
      .post("/upload", () => ({ ok: true }));
    const body = JSON.stringify({ name: "ok" });

    const response = await app.handle(
      new Request("http://localhost/upload", {
        body,
        headers: {
          // Bun's HTTP server sets this from the wire framing; an in-process
          // Request has to declare it explicitly.
          "content-length": String(new TextEncoder().encode(body).byteLength),
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
  });

  it("does not require a length for bodyless GET requests", async () => {
    const app = new BodySizeLimitMiddleware(requestConfig)
      .handle(new Elysia())
      .get("/health", () => ({ ok: true }));

    expect(
      (await app.handle(new Request("http://localhost/health"))).status
    ).toBe(200);
  });

  it("rejects requests above the configured body size", async () => {
    const app = new BodySizeLimitMiddleware({
      maxBodyBytes: 4,
      rejectChunkedBodies: true,
      rejectInvalidContentLength: true,
      requireContentLength: false,
    })
      .handle(new Elysia())
      .post("/upload", () => ({ ok: true }));

    const response = await app.handle(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: {
          "content-length": "5",
        },
      })
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      message: "Request body is too large.",
    });
  });

  it("rejects invalid or chunked request body headers", async () => {
    const app = new BodySizeLimitMiddleware({
      maxBodyBytes: 1024,
      rejectChunkedBodies: true,
      rejectInvalidContentLength: true,
      requireContentLength: false,
    })
      .handle(new Elysia())
      .post("/upload", () => ({ ok: true }));

    expect(
      (
        await app.handle(
          new Request("http://localhost/upload", {
            method: "POST",
            headers: {
              "content-length": "bad",
            },
          })
        )
      ).status
    ).toBe(400);
    expect(
      (
        await app.handle(
          new Request("http://localhost/upload", {
            method: "POST",
            headers: {
              "transfer-encoding": "chunked",
            },
          })
        )
      ).status
    ).toBe(413);
  });
});
