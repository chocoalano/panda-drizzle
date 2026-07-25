export const sensitiveQueryParamNames = [
  "api_key",
  "apikey",
  "authorization",
  "code",
  "id_token",
  "key",
  "password",
  "refresh_token",
  "secret",
  "sig",
  "signature",
  "token",
  "access_token",
  "x-amz-security-token",
  "x-amz-signature",
] as const;

const redactedValue = "[Redacted]";

export function isSensitiveQueryParam(
  name: string,
  sensitiveNames: readonly string[] = sensitiveQueryParamNames
) {
  const normalized = name.trim().toLowerCase();

  return sensitiveNames.some((candidate) => candidate.toLowerCase() === normalized);
}

export function redactUrlSearch(
  search: string,
  sensitiveNames: readonly string[] = sensitiveQueryParamNames
) {
  if (!search) {
    return "";
  }

  const params = new URLSearchParams(search);

  for (const key of [...params.keys()]) {
    if (isSensitiveQueryParam(key, sensitiveNames)) {
      params.set(key, redactedValue);
    }
  }

  const serialized = params.toString();

  return serialized ? `?${serialized}` : "";
}

export function safeRequestUrl(url: URL | string) {
  const parsed = typeof url === "string" ? new URL(url) : url;
  const query = redactUrlSearch(parsed.search);

  return {
    path: parsed.pathname,
    query,
    url: `${parsed.pathname}${query}`,
  };
}
