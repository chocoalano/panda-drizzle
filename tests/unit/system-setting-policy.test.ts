import { describe, expect, it } from "bun:test";

import { SystemSettingPolicy } from "../../app/Policies/SystemSettingPolicy";

describe("SystemSettingPolicy", () => {
  it("allows admin users to manage settings", () => {
    const policy = new SystemSettingPolicy();

    expect(
      policy.update({
        user: {
          roles: ["admin"],
        },
      })
    ).toEqual({
      allowed: true,
      message: undefined,
    });
  });

  it("allows users with the matching permission", () => {
    const policy = new SystemSettingPolicy();

    expect(
      policy.viewAny({
        user: {
          permissions: ["system-settings.view"],
        },
      })
    ).toEqual({
      allowed: true,
      message: undefined,
    });
  });

  it("denies missing permissions with a clear message", () => {
    const policy = new SystemSettingPolicy();

    expect(policy.delete({ user: { permissions: [] } })).toEqual({
      allowed: false,
      message: "Missing permission: system-settings.delete",
    });
  });
});
