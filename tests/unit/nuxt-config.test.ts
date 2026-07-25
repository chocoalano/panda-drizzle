import { describe, expect, it } from "bun:test";

import {
  nuxtConfig as configuredNuxtConfig,
  type NuxtAppConfig,
} from "../../config/nuxt";
import defaultNuxtConfig from "../../nuxt.config";

// `defineNuxtConfig` is an identity helper, so the default export is the very
// object exported from `config/nuxt`, widened to Nuxt's `InputConfig` type.
const nuxtConfig = defaultNuxtConfig as unknown as NuxtAppConfig;

describe("nuxt config", () => {
  it("delegates Nuxt options from the config folder", () => {
    expect(defaultNuxtConfig).toEqual(configuredNuxtConfig);
  });

  it("registers nuxt-elysia with Bun Nitro preset", () => {
    expect(nuxtConfig.srcDir).toBe("resources/views");
    expect(nuxtConfig.compatibilityDate).toBe("2026-07-16");
    expect(nuxtConfig.devServer).toMatchObject({
      host: "localhost",
      port: 3000,
    });
    expect(nuxtConfig.modules).toContain("nuxt-elysia");
    expect(nuxtConfig.nitro.preset).toBe("bun");
    expect(
      nuxtConfig.css.some((entry) => entry.endsWith("/resources/css/app.css"))
    ).toBe(true);
    expect(nuxtConfig.nuxtElysia).toMatchObject({
      module: "~~/api",
      path: "/api",
      treaty: true,
    });
  });

  it("forwards API context headers to Eden requests", () => {
    expect(nuxtConfig.nuxtElysia.treatyRequestHeaders).toEqual([
      "Cookie",
      "Authorization",
      "x-request-id",
    ]);
  });

  it("pre-bundles runtime dependencies discovered by Vite", () => {
    expect(nuxtConfig.vite.optimizeDeps.include).toEqual([
      "@elysiajs/eden",
      "@vue/devtools-core",
      "@vue/devtools-kit",
    ]);
  });
});
