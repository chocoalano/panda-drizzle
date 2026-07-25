import { describe, expect, it } from "bun:test";
import { createServer } from "node:net";

import { broadcaster } from "../../app/Support/Broadcasting";
import { CorsMiddleware } from "../../app/Http/Middlewares/CorsMiddleware";
import type { FrameworkLogger } from "../../app/Support/Logging";
import { createApp } from "../../bootstrap/app";
import { middleware } from "../../bootstrap/middleware";
import { appConfig } from "../../config/app";
import { broadcastingConfig } from "../../config/broadcasting";
import { buildCorsConfig } from "../../config/cors";

describe("app router integration", () => {
  it("mounts API routes from routes/api.ts on the composed app", async () => {
    const app = createApp();
    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
  });

  it("applies global middleware to routed responses", async () => {
    const app = createApp();
    const response = await app.handle(
      new Request("http://localhost/health", {
        headers: {
          "x-request-id": "test-request-id",
        },
      })
    );

    expect(response.headers.get(appConfig.headers.appName)).toBe(appConfig.name);
    expect(response.headers.get(appConfig.headers.requestId)).toBe(
      "test-request-id"
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("allows a whitelisted origin through the global CORS middleware", async () => {
    const app = createApp({
      middleware: middlewareWithCorsOrigin("http://localhost:3000"),
    });
    const response = await app.handle(
      new Request("http://localhost/health", {
        headers: {
          origin: "http://localhost:3000",
        },
      })
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000"
    );
    expect(response.headers.get("access-control-expose-headers")).toContain(
      appConfig.headers.requestId
    );
  });

  it("does not grant CORS access to an origin outside the whitelist", async () => {
    const app = createApp({
      middleware: middlewareWithCorsOrigin("http://localhost:3000"),
    });
    const response = await app.handle(
      new Request("http://localhost/health", {
        headers: {
          origin: "https://evil.test",
        },
      })
    );

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects a preflight from an origin outside the whitelist", async () => {
    const app = createApp({
      middleware: middlewareWithCorsOrigin("http://localhost:3000"),
    });
    const response = await app.handle(
      new Request("http://localhost/health", {
        headers: {
          "access-control-request-method": "POST",
          origin: "https://evil.test",
        },
        method: "OPTIONS",
      })
    );

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns 404 for unknown routes", async () => {
    const app = createApp({
      logger: makeLogger(),
    });
    const response = await app.handle(new Request("http://localhost/missing"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      message: "Route not found",
    });
  });

  it("writes framework route errors to the configured logger", async () => {
    const entries: Array<{
      message?: string;
      payload: Record<string, unknown>;
    }> = [];
    const app = createApp({
      logger: makeLogger(entries),
    });

    const response = await app.handle(new Request("http://localhost/missing"));

    expect(response.status).toBe(404);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.payload).toMatchObject({
      code: "NOT_FOUND",
      event: "framework.error",
      request: {
        method: "GET",
        path: "/missing",
      },
      status: 404,
    });
  });

  it("broadcasts realtime messages over the configured WebSocket endpoint", async () => {
    const port = await availablePort();
    const app = createApp().listen(port);

    const socket = new WebSocket(`ws://127.0.0.1:${port}/broadcasting`);
    const channel = `orders.${crypto.randomUUID()}`;

    try {
      await waitForSocketOpen(socket);

      socket.send(
        JSON.stringify({
          channel,
          event: "subscribe",
        })
      );

      await expect(waitForSocketJson(socket)).resolves.toMatchObject({
        channel,
        event: "subscribed",
      });

      await broadcaster.broadcast({
        channel,
        data: {
          id: 1,
        },
        event: "OrderUpdated",
      });

      await expect(waitForSocketJson(socket)).resolves.toMatchObject({
        channel,
        data: {
          id: 1,
        },
        event: "OrderUpdated",
      });
    } finally {
      socket.close();
      app.server?.stop(true);
    }
  });

  it("rejects realtime WebSocket connections without the configured token", async () => {
    const originalAuth = { ...broadcastingConfig.auth };
    const port = await availablePort();

    broadcastingConfig.auth.required = true;
    broadcastingConfig.auth.token = "secret";

    const app = createApp().listen(port);
    const socket = new WebSocket(`ws://127.0.0.1:${port}/broadcasting`);

    try {
      await waitForSocketOpen(socket);

      await expect(waitForSocketJson(socket)).resolves.toMatchObject({
        event: "error",
        message: "Unauthorized.",
      });
    } finally {
      Object.assign(broadcastingConfig.auth, originalAuth);
      socket.close();
      app.server?.stop(true);
    }
  });
});

/**
 * Pins the CORS whitelist for the test rather than inheriting CORS_ORIGIN from
 * the ambient environment, which may be `*` on a developer machine.
 */
function middlewareWithCorsOrigin(origin: string) {
  const corsMiddleware = new CorsMiddleware(buildCorsConfig({ origin }));

  return middleware.map((registered) =>
    registered instanceof CorsMiddleware ? corsMiddleware : registered
  );
}

function makeLogger(
  entries: Array<{
    message?: string;
    payload: Record<string, unknown>;
  }> = []
): FrameworkLogger {
  return {
    error(payload, message) {
      entries.push({
        message,
        payload: payload as Record<string, unknown>,
      });
    },
    flush() {},
  };
}

function availablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to resolve an available test port."));

        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);

          return;
        }

        resolve(address.port);
      });
    });
  });
}

function waitForSocketOpen(socket: WebSocket, timeoutMs = 1000) {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while opening WebSocket."));
    }, timeoutMs);
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("WebSocket failed to open."));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onError);
  });
}

function waitForSocketJson(socket: WebSocket, timeoutMs = 1000) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while waiting for WebSocket message."));
    }, timeoutMs);
    const onMessage = (event: MessageEvent) => {
      cleanup();
      resolve(JSON.parse(String(event.data)) as Record<string, unknown>);
    };
    const onError = () => {
      cleanup();
      reject(new Error("WebSocket message listener failed."));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("error", onError);
    };

    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onError);
  });
}
