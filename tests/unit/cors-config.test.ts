import { describe, expect, it } from "bun:test";

import {
  assertCorsConfiguration,
  buildCorsConfig,
  corsConfig,
  parseCorsOrigins,
} from "../../config/cors";

describe("parseCorsOrigins", () => {
  it("uses fallback origins for empty values and supports wildcard explicitly", () => {
    expect(parseCorsOrigins("", ["https://app.test"])).toEqual([
      "https://app.test",
    ]);
    expect(parseCorsOrigins("*")).toBe(true);
  });

  it("parses comma-separated origins", () => {
    expect(parseCorsOrigins("https://app.test, https://admin.test")).toEqual([
      "https://app.test",
      "https://admin.test",
    ]);
  });
});

describe("buildCorsConfig", () => {
  it("defaults to the localhost whitelist rather than a wildcard", () => {
    expect(buildCorsConfig().origin).toEqual(["http://localhost:3000"]);
  });

  it("keeps a configured whitelist instead of opening every origin", () => {
    expect(
      buildCorsConfig({ origin: "https://app.test,https://admin.test" }).origin
    ).toEqual(["https://app.test", "https://admin.test"]);
  });

  it("opens every origin only when explicitly set to a wildcard", () => {
    expect(buildCorsConfig({ origin: "*" }).origin).toBe(true);
  });

  it("rejects wildcard origins with credentials", () => {
    expect(() =>
      buildCorsConfig({
        credentials: true,
        origin: "*",
      })
    ).toThrow("CORS_CREDENTIALS=true");
    expect(() => assertCorsConfiguration(["https://app.test"], true)).not.toThrow();
  });
});

describe("corsConfig", () => {
  it("allows bearer and request context headers", () => {
    expect(corsConfig.allowedHeaders).toContain("Authorization");
    expect(corsConfig.allowedHeaders).toContain("x-request-id");
    expect(corsConfig.exposeHeaders).toContain("x-app-name");
  });
});
