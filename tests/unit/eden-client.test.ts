import { describe, expect, it } from "bun:test";

import { edenConfig } from "../../config/eden";
import { createEdenClient, defaultEdenBaseUrl } from "../../resources/js/eden";

describe("createEdenClient", () => {
  it("creates a client with the default standalone API URL", () => {
    expect(defaultEdenBaseUrl).toBe(edenConfig.defaultBaseUrl);
    expect(createEdenClient()).toBeDefined();
  });
});
