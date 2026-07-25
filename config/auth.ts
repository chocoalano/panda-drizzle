import { appConfig, isProductionEnvironment } from "./app";
import { env } from "./env";

const defaultPublicPaths = ["/", "/health", "/api/health", "/broadcasting"];

export const authConfig = {
  bearerToken: env("API_BEARER_TOKEN"),
  realm: env("AUTH_REALM", appConfig.name),
  publicPaths: parsePublicPaths(env("AUTH_PUBLIC_PATHS"), defaultPublicPaths),
};

export type AuthConfig = typeof authConfig;

export function parsePublicPaths(
  value: string,
  fallback: string[] = defaultPublicPaths
) {
  const paths = value
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);

  return paths.length > 0 ? paths : fallback;
}

export function isBearerAuthEnabled(token = authConfig.bearerToken) {
  return token.trim().length > 0;
}

export function assertBearerAuthConfiguration(
  token = authConfig.bearerToken,
  environment = appConfig.env
) {
  if (isProductionEnvironment(environment) && !isBearerAuthEnabled(token)) {
    throw new Error("API_BEARER_TOKEN is required when APP_ENV=production.");
  }
}

export function isPublicPath(
  pathname: string,
  publicPaths: string[] = authConfig.publicPaths
) {
  return publicPaths.some((publicPath) => {
    if (publicPath.endsWith("*")) {
      return pathname.startsWith(publicPath.slice(0, -1));
    }

    return pathname === publicPath;
  });
}
