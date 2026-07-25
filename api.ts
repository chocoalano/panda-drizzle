import { createApp } from "./bootstrap/app";

export default function createNuxtElysiaApp() {
  return createApp();
}

export type ApiApp = ReturnType<typeof createNuxtElysiaApp>;
