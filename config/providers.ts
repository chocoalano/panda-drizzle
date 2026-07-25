import { AppServiceProvider } from "../app/Providers/AppServiceProvider";
import { BroadcastServiceProvider } from "../app/Providers/BroadcastServiceProvider";
import { MailServiceProvider } from "../app/Providers/MailServiceProvider";
import { NotificationServiceProvider } from "../app/Providers/NotificationServiceProvider";
import { QueueServiceProvider } from "../app/Providers/QueueServiceProvider";
import { TelemetryServiceProvider } from "../app/Providers/TelemetryServiceProvider";
import type { ServiceProviderConstructor } from "../app/Providers/ServiceProvider";

export const providerConfig = {
  providers: [
    AppServiceProvider,
    QueueServiceProvider,
    MailServiceProvider,
    BroadcastServiceProvider,
    NotificationServiceProvider,
    TelemetryServiceProvider,
  ],
} satisfies {
  providers: ServiceProviderConstructor[];
};

export type ProviderConfig = typeof providerConfig;
