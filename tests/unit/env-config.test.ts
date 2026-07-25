import { describe, expect, it } from "bun:test";

import { envBoolean } from "../../config/env";

describe("envBoolean", () => {
  it("parses truthy environment values", () => {
    process.env.TEST_TRUTHY = "true";

    expect(envBoolean("TEST_TRUTHY")).toBe(true);
  });

  it("uses fallback when the value is missing", () => {
    delete process.env.TEST_MISSING_BOOLEAN;

    expect(envBoolean("TEST_MISSING_BOOLEAN", true)).toBe(true);
  });
});
