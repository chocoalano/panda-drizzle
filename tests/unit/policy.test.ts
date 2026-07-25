import { describe, expect, it } from "bun:test";

import {
  AuthorizationError,
  allow,
  deny,
  normalizePolicyResponse,
  userHasPermission,
  userHasRole,
  userSatisfiesRbac,
} from "../../app/Support/Policy";

describe("policy helpers", () => {
  it("normalizes boolean policy responses", () => {
    expect(normalizePolicyResponse(true)).toEqual({
      allowed: true,
      message: undefined,
    });
    expect(normalizePolicyResponse(false)).toEqual({
      allowed: false,
      message: "This action is unauthorized.",
    });
  });

  it("creates explicit allow and deny decisions", () => {
    expect(allow("ok")).toEqual({
      allowed: true,
      message: "ok",
    });
    expect(deny("no")).toEqual({
      allowed: false,
      message: "no",
    });
  });

  it("checks roles and permissions from the policy user", () => {
    const user = {
      permissions: ["posts.update"],
      roles: ["editor"],
    };

    expect(userHasRole(user, "editor")).toBe(true);
    expect(userHasRole(user, "admin")).toBe(false);
    expect(userHasPermission(user, "posts.update")).toBe(true);
    expect(userHasPermission(user, "posts.delete")).toBe(false);
  });

  it("supports all and any RBAC match modes", () => {
    const user = {
      permissions: ["posts.update"],
      roles: ["editor"],
    };

    expect(
      userSatisfiesRbac(user, {
        permissions: ["posts.update"],
        roles: ["editor"],
      })
    ).toBe(true);
    expect(
      userSatisfiesRbac(user, {
        match: "any",
        permissions: ["posts.delete"],
        roles: ["editor"],
      })
    ).toBe(true);
    expect(
      userSatisfiesRbac(user, {
        permissions: ["posts.delete"],
        roles: ["editor"],
      })
    ).toBe(false);
  });

  it("marks authorization failures as 403 errors", () => {
    const error = new AuthorizationError("Denied.");

    expect(error.status).toBe(403);
    expect(error.message).toBe("Denied.");
  });
});
