import { policyConfig, type PolicyConfig } from "../../../config/policies";
import {
  AuthorizationError,
  allow,
  deny,
  normalizePolicyResponse,
  userSatisfiesRbac,
  type PolicyContext,
  type PolicyDecision,
  type PolicyHandler,
  type RoutePolicyRule,
} from "../Policy";

export class Gate {
  constructor(private readonly config: PolicyConfig = policyConfig) {}

  async inspect(
    policyName: string,
    ability: string,
    context: PolicyContext = {}
  ): Promise<PolicyDecision> {
    const handler = this.resolvePolicyHandler(policyName, ability);

    if (!handler) {
      return deny(`Policy ability is not registered: ${policyName}.${ability}`);
    }

    return normalizePolicyResponse(await handler(context));
  }

  async allows(policyName: string, ability: string, context: PolicyContext = {}) {
    return (await this.inspect(policyName, ability, context)).allowed;
  }

  async authorize(
    policyName: string,
    ability: string,
    context: PolicyContext = {}
  ) {
    const decision = await this.inspect(policyName, ability, context);

    if (!decision.allowed) {
      throw new AuthorizationError(decision.message);
    }

    return true;
  }

  async inspectRoute(
    method: string,
    pathname: string,
    context: PolicyContext = {}
  ) {
    const route = routePolicyKey(method, pathname);
    const rule = this.config.routePolicies[route];

    if (rule) {
      return this.inspectRule(rule, {
        ...context,
        route,
      });
    }

    if (isPublicRoute(route, this.config.publicRoutes)) {
      return allow();
    }

    return deny("Route is not public and has no policy rule.");
  }

  async authorizeRoute(
    method: string,
    pathname: string,
    context: PolicyContext = {}
  ) {
    const decision = await this.inspectRoute(method, pathname, context);

    if (!decision.allowed) {
      throw new AuthorizationError(decision.message);
    }

    return true;
  }

  private async inspectRule(rule: RoutePolicyRule, context: PolicyContext) {
    if (!userSatisfiesRbac(context.user, rule)) {
      return deny(rule.message ?? "This route is forbidden by RBAC policy.");
    }

    if (!rule.policy && !rule.ability) {
      return allow();
    }

    if (!rule.policy || !rule.ability) {
      return deny("Route policy rules must define both policy and ability.");
    }

    return this.inspect(rule.policy, rule.ability, context);
  }

  private resolvePolicyHandler(policyName: string, ability: string) {
    const PolicyClass = this.config.policies[policyName];

    if (!PolicyClass) {
      return undefined;
    }

    const policy = new PolicyClass() as Record<string, unknown>;
    const handler = policy[ability];

    if (typeof handler !== "function") {
      return undefined;
    }

    return handler.bind(policy) as PolicyHandler;
  }
}

export function createGate(config: PolicyConfig = policyConfig) {
  return new Gate(config);
}

export function routePolicyKey(method: string, pathname: string) {
  return `${method.toUpperCase()} ${pathname}`;
}

export function isPublicRoute(route: string, publicRoutes: readonly string[]) {
  return publicRoutes.some((publicRoute) => routeMatches(publicRoute, route));
}

export function routeMatches(pattern: string, route: string) {
  if (pattern.endsWith("*")) {
    return route.startsWith(pattern.slice(0, -1));
  }

  return pattern === route;
}
