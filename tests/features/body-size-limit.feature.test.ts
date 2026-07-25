import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { BodySizeLimitMiddleware } from "../../app/Http/Middlewares/BodySizeLimitMiddleware";
import { requestConfig } from "../../config/request";

function serve(maxBodyBytes: number) {
  const app = new BodySizeLimitMiddleware({ ...requestConfig, maxBodyBytes })
    .handle(new Elysia())
    .post("/upload", async ({ body }) => ({ received: String(body).length }))
    .listen(0);

  return {
    port: app.server?.port as number,
    stop: () => app.server?.stop(true),
  };
}

describe("body size limit over real HTTP", () => {
  it("accepts a body within the limit", async () => {
    const server = serve(64);

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/upload`, {
        body: "small",
        method: "POST",
      });

      expect(response.status).toBe(200);
    } finally {
      server.stop();
    }
  });

  it("rejects an oversized body", async () => {
    const server = serve(8);

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/upload`, {
        body: "x".repeat(4096),
        method: "POST",
      });

      expect(response.status).toBe(413);
    } finally {
      server.stop();
    }
  });

  it("rejects a streamed body of undeclared length rather than letting it run unbounded", async () => {
    const server = serve(8);

    try {
      // fetch frames a stream body as `transfer-encoding: chunked`, which is
      // the only way to send a body without declaring its size.
      const response = await fetch(`http://127.0.0.1:${server.port}/upload`, {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("x".repeat(4096)));
            controller.close();
          },
        }),
        duplex: "half",
        method: "POST",
      } as RequestInit);

      expect(response.status).toBe(413);
    } finally {
      server.stop();
    }
  });
});
