import type { Elysia } from "elysia";

export interface ServiceProvider {
  register(app: Elysia): Elysia;
  boot(app: Elysia): Elysia;
}

export type ServiceProviderConstructor = new () => ServiceProvider;
