import { describe, expect, it } from "bun:test";

import {
  Gate,
  createGate,
  isPublicRoute,
  routeMatches,
  routePolicyKey,
} from "../../app/Support/Authorization/Gate";
import { AuthorizationError, allow, deny } from "../../app/Support/Policy";
import type { PolicyConfiguration } from "../../app/Support/Policy";

class ArticlePolicy {
  view() {
    return allow();
  }

  update() {
    return deny("Article update denied.");
  }

  publish() {
    return true;
  }
}

const config: PolicyConfiguration = {
  policies: {
    articles: ArticlePolicy,
  },
  publicRoutes: ["GET /health"],
  routePolicies: {
    "GET /admin/articles": {
      permissions: ["articles.view"],
    },
    "POST /admin/articles": {
      ability: "view",
      policy: "articles",
      roles: ["admin"],
    },
  },
  trustUserHeaders: false,
  userHeaders: {
    id: "x-auth-user-id",
    permissions: "x-auth-user-permissions",
    roles: "x-auth-user-roles",
  },
};

describe("Gate", () => {
  it("inspects policy abilities", async () => {
    const gate = new Gate(config);

    await expect(gate.allows("articles", "view")).resolves.toBe(true);
    await expect(gate.allows("articles", "update")).resolves.toBe(false);
    await expect(gate.allows("articles", "publish")).resolves.toBe(true);
  });

  it("throws AuthorizationError when authorize denies", async () => {
    const gate = new Gate(config);

    await expect(gate.authorize("articles", "update")).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("allows explicitly public routes without route policy rules", async () => {
    const gate = new Gate(config);

    await expect(gate.inspectRoute("GET", "/health")).resolves.toEqual({
      allowed: true,
      message: undefined,
    });
  });

  it("denies routes without public registration or policy rules", async () => {
    const gate = new Gate(config);

    await expect(gate.inspectRoute("GET", "/private")).resolves.toEqual({
      allowed: false,
      message: "Route is not public and has no policy rule.",
    });
  });

  it("applies route RBAC rules before policy abilities", async () => {
    const gate = new Gate(config);

    await expect(
      gate.inspectRoute("GET", "/admin/articles", {
        user: {
          permissions: ["articles.view"],
        },
      })
    ).resolves.toEqual({
      allowed: true,
      message: undefined,
    });

    await expect(
      gate.inspectRoute("POST", "/admin/articles", {
        user: {
          roles: ["member"],
        },
      })
    ).resolves.toEqual({
      allowed: false,
      message: "This route is forbidden by RBAC policy.",
    });
  });

  it("builds stable route policy keys", () => {
    expect(routePolicyKey("get", "/admin/articles")).toBe("GET /admin/articles");
    expect(routeMatches("GET /docs/*", "GET /docs/openapi")).toBe(true);
    expect(isPublicRoute("GET /health", ["GET /health"])).toBe(true);
  });
});

describe("createGate", () => {
  it("creates a configured gate instance", () => {
    expect(createGate(config)).toBeInstanceOf(Gate);
  });
});
