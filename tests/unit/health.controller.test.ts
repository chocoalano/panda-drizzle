import { describe, expect, it } from "bun:test";

import { HealthController } from "../../app/Http/Controllers/HealthController";
import { HealthCheckRequest } from "../../app/Http/Requests/HealthCheckRequest";

describe("HealthController", () => {
  it("returns an ok health payload", () => {
    const controller = new HealthController(
      () => new Date("2026-01-01T00:00:00.000Z"),
      "test-service"
    );
    const result = controller.show(
      new HealthCheckRequest(new Request("http://localhost/health"))
    );

    expect(result).toEqual({
      status: 200,
      body: {
        status: "ok",
        service: "test-service",
        checkedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("rejects clients that do not accept JSON", () => {
    const controller = new HealthController();
    const result = controller.show(
      new HealthCheckRequest(
        new Request("http://localhost/health", {
          headers: {
            accept: "text/html",
          },
        })
      )
    );

    expect(result).toEqual({
      status: 406,
      body: {
        message: "Client must accept application/json",
      },
    });
  });
});
