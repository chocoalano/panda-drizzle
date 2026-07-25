import {
  broadcastingConfig,
  type BroadcastConnectionName,
  type BroadcastingConfig,
} from "../../../config/broadcasting";
import {
  LogBroadcaster,
  RealtimeBroadcaster,
  type BroadcastEvent,
  type Broadcaster,
} from "./Broadcaster";

export class BroadcastManager {
  private readonly resolvedBroadcasters = new Map<BroadcastConnectionName, Broadcaster>();

  constructor(
    private readonly config: BroadcastingConfig = broadcastingConfig,
    private readonly realtimeBroadcaster = new RealtimeBroadcaster()
  ) {}

  connection(name: BroadcastConnectionName = this.config.defaultConnection) {
    if (!this.resolvedBroadcasters.has(name)) {
      this.resolvedBroadcasters.set(name, this.makeBroadcaster(name));
    }

    return this.resolvedBroadcasters.get(name) as Broadcaster;
  }

  realtime() {
    return this.realtimeBroadcaster;
  }

  broadcast(event: BroadcastEvent, connection?: BroadcastConnectionName) {
    return this.connection(connection).broadcast(event);
  }

  private makeBroadcaster(name: BroadcastConnectionName) {
    return name === "log" ? new LogBroadcaster() : this.realtimeBroadcaster;
  }
}

export const broadcaster = new BroadcastManager();

export function broadcast(event: BroadcastEvent, connection?: BroadcastConnectionName) {
  return broadcaster.broadcast(event, connection);
}
