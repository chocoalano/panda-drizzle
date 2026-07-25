import { broadcastingConfig, type BroadcastingConfig } from "../../../config/broadcasting";

export type BroadcastPayload<TData = unknown> = {
  channel: string;
  data: TData;
  event: string;
  sentAt: string;
};

export type BroadcastEvent<TData = unknown> = {
  channel?: string;
  data?: TData;
  event: string;
};

export interface Broadcaster {
  broadcast(event: BroadcastEvent): Promise<BroadcastPayload>;
}

export type RealtimeConnection = {
  id: string;
  send(payload: string): void;
};

export type RealtimeClientMessage = {
  channel?: string;
  event: "ping" | "subscribe" | "unsubscribe";
};

export type RealtimeChannelRules = Pick<
  BroadcastingConfig["channels"],
  "maxLength" | "maxSubscriptionsPerConnection" | "pattern"
>;

export type RealtimeAuthRules = BroadcastingConfig["auth"];

export class RealtimeBroadcaster implements Broadcaster {
  private readonly channels = new Map<string, Set<string>>();
  private readonly connections = new Map<string, RealtimeConnection>();

  connect(connection: RealtimeConnection) {
    this.connections.set(connection.id, connection);
  }

  disconnect(connectionId: string) {
    this.connections.delete(connectionId);

    for (const subscribers of this.channels.values()) {
      subscribers.delete(connectionId);
    }
  }

  subscribe(connectionId: string, channel: string) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }

    this.channels.get(channel)?.add(connectionId);
  }

  unsubscribe(connectionId: string, channel: string) {
    this.channels.get(channel)?.delete(connectionId);

    if (this.channels.get(channel)?.size === 0) {
      this.channels.delete(channel);
    }
  }

  subscribers(channel: string) {
    return this.channels.get(channel)?.size ?? 0;
  }

  subscriptionsFor(connectionId: string) {
    let count = 0;

    for (const subscribers of this.channels.values()) {
      if (subscribers.has(connectionId)) {
        count += 1;
      }
    }

    return count;
  }

  isSubscribed(connectionId: string, channel: string) {
    return this.channels.get(channel)?.has(connectionId) ?? false;
  }

  async broadcast(event: BroadcastEvent) {
    const payload = normalizeBroadcastPayload(event);
    const subscribers = this.channels.get(payload.channel) ?? new Set<string>();
    const encoded = JSON.stringify(payload);

    for (const connectionId of subscribers) {
      this.connections.get(connectionId)?.send(encoded);
    }

    return payload;
  }
}

export class LogBroadcaster implements Broadcaster {
  constructor(private readonly logger: (message: string) => void = console.log) {}

  async broadcast(event: BroadcastEvent) {
    const payload = normalizeBroadcastPayload(event);

    this.logger(JSON.stringify(payload));

    return payload;
  }
}

export function normalizeBroadcastPayload(event: BroadcastEvent): BroadcastPayload {
  if (!event.channel) {
    throw new Error("Broadcast channel is required.");
  }

  if (!isValidRealtimeChannel(event.channel)) {
    throw new Error("Broadcast channel is invalid.");
  }

  return {
    channel: event.channel,
    data: event.data ?? {},
    event: event.event,
    sentAt: new Date().toISOString(),
  };
}

export function parseRealtimeMessage(input: unknown): RealtimeClientMessage | null {
  if (typeof input !== "object" || input === null || !("event" in input)) {
    return null;
  }

  const event = String(input.event);

  if (event !== "subscribe" && event !== "unsubscribe" && event !== "ping") {
    return null;
  }

  const channel = "channel" in input ? parseRealtimeChannel(input.channel) : undefined;

  if ("channel" in input && channel === undefined) {
    return null;
  }

  return {
    channel,
    event,
  };
}

export function handleRealtimeMessage(
  broadcaster: RealtimeBroadcaster,
  connection: RealtimeConnection,
  message: RealtimeClientMessage,
  rules: RealtimeChannelRules = broadcastingConfig.channels
) {
  if (message.event === "ping") {
    connection.send(JSON.stringify({ event: "pong" }));

    return;
  }

  if (!message.channel) {
    connection.send(
      JSON.stringify({
        event: "error",
        message: "Channel is required.",
      })
    );

    return;
  }

  if (!isValidRealtimeChannel(message.channel, rules)) {
    connection.send(
      JSON.stringify({
        event: "error",
        message: "Invalid channel.",
      })
    );

    return;
  }

  if (message.event === "subscribe") {
    if (
      !broadcaster.isSubscribed(connection.id, message.channel) &&
      broadcaster.subscriptionsFor(connection.id) >=
        rules.maxSubscriptionsPerConnection
    ) {
      connection.send(
        JSON.stringify({
          event: "error",
          message: "Too many channel subscriptions.",
        })
      );

      return;
    }

    broadcaster.subscribe(connection.id, message.channel);
  } else {
    broadcaster.unsubscribe(connection.id, message.channel);
  }

  connection.send(
    JSON.stringify({
      channel: message.channel,
      event: `${message.event}d`,
    })
  );
}

export function isValidRealtimeChannel(
  channel: string,
  rules: Pick<RealtimeChannelRules, "maxLength" | "pattern"> = broadcastingConfig.channels
) {
  return (
    channel.length > 0 &&
    channel.length <= rules.maxLength &&
    new RegExp(rules.pattern).test(channel)
  );
}

export function isRealtimeAuthTokenValid(
  token: string | undefined,
  rules: RealtimeAuthRules = broadcastingConfig.auth
) {
  if (!rules.required) {
    return true;
  }

  return Boolean(token && rules.token && token === rules.token);
}

function parseRealtimeChannel(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim();
}
