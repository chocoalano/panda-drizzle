import { describe, expect, it } from "bun:test";

import {
  assertBearerAuthConfiguration,
  isBearerAuthEnabled,
  isPublicPath,
  parsePublicPaths,
} from "../../config/auth";

describe("parsePublicPaths", () => {
  it("parses comma-separated public paths", () => {
    expect(parsePublicPaths("/,/health,/docs/*")).toEqual([
      "/",
      "/health",
      "/docs/*",
    ]);
  });

  it("uses fallback when no public path is configured", () => {
    expect(parsePublicPaths("", ["/health"])).toEqual(["/health"]);
  });
});

describe("isBearerAuthEnabled", () => {
  it("is enabled only when a token is configured", () => {
    expect(isBearerAuthEnabled("")).toBe(false);
    expect(isBearerAuthEnabled("secret")).toBe(true);
  });
});

describe("assertBearerAuthConfiguration", () => {
  it("requires a bearer token in production", () => {
    expect(() => assertBearerAuthConfiguration("", "production")).toThrow(
      "API_BEARER_TOKEN is required"
    );
    expect(() => assertBearerAuthConfiguration("secret", "production")).not.toThrow();
    expect(() => assertBearerAuthConfiguration("", "local")).not.toThrow();
  });
});

describe("isPublicPath", () => {
  it("matches exact and wildcard public paths", () => {
    expect(parsePublicPaths("")).toContain("/broadcasting");
    expect(isPublicPath("/health", ["/health"])).toBe(true);
    expect(isPublicPath("/docs/openapi", ["/docs/*"])).toBe(true);
    expect(isPublicPath("/private", ["/health"])).toBe(false);
  });
});
