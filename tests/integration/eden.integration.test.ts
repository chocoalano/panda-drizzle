import { describe, expect, it } from "bun:test";

import createNuxtElysiaApp from "../../api";
import { appConfig } from "../../config/app";
import { createEdenClient } from "../../resources/js/eden";

describe("Eden integration", () => {
  it("calls the Elysia app through Eden Treaty", async () => {
    const client = createEdenClient(createNuxtElysiaApp());
    const response = await client.health.get();

    expect(response.error).toBeNull();
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      status: "ok",
      service: appConfig.name,
    });
    expect(new Headers(response.headers ?? []).get(appConfig.headers.appName)).toBe(
      appConfig.name
    );
  });
});
