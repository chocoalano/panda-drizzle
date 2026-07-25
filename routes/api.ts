import { Elysia, t } from "elysia";
import { randomUUID } from "node:crypto";

import { makeHealthController } from "../app/Http/Controllers/HealthController";
import { HealthCheckRequest } from "../app/Http/Requests/HealthCheckRequest";
import {
  broadcaster,
  handleRealtimeMessage,
  isRealtimeAuthTokenValid,
  parseRealtimeMessage,
  type RealtimeConnection,
} from "../app/Support/Broadcasting";
import { broadcastingConfig } from "../config/broadcasting";

const healthController = makeHealthController();
const realtimeSocketIds = new WeakMap<object, string>();
const authorizedRealtimeSocketIds = new Set<string>();

export const apiRoutes = new Elysia({ name: "api-routes" })
  .get("/health", ({ request, set }) => {
    const response = healthController.show(new HealthCheckRequest(request));

    set.status = response.status;

    return response.body;
  })
  .ws(broadcastingConfig.websocket.path, {
    query: t.Object({
      [broadcastingConfig.auth.queryParameter]: t.Optional(t.String()),
    }),
    body: t.Object({
      channel: t.Optional(t.String()),
      event: t.Union([
        t.Literal("ping"),
        t.Literal("subscribe"),
        t.Literal("unsubscribe"),
      ]),
    }),
    maxPayloadLength: broadcastingConfig.websocket.maxPayloadLength,
    idleTimeout: broadcastingConfig.websocket.idleTimeout,
    backpressureLimit: broadcastingConfig.websocket.backpressureLimit,
    open(ws) {
      const connection = realtimeConnectionFromSocket(ws);

      if (!isRealtimeSocketAuthorized(ws)) {
        sendRealtimeError(ws, "Unauthorized.");
        ws.close(4401, "Unauthorized");

        return;
      }

      authorizedRealtimeSocketIds.add(connection.id);
      broadcaster.realtime().connect(connection);
    },
    message(ws, message) {
      const connection = realtimeConnectionFromSocket(ws);

      if (!authorizedRealtimeSocketIds.has(connection.id)) {
        sendRealtimeError(ws, "Unauthorized.");
        ws.close(4401, "Unauthorized");

        return;
      }

      const parsed = parseRealtimeMessage(message);

      if (!parsed) {
        sendRealtimeError(ws, "Invalid realtime message.");

        return;
      }

      handleRealtimeMessage(
        broadcaster.realtime(),
        connection,
        parsed,
        broadcastingConfig.channels
      );
    },
    close(ws) {
      const connection = realtimeConnectionFromSocket(ws);

      authorizedRealtimeSocketIds.delete(connection.id);
      broadcaster.realtime().disconnect(connection.id);
    },
  });

function realtimeConnectionFromSocket(ws: { id?: string; send(value: string): void }): RealtimeConnection {
  return {
    id: stableRealtimeSocketId(ws),
    send: (payload) => ws.send(payload),
  };
}

function stableRealtimeSocketId(ws: { id?: string }) {
  if (ws.id) {
    return ws.id;
  }

  const socket = ws as object;
  const existing = realtimeSocketIds.get(socket);

  if (existing) {
    return existing;
  }

  const id = randomUUID();

  realtimeSocketIds.set(socket, id);

  return id;
}

function isRealtimeSocketAuthorized(ws: unknown) {
  return isRealtimeAuthTokenValid(realtimeAuthTokenFromSocket(ws));
}

function realtimeAuthTokenFromSocket(ws: unknown) {
  const query = (ws as { data?: { query?: Record<string, unknown> } }).data?.query;
  const token = query?.[broadcastingConfig.auth.queryParameter];

  return typeof token === "string" ? token : undefined;
}

function sendRealtimeError(ws: { send(value: string): void }, message: string) {
  ws.send(
    JSON.stringify({
      event: "error",
      message,
    })
  );
}
