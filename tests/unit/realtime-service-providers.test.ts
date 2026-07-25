import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { BroadcastServiceProvider } from "../../app/Providers/BroadcastServiceProvider";
import { MailServiceProvider } from "../../app/Providers/MailServiceProvider";
import { NotificationServiceProvider } from "../../app/Providers/NotificationServiceProvider";
import { QueueServiceProvider } from "../../app/Providers/QueueServiceProvider";
import type { ServiceProviderConstructor } from "../../app/Providers/ServiceProvider";

const providers: Array<[string, ServiceProviderConstructor]> = [
  ["QueueServiceProvider", QueueServiceProvider],
  ["MailServiceProvider", MailServiceProvider],
  ["BroadcastServiceProvider", BroadcastServiceProvider],
  ["NotificationServiceProvider", NotificationServiceProvider],
];

describe("realtime feature service providers", () => {
  for (const [name, Provider] of providers) {
    it(`${name} returns the app during register and boot`, () => {
      const app = new Elysia();
      const provider = new Provider();

      expect(provider.register(app)).toBe(app);
      expect(provider.boot(app)).toBe(app);
    });
  }
});
