import { fileURLToPath } from "node:url";

import { appConfig } from "./app";

export const nuxtConfig = {
  srcDir: "resources/views",
  // `as const` keeps the literal type, which Nuxt's DateString requires.
  compatibilityDate: "2026-07-16" as const,
  modules: ["nuxt-elysia"],
  css: [fileURLToPath(new URL("../resources/css/app.css", import.meta.url))],
  devServer: {
    host: "localhost",
    port: 3000,
  },
  app: {
    head: {
      title: "Patshop On-Demand",
      meta: [
        {
          name: "description",
          content: `${appConfig.name} website backed by an Elysia API.`,
        },
      ],
    },
  },
  nitro: {
    preset: "bun",
  },
  nuxtElysia: {
    module: "~~/api",
    path: "/api",
    treaty: true,
    treatyRequestHeaders: ["Cookie", "Authorization", appConfig.headers.requestId],
  },
  vite: {
    optimizeDeps: {
      include: [
        "@elysiajs/eden",
        "@vue/devtools-core",
        "@vue/devtools-kit",
      ],
    },
  },
  typescript: {
    strict: true,
  },
};

export type NuxtAppConfig = typeof nuxtConfig;
