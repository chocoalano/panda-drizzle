export type PolicyUser = {
  id?: number | string;
  roles?: readonly string[];
  permissions?: readonly string[];
  [key: string]: unknown;
};

export type PolicyContext<
  TUser extends PolicyUser = PolicyUser,
  TResource = unknown,
> = {
  user?: TUser | null;
  resource?: TResource;
  request?: Request;
  route?: string;
};

export type PolicyDecision = {
  allowed: boolean;
  message?: string;
};

export type PolicyResponse = boolean | PolicyDecision;

export type PolicyHandler<
  TUser extends PolicyUser = PolicyUser,
  TResource = unknown,
> = (
  context: PolicyContext<TUser, TResource>
) => PolicyResponse | Promise<PolicyResponse>;

export type PolicyConstructor = new () => object;

export type PolicyRegistry = Record<string, PolicyConstructor>;

export type RbacMatchMode = "all" | "any";

export type RbacRule = {
  match?: RbacMatchMode;
  permissions?: readonly string[];
  roles?: readonly string[];
};

export type RoutePolicyRule = RbacRule & {
  ability?: string;
  message?: string;
  policy?: string;
};

export type PolicyUserHeaders = {
  id: string;
  permissions: string;
  roles: string;
};

export type PolicyConfiguration = {
  policies: PolicyRegistry;
  publicRoutes: readonly string[];
  routePolicies: Record<string, RoutePolicyRule>;
  trustUserHeaders: boolean;
  userHeaders: PolicyUserHeaders;
};

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "This action is unauthorized.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function allow(message?: string): PolicyDecision {
  return {
    allowed: true,
    message,
  };
}

export function deny(message = "This action is unauthorized."): PolicyDecision {
  return {
    allowed: false,
    message,
  };
}

export function normalizePolicyResponse(
  response: PolicyResponse
): PolicyDecision {
  if (typeof response === "boolean") {
    return response ? allow() : deny();
  }

  return response;
}

export function userHasRole(user: PolicyUser | null | undefined, role: string) {
  return user?.roles?.includes(role) ?? false;
}

export function userHasPermission(
  user: PolicyUser | null | undefined,
  permission: string
) {
  return user?.permissions?.includes(permission) ?? false;
}

export function userSatisfiesRbac(
  user: PolicyUser | null | undefined,
  rule: RbacRule
) {
  const roles = rule.roles ?? [];
  const permissions = rule.permissions ?? [];
  const requirements = [
    ...roles.map((role) => userHasRole(user, role)),
    ...permissions.map((permission) => userHasPermission(user, permission)),
  ];

  if (requirements.length === 0) {
    return true;
  }

  if (!user) {
    return false;
  }

  return rule.match === "any"
    ? requirements.some(Boolean)
    : requirements.every(Boolean);
}
