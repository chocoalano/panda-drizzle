import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import {
  PolicyMiddleware,
  defaultPolicyUserResolver,
  parsePolicyHeader,
  policyUserFromTrustedHeaders,
} from "../../app/Http/Middlewares/PolicyMiddleware";
import { Gate } from "../../app/Support/Authorization/Gate";
import type { PolicyConfiguration } from "../../app/Support/Policy";

const config: PolicyConfiguration = {
  policies: {},
  publicRoutes: ["GET /health"],
  routePolicies: {
    "GET /admin": {
      permissions: ["admin.view"],
    },
  },
  trustUserHeaders: false,
  userHeaders: {
    id: "x-auth-user-id",
    permissions: "x-auth-user-permissions",
    roles: "x-auth-user-roles",
  },
};

describe("parsePolicyHeader", () => {
  it("normalizes comma separated header values", () => {
    expect(parsePolicyHeader(" admin, editor ,, ")).toEqual([
      "admin",
      "editor",
    ]);
    expect(parsePolicyHeader(null)).toEqual([]);
  });
});

describe("defaultPolicyUserResolver", () => {
  it("ignores user headers unless trusted header mode is enabled", () => {
    const request = new Request("http://localhost/admin", {
      headers: {
        "x-auth-user-id": "7",
        "x-auth-user-permissions": "admin.view,admin.update",
        "x-auth-user-roles": "admin",
      },
    });

    expect(defaultPolicyUserResolver(request, config)).toBe(null);
    expect(
      defaultPolicyUserResolver(request, {
        ...config,
        trustUserHeaders: true,
      })
    ).toEqual({
      id: "7",
      permissions: ["admin.view", "admin.update"],
      roles: ["admin"],
    });
  });

  it("returns null when no policy user headers exist", () => {
    expect(defaultPolicyUserResolver(new Request("http://localhost/admin"))).toBe(
      null
    );
  });
});

describe("policyUserFromTrustedHeaders", () => {
  it("builds a policy user from trusted upstream headers", () => {
    const request = new Request("http://localhost/admin", {
      headers: {
        "x-auth-user-permissions": "admin.view",
      },
    });

    expect(policyUserFromTrustedHeaders(request, config.userHeaders)).toEqual({
      id: undefined,
      permissions: ["admin.view"],
      roles: [],
    });
  });
});

describe("PolicyMiddleware", () => {
  it("allows routes without configured policies", async () => {
    const app = new PolicyMiddleware(new Gate(config))
      .handle(new Elysia())
      .get("/health", () => ({ ok: true }));

    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("denies protected routes when the policy user is missing permissions", async () => {
    const app = new PolicyMiddleware(new Gate(config))
      .handle(new Elysia())
      .get("/admin", () => ({ ok: true }));

    const response = await app.handle(new Request("http://localhost/admin"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message: "This route is forbidden by RBAC policy.",
    });
  });

  it("allows protected routes when the trusted policy user satisfies RBAC", async () => {
    const app = new PolicyMiddleware(
      new Gate(config),
      (request) => policyUserFromTrustedHeaders(request, config.userHeaders)
    )
      .handle(new Elysia())
      .get("/admin", () => ({ ok: true }));

    const response = await app.handle(
      new Request("http://localhost/admin", {
        headers: {
          "x-auth-user-permissions": "admin.view",
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
