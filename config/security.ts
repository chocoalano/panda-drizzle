import { envBoolean } from "./env";

export const securityConfig = {
  enabled: envBoolean("SECURITY_HEADERS_ENABLED", true),
  headers: {
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), geolocation=(), microphone=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  },
};

export type SecurityConfig = typeof securityConfig;
