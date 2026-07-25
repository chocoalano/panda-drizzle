import type { Elysia } from "elysia";

import { policyConfig, type PolicyConfig } from "../../../config/policies";
import { createGate, type Gate } from "../../Support/Authorization/Gate";
import type { PolicyUser, PolicyUserHeaders } from "../../Support/Policy";

export type PolicyUserResolver = (
  request: Request
) => PolicyUser | null | Promise<PolicyUser | null>;

export function parsePolicyHeader(value: string | null) {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

export function policyUserFromTrustedHeaders(
  request: Request,
  headers: PolicyUserHeaders = policyConfig.userHeaders
): PolicyUser | null {
  const id = request.headers.get(headers.id)?.trim();
  const roles = parsePolicyHeader(request.headers.get(headers.roles));
  const permissions = parsePolicyHeader(request.headers.get(headers.permissions));

  if (!id && roles.length === 0 && permissions.length === 0) {
    return null;
  }

  return {
    id,
    permissions,
    roles,
  };
}

export function defaultPolicyUserResolver(
  request: Request,
  config: PolicyConfig = policyConfig
): PolicyUser | null {
  if (!config.trustUserHeaders) {
    return null;
  }

  return policyUserFromTrustedHeaders(request, config.userHeaders);
}

export class PolicyMiddleware {
  constructor(
    private readonly gate: Gate = createGate(),
    private readonly resolveUser: PolicyUserResolver = defaultPolicyUserResolver
  ) {}

  handle(app: Elysia) {
    return app.onBeforeHandle(async ({ request, set }) => {
      if (request.method === "OPTIONS") {
        return;
      }

      const pathname = new URL(request.url).pathname;
      const decision = await this.gate.inspectRoute(request.method, pathname, {
        request,
        user: await this.resolveUser(request),
      });

      if (decision.allowed) {
        return;
      }

      set.status = 403;

      return {
        message: decision.message ?? "Forbidden",
      };
    }) as unknown as Elysia;
  }
}
