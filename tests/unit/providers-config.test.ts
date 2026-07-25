import { describe, expect, it } from "bun:test";

import { AppServiceProvider } from "../../app/Providers/AppServiceProvider";
import { BroadcastServiceProvider } from "../../app/Providers/BroadcastServiceProvider";
import { MailServiceProvider } from "../../app/Providers/MailServiceProvider";
import { NotificationServiceProvider } from "../../app/Providers/NotificationServiceProvider";
import { QueueServiceProvider } from "../../app/Providers/QueueServiceProvider";
import { TelemetryServiceProvider } from "../../app/Providers/TelemetryServiceProvider";
import { providerConfig } from "../../config/providers";

describe("providerConfig", () => {
  it("keeps the application provider registry in config", () => {
    expect(providerConfig.providers).toEqual([
      AppServiceProvider,
      QueueServiceProvider,
      MailServiceProvider,
      BroadcastServiceProvider,
      NotificationServiceProvider,
      TelemetryServiceProvider,
    ]);
  });
});
