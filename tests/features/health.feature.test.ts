import { describe, expect, it } from "bun:test";

import { createApp } from "../../bootstrap/app";
import { appConfig } from "../../config/app";

describe("health endpoint", () => {
  it("serves the health endpoint through HTTP", async () => {
    const app = createApp();
    const response = await app.handle(new Request("http://localhost/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      service: appConfig.name,
    });
    expect(Number.isNaN(Date.parse(body.checkedAt))).toBe(false);
  });

  it("rejects clients that do not accept JSON", async () => {
    const app = createApp();
    const response = await app.handle(
      new Request("http://localhost/health", {
        headers: {
          accept: "text/html",
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(406);
    expect(body).toEqual({
      message: "Client must accept application/json",
    });
  });
});
