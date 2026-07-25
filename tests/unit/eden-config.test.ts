import { describe, expect, it } from "bun:test";

import { edenConfig } from "../../config/eden";

describe("edenConfig", () => {
  it("keeps the standalone Eden client default URL in config", () => {
    expect(edenConfig.defaultBaseUrl).toBe("http://localhost:3000");
  });
});
