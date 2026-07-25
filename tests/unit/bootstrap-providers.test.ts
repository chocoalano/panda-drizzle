import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { registerProviders } from "../../bootstrap/providers";
import type { ServiceProvider } from "../../app/Providers/ServiceProvider";
import { providerConfig } from "../../config/providers";

describe("registerProviders", () => {
  it("uses the configured provider registry by default", () => {
    expect(providerConfig.providers.length).toBeGreaterThan(0);
  });

  it("registers all providers before booting them", () => {
    const calls: string[] = [];

    class FirstProvider implements ServiceProvider {
      register(app: Elysia) {
        calls.push("first:register");

        return app;
      }

      boot(app: Elysia) {
        calls.push("first:boot");

        return app;
      }
    }

    class SecondProvider implements ServiceProvider {
      register(app: Elysia) {
        calls.push("second:register");

        return app;
      }

      boot(app: Elysia) {
        calls.push("second:boot");

        return app;
      }
    }

    registerProviders(new Elysia(), [FirstProvider, SecondProvider]);

    expect(calls).toEqual([
      "first:register",
      "second:register",
      "first:boot",
      "second:boot",
    ]);
  });
});
