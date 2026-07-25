import type { PolicyConfiguration } from "../app/Support/Policy";
import { SystemSettingPolicy } from "../app/Policies/SystemSettingPolicy";
import { envBoolean } from "./env";

export const policyConfig: PolicyConfiguration = {
  policies: {
    systemSettings: SystemSettingPolicy,
  },
  publicRoutes: ["GET /", "GET /health", "GET /api/health", "GET /broadcasting"],
  routePolicies: {},
  trustUserHeaders: envBoolean("AUTH_TRUST_USER_HEADERS", false),
  userHeaders: {
    id: "x-auth-user-id",
    permissions: "x-auth-user-permissions",
    roles: "x-auth-user-roles",
  },
};

export type PolicyConfig = typeof policyConfig;
