import { describe, expect, it } from "bun:test";

import {
  assertBroadcastConfiguration,
  broadcastingConfig,
  normalizeBroadcastAuthQuery,
  normalizeBroadcastChannelPattern,
  normalizeBroadcastConnection,
  normalizeBroadcastPath,
  resolveBroadcastAuthRequired,
} from "../../config/broadcasting";

describe("broadcastingConfig", () => {
  it("normalizes broadcast connections and websocket paths", () => {
    expect(normalizeBroadcastConnection("log")).toBe("log");
    expect(normalizeBroadcastConnection("realtime")).toBe("realtime");
    expect(normalizeBroadcastConnection("redis")).toBe("realtime");
    expect(normalizeBroadcastPath("ws")).toBe("/ws");
    expect(normalizeBroadcastAuthQuery("auth_token")).toBe("auth_token");
    expect(normalizeBroadcastAuthQuery("bad token")).toBe("token");
    expect(normalizeBroadcastChannelPattern("[")).toBe("^[A-Za-z0-9_.:-]+$");
    expect(broadcastingConfig.websocket.path).toBe("/broadcasting");
  });

  it("requires explicit realtime production acknowledgement", () => {
    expect(resolveBroadcastAuthRequired(undefined, "", "production")).toBe(true);
    expect(resolveBroadcastAuthRequired(undefined, "secret", "local")).toBe(true);
    expect(resolveBroadcastAuthRequired("false", "secret", "production")).toBe(
      false
    );
    expect(() =>
      assertBroadcastConfiguration(
        {
          ...broadcastingConfig,
          auth: {
            ...broadcastingConfig.auth,
            required: true,
            token: "",
          },
        },
        "local"
      )
    ).toThrow("BROADCAST_AUTH_TOKEN");
    expect(() =>
      assertBroadcastConfiguration(
        {
          ...broadcastingConfig,
          auth: {
            ...broadcastingConfig.auth,
            required: true,
            token: "secret",
          },
          defaultConnection: "realtime",
          singleInstanceAcknowledged: false,
        },
        "production"
      )
    ).toThrow("BROADCAST_SINGLE_INSTANCE");
  });
});
