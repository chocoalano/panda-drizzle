import { env, envBoolean } from "./env";

export const csrfConfig = {
  cookieName: env("CSRF_COOKIE_NAME", "csrf-token"),
  enabled: envBoolean("CSRF_ENABLED", true),
  headerName: env("CSRF_HEADER_NAME", "x-csrf-token"),
  methods: ["DELETE", "PATCH", "POST", "PUT"],
};

export type CsrfConfig = typeof csrfConfig;
