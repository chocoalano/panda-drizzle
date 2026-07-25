import { describe, expect, it } from "bun:test";

import { HealthCheckRequest } from "../../app/Http/Requests/HealthCheckRequest";

describe("HealthCheckRequest", () => {
  it("authorizes health checks", () => {
    const request = new HealthCheckRequest(new Request("http://localhost/health"));

    expect(request.authorize()).toBe(true);
  });

  it("accepts JSON-compatible clients", () => {
    expect(
      new HealthCheckRequest(
        new Request("http://localhost/health", {
          headers: {
            accept: "application/json",
          },
        })
      ).acceptsJson()
    ).toBe(true);

    expect(
      new HealthCheckRequest(
        new Request("http://localhost/health", {
          headers: {
            accept: "*/*",
          },
        })
      ).acceptsJson()
    ).toBe(true);
  });

  it("rejects non-JSON clients", () => {
    const request = new HealthCheckRequest(
      new Request("http://localhost/health", {
        headers: {
          accept: "text/html",
        },
      })
    );

    expect(request.acceptsJson()).toBe(false);
  });
});
