import { describe, expect, it } from "bun:test";

import { SystemSettingPolicy } from "../../app/Policies/SystemSettingPolicy";
import { policyConfig } from "../../config/policies";

describe("policyConfig", () => {
  it("registers framework policy classes and route policy configuration", () => {
    expect(policyConfig.policies.systemSettings).toBe(SystemSettingPolicy);
    expect(policyConfig.publicRoutes).toContain("GET /health");
    expect(policyConfig.publicRoutes).toContain("GET /broadcasting");
    expect(policyConfig.routePolicies).toEqual({});
    expect(policyConfig.trustUserHeaders).toBe(false);
    expect(policyConfig.userHeaders).toEqual({
      id: "x-auth-user-id",
      permissions: "x-auth-user-permissions",
      roles: "x-auth-user-roles",
    });
  });
});
