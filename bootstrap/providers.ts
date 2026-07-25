import type { Elysia } from "elysia";

import type {
  ServiceProvider,
  ServiceProviderConstructor,
} from "../app/Providers/ServiceProvider";
import { providerConfig } from "../config/providers";

export const providers = providerConfig.providers;

export function registerProviders(
  app: Elysia,
  providerConstructors: ServiceProviderConstructor[] = providers
) {
  const providerInstances: ServiceProvider[] = providerConstructors.map(
    (Provider) => new Provider()
  );
  let registeredApp = app;

  for (const provider of providerInstances) {
    registeredApp = provider.register(registeredApp);
  }

  for (const provider of providerInstances) {
    registeredApp = provider.boot(registeredApp);
  }

  return registeredApp;
}
