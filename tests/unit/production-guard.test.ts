import { describe, expect, it } from "bun:test";

import {
  assertProductionCommandAllowed,
  hasForceFlag,
} from "../../app/Console/Commands/ProductionGuard";

describe("hasForceFlag", () => {
  it("detects force flags from options", () => {
    expect(hasForceFlag({ force: true })).toBe(true);
    expect(hasForceFlag({ args: ["--force"] })).toBe(true);
    expect(hasForceFlag({ args: ["--yes"] })).toBe(true);
    expect(hasForceFlag()).toBe(false);
  });
});

describe("assertProductionCommandAllowed", () => {
  it("requires force for production commands", () => {
    expect(() =>
      assertProductionCommandAllowed("db:migrate", "production")
    ).toThrow("without --force");
    expect(() =>
      assertProductionCommandAllowed("db:migrate", " Production ")
    ).toThrow("without --force");
    expect(() =>
      assertProductionCommandAllowed("db:migrate", "production", {
        args: ["--force"],
      })
    ).not.toThrow();
    expect(() =>
      assertProductionCommandAllowed("db:migrate", "local")
    ).not.toThrow();
  });
});
