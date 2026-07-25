import { describe, expect, it } from "bun:test";

describe("Nuxt starting page", () => {
  it("calls the mounted Elysia API through Eden", async () => {
    const page = await Bun.file("resources/views/pages/index.vue").text();

    expect(page).toContain("formatServiceTimestamp");
    expect(page).toContain("const { $api } = useNuxtApp()");
    expect(page).toContain("await $api.health.get()");
    expect(page).toContain("Nuxt website connected to Elysia API");
  });
});
