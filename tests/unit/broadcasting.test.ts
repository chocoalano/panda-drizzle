import { describe, expect, it } from "bun:test";

import {
  BroadcastManager,
  RealtimeBroadcaster,
  handleRealtimeMessage,
  isRealtimeAuthTokenValid,
  isValidRealtimeChannel,
  normalizeBroadcastPayload,
  parseRealtimeMessage,
} from "../../app/Support/Broadcasting";

describe("RealtimeBroadcaster", () => {
  it("subscribes connections and broadcasts payloads", async () => {
    const messages: string[] = [];
    const broadcaster = new RealtimeBroadcaster();

    broadcaster.connect({
      id: "socket-1",
      send: (payload) => messages.push(payload),
    });
    broadcaster.subscribe("socket-1", "orders");

    await broadcaster.broadcast({
      channel: "orders",
      data: {
        id: 1,
      },
      event: "OrderUpdated",
    });

    expect(JSON.parse(messages[0] ?? "{}")).toMatchObject({
      channel: "orders",
      data: {
        id: 1,
      },
      event: "OrderUpdated",
    });
  });
});

describe("realtime message helpers", () => {
  it("parses and handles client control messages", () => {
    const messages: string[] = [];
    const broadcaster = new RealtimeBroadcaster();
    const connection = {
      id: "socket-1",
      send: (payload: string) => messages.push(payload),
    };

    broadcaster.connect(connection);

    const parsed = parseRealtimeMessage({
      channel: "orders",
      event: "subscribe",
    });

    expect(parsed).toEqual({
      channel: "orders",
      event: "subscribe",
    });

    handleRealtimeMessage(broadcaster, connection, parsed as any);

    expect(broadcaster.subscribers("orders")).toBe(1);
    expect(JSON.parse(messages[0] ?? "{}")).toEqual({
      channel: "orders",
      event: "subscribed",
    });
  });

  it("rejects unsafe channels and subscription floods", () => {
    const messages: string[] = [];
    const broadcaster = new RealtimeBroadcaster();
    const connection = {
      id: "socket-1",
      send: (payload: string) => messages.push(payload),
    };

    broadcaster.connect(connection);

    expect(isValidRealtimeChannel("orders.1", {
      maxLength: 20,
      pattern: "^[A-Za-z0-9_.:-]+$",
    })).toBe(true);
    expect(isValidRealtimeChannel("orders/1", {
      maxLength: 20,
      pattern: "^[A-Za-z0-9_.:-]+$",
    })).toBe(false);
    expect(parseRealtimeMessage({
      channel: {},
      event: "subscribe",
    })).toBeNull();

    handleRealtimeMessage(
      broadcaster,
      connection,
      {
        channel: "orders.1",
        event: "subscribe",
      },
      {
        maxLength: 20,
        maxSubscriptionsPerConnection: 1,
        pattern: "^[A-Za-z0-9_.:-]+$",
      }
    );
    handleRealtimeMessage(
      broadcaster,
      connection,
      {
        channel: "orders.2",
        event: "subscribe",
      },
      {
        maxLength: 20,
        maxSubscriptionsPerConnection: 1,
        pattern: "^[A-Za-z0-9_.:-]+$",
      }
    );

    expect(JSON.parse(messages.at(-1) ?? "{}")).toEqual({
      event: "error",
      message: "Too many channel subscriptions.",
    });
  });

  it("validates realtime auth tokens", () => {
    expect(isRealtimeAuthTokenValid(undefined, {
      queryParameter: "token",
      required: false,
      token: "",
    })).toBe(true);
    expect(isRealtimeAuthTokenValid("secret", {
      queryParameter: "token",
      required: true,
      token: "secret",
    })).toBe(true);
    expect(isRealtimeAuthTokenValid("wrong", {
      queryParameter: "token",
      required: true,
      token: "secret",
    })).toBe(false);
  });

  it("requires a broadcast channel", () => {
    expect(() =>
      normalizeBroadcastPayload({
        event: "MissingChannel",
      })
    ).toThrow("Broadcast channel is required");
  });
});

describe("BroadcastManager", () => {
  it("returns the realtime broadcaster by default", () => {
    const manager = new BroadcastManager({
      defaultConnection: "realtime",
      auth: {
        queryParameter: "token",
        required: false,
        token: "",
      },
      channels: {
        maxLength: 128,
        maxSubscriptionsPerConnection: 256,
        pattern: "^[A-Za-z0-9_.:-]+$",
      },
      singleInstanceAcknowledged: false,
      websocket: {
        backpressureLimit: 1,
        idleTimeout: 1,
        maxPayloadLength: 1,
        path: "/ws",
      },
    });

    expect(manager.connection()).toBe(manager.realtime());
  });
});
